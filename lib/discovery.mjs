import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, open, readFile, readdir } from "node:fs/promises";
import { isUtf8 } from "node:buffer";
import { extname, join, relative, resolve, sep } from "node:path";
import { sourceObligations } from "./source-obligations.mjs";
import { annotateNativeConstraints } from "./native-constraints.mjs";
import { annotateNativeUi } from "./native-ui-sources.mjs";

// A structural worklist, not a claim that syntax alone identifies every UI
// state. Regions make the remaining semantic inspection explicit and durable.
const generated = new Set([".git", "node_modules", "Pods", ".gradle", "DerivedData", "build", "dist", ".artifacts", ".cache", "__pycache__"]);
const text = new Set(".swift .m .mm .h .c .cc .cpp .java .kt .kts .js .mjs .cjs .jsx .ts .tsx .vue .svelte .dart .py .rb .go .rs .cs .php .html .htm .css .scss .sass .less .xml .storyboard .xib .json .plist .yaml .yml .pbxproj .xcconfig .gradle .sql .graphql .proto .sh".split(" "));
const assets = new Set(".png .jpg .jpeg .gif .webp .svg .ico .pdf .mp3 .mp4 .m4a .wav .ogg .ttf .otf .woff .woff2 .strings .stringsdict .xcassets".split(" "));

export async function discoverSources(root, { exclude = [] } = {}) {
  root = resolve(root);
  const files = [], obligations = [], excluded = [], issues = [];
  function add(path, sha256, kind, start, end, extra = {}) {
    const id = createHash("sha256").update(JSON.stringify([path, sha256, kind, start, end, extra])).digest("hex");
    obligations.push({ id, path, kind, start, end, ...extra });
  }
  async function visit(absolute) {
    const info = await lstat(absolute), path = relative(root, absolute).split(sep).join("/");
    if (exclude.includes(path)) return;
    if (info.isSymbolicLink()) {
      issues.push({ path, reason: "Source link needs an explicit review of its target" });
      return;
    }
    if (info.isDirectory()) {
      const name = absolute.split(sep).at(-1);
      if (path && generated.has(name)) {
        excluded.push({ path, reason: "Generated/dependency directory" });
        // .git and node_modules are tool internals. Other exclusions can hide
        // application source and must be explicitly reviewed before acceptance.
        if (![".git", "node_modules"].includes(name)) add(path, "excluded-directory", "exclusion", 1, 1);
        return;
      }
      for (const child of (await readdir(absolute)).sort()) await visit(join(absolute, child));
      return;
    }
    if (!info.isFile()) { issues.push({ path, reason: "Unsupported source entry" }); return; }
    const extension = extname(path).toLowerCase();
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(absolute)) hash.update(chunk);
    const file = { path, sha256: hash.digest("hex") };
    files.push(file);
    const unit = (kind, start, end, extra = {}) => add(path, file.sha256, kind, start, end, extra);
    unit("file", 1, 1);
    let readable = text.has(extension);
    if (!readable && !assets.has(extension)) {
      const handle = await open(absolute, "r");
      try {
        const buffer = Buffer.alloc(8192), { bytesRead } = await handle.read(buffer, 0, buffer.length, 0), sample = buffer.subarray(0, bytesRead);
        readable = !sample.includes(0) && isUtf8(sample);
      } finally { await handle.close(); }
    }
    if (readable) {
      if (info.size > 10 * 1024 * 1024) { issues.push({ path, reason: "Large text source needs a bounded discovery adapter" }); return; }
      const content = await readFile(absolute, "utf8"), lines = content.split("\n").length;
      for (let start = 1; start <= lines; start += 80) unit("region", start, Math.min(start + 79, lines));
      for (const item of sourceObligations(content, extension, { path })) unit(item.kind, item.start, item.end, item.details);
    }
  }
  await visit(root);
  await annotateNativeConstraints(root, files, obligations);
  await annotateNativeUi(root, files, obligations);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { version: 2, files, obligations, excluded, issues };
}
