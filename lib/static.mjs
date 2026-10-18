import { mkdir, copyFile, writeFile, stat, rm, readdir } from "node:fs/promises";
import { join, resolve, dirname, relative } from "node:path";
import { publicProject } from "./protocol.mjs";
import { canvasHtml } from "./html.mjs";
import { bridgeHtml } from "./bridge-html.mjs";
import { readFile } from "node:fs/promises";

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
    await mkdir(join(destination, "assets"));
    const patched = new Set();
    for (const scenario of project.catalog) {
      const target = targets?.[scenario.id];
      const url = new URL(target || "", "https://canvas.invalid/export/");
      if (typeof target !== "string" || !target.startsWith("./") || url.origin !== "https://canvas.invalid" || !url.pathname.startsWith("/export/"))
        throw Error(`Static preview must use a relative in-export file: ${scenario.id}`);
      const file = resolve(destination, decodeURIComponent(url.pathname.slice("/export/".length)));
      if (!file.startsWith(destination + "/") || !(await stat(file)).isFile())
        throw Error(`Missing static preview: ${scenario.id}`);
      if (!patched.has(file)) {
        if (!file.endsWith(".html")) throw Error("Static live previews must point to an HTML entry file");
        await writeFile(file, bridgeHtml(await readFile(file, "utf8"), relative(dirname(file), join(destination, "assets/frame-bridge.js"))));
        patched.add(file);
      }
      const source = manifest.screens[scenario.id];
      if (source.error) throw Error(`Failed live screen: ${scenario.id}`);
      let domUrl, sharedUrl;
      // A static adapter may sanitize/replace the local fixtures. Never publish
      // its measured local DOM unless that adapter explicitly opts in too.
      if (source.domUrl && preview.exportDom === true) {
        await copyFile(join(output, `dom-${scenario.id}.html`), join(destination, "assets", `dom-${scenario.id}.html`));
        domUrl = `./assets/dom-${scenario.id}.html`;
        if (source.sharedUrl) {
          await copyFile(join(output, `dom-${scenario.id}.json`), join(destination, "assets", `dom-${scenario.id}.json`));
          sharedUrl = `./assets/dom-${scenario.id}.json`;
        }
      }
      screens[scenario.id] = { width: source.width, height: source.height, url: target, domUrl, sharedUrl };
    }
    for (const file of ["canvas.js", "canvas.css", "frame-bridge.js", "overview.html"])
      await copyFile(join(output, file), join(destination, "assets", file));
    await copyFile(join(output, "canvas-LICENSES.txt"), join(destination, "canvas-LICENSES.txt"));
    await writeFile(join(destination, "index.html"), canvasHtml({ assetVersion: manifest.canvasHash }));
    await writeFile(join(destination, ".nojekyll"), "");
    await writeFile(join(destination, "project.json"), JSON.stringify({ ...publicProject(project), static: true }, null, 2));
    // Local native assets have no publication authorization from exportStatic.
    const { nativeOverview, nativeOverviewError, ...exportManifest } = manifest;
    await writeFile(join(destination, "manifest.json"), JSON.stringify({ ...exportManifest, screens }, null, 2));
    return { directory: destination, total: project.catalog.length };
  } catch (error) {
    await rm(destination, { recursive: true });
    throw error;
  }
}
