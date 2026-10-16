import { mkdir, copyFile, writeFile, stat, rm, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { publicProject } from "./protocol.mjs";
import { canvasHtml } from "./html.mjs";

async function rejectLinks(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw Error("Static exports cannot contain symlinks");
    if (entry.isDirectory()) await rejectLinks(join(directory, entry.name));
  }
}

// Only a project-authored, explicitly publishable adapter can export previews.
// Never crawl a repository or expose the local development server to the web.
export async function exportCanvas({ output, outDir, project, preview, manifest }) {
  if (typeof preview.exportStatic !== "function")
    throw Error("This preview needs an explicit exportStatic adapter with publishable synthetic assets");
  if (manifest.status !== "ready" || Object.keys(manifest.screens).length !== project.catalog.length)
    throw Error("Every registered screen must render before export");
  if (!outDir) throw Error("Choose a new output directory with --out");
  const destination = resolve(outDir);
  // Exclusive creation: an existing directory may contain somebody else's work.
  await mkdir(destination);
  try {
    const targets = await preview.exportStatic({ outDir: destination });
    await rejectLinks(destination);
    const screens = {};
    for (const scenario of project.catalog) {
      const target = targets?.[scenario.id];
      const url = new URL(target || "", "https://canvas.invalid/export/");
      if (typeof target !== "string" || !target.startsWith("./") || url.origin !== "https://canvas.invalid" || !url.pathname.startsWith("/export/"))
        throw Error(`Static preview must use a relative in-export file: ${scenario.id}`);
      const file = resolve(destination, decodeURIComponent(url.pathname.slice("/export/".length)));
      if (!file.startsWith(destination + "/") || !(await stat(file)).isFile())
        throw Error(`Missing static preview: ${scenario.id}`);
      const source = manifest.screens[scenario.id];
      if (source.error || !source.image) throw Error(`Missing rendered screen: ${scenario.id}`);
      screens[scenario.id] = { width: source.width, height: source.height, image: `./thumb/${scenario.id}.png`, url: target };
    }
    await mkdir(join(destination, "assets"));
    await mkdir(join(destination, "thumb"));
    for (const file of ["canvas.js", "canvas.css"])
      await copyFile(join(output, file), join(destination, "assets", file));
    await copyFile(join(output, "canvas-LICENSES.txt"), join(destination, "canvas-LICENSES.txt"));
    for (const scenario of project.catalog)
      await copyFile(join(output, String(manifest.revision), `${scenario.id}.png`), join(destination, "thumb", `${scenario.id}.png`));
    await writeFile(join(destination, "index.html"), canvasHtml());
    await writeFile(join(destination, ".nojekyll"), "");
    await writeFile(join(destination, "project.json"), JSON.stringify({ ...publicProject(project), static: true }, null, 2));
    await writeFile(join(destination, "manifest.json"), JSON.stringify({ ...manifest, screens }, null, 2));
    return { directory: destination, total: project.catalog.length };
  } catch (error) {
    await rm(destination, { recursive: true });
    throw error;
  }
}
