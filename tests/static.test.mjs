import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, access, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { exportCanvas } from "../lib/static.mjs";

test("static export contains the same canvas, relative assets and no local preview URLs", async () => {
  const root = await mkdtemp(join(tmpdir(), "app-canvas-static-"));
  const output = join(root, "cache"), outDir = join(root, "site");
  await mkdir(join(output, "1"), { recursive: true });
  for (const file of ["canvas.js", "canvas.css", "canvas-LICENSES.txt", "frame-bridge.js", "overview.html"])
    await writeFile(join(output, file), "fixture");
  const project = { title: "Example", groups: [{ id: "pages" }], catalog: [{ id: "home", title: "Home", group: "pages" }], flows: [] };
  const manifest = { status: "ready", revision: 1, screens: { home: { url: "http://127.0.0.1:123/frame?id=home", width: 390, height: 844 } } };
  await writeFile(join(output, "dom-home.html"), '<!doctype html><html><body><h1>Actual source DOM</h1></body></html>');
  manifest.screens.home.domUrl = "http://127.0.0.1:123/assets/dom-home.html";
  manifest.screens.home.sharedUrl = "http://127.0.0.1:123/assets/dom-home.json";
  manifest.canvasHash = "candidate-runtime";
  manifest.nativeOverview = { url: "http://127.0.0.1:123/private-native-atlas.webp" };
  manifest.nativeOverviewError = "Private adapter diagnostic";
  await writeFile(join(output, "dom-home.json"), JSON.stringify({ html: "Actual source DOM", background: "white", fonts: "" }));
  const preview = { exportDom: true, async exportStatic({ outDir }) {
    await mkdir(join(outDir, "frame"));
    await writeFile(join(outDir, "frame/index.html"), "synthetic preview");
    return { home: "./frame/index.html?id=home" };
  } };
  try {
    await exportCanvas({ output, outDir, project, preview, manifest });
    const exported = await readFile(join(outDir, "manifest.json"), "utf8");
    assert.ok(!exported.includes("127.0.0.1"));
    assert.equal(JSON.parse(exported).nativeOverview, undefined, "publishing DOM does not authorize publishing private native captures");
    assert.equal(JSON.parse(exported).nativeOverviewError, undefined);
    assert.equal(JSON.parse(exported).screens.home.url, "./frame/index.html?id=home");
    assert.equal(JSON.parse(exported).screens.home.domUrl, "./assets/dom-home.html");
    assert.match(await readFile(join(outDir, "assets/dom-home.html"), "utf8"), /Actual source DOM/);
    assert.equal(JSON.parse(exported).screens.home.sharedUrl, "./assets/dom-home.json");
    assert.match(await readFile(join(outDir, "assets/dom-home.json"), "utf8"), /Actual source DOM/);
    assert.equal(JSON.parse(await readFile(join(outDir, "project.json"))).static, true);
    assert.match(await readFile(join(outDir, "index.html"), "utf8"), /\.\/assets\/canvas.js/);
    assert.match(await readFile(join(outDir, "index.html"), "utf8"), /canvas\.js\?v=candidate-runtime/);
    assert.match(await readFile(join(outDir, "index.html"), "utf8"), /canvas\.css\?v=candidate-runtime/);
    await assert.rejects(() => access(join(outDir, "thumb")), "static canvas never exports screenshot thumbnails");
    assert.match(await readFile(join(outDir, "frame/index.html"), "utf8"), /frame-bridge.js/);
    const legacyDir = join(root, "legacy-adapter");
    await exportCanvas({ output, outDir: legacyDir, project, preview: { exportStatic: preview.exportStatic }, manifest });
    assert.equal(JSON.parse(await readFile(join(legacyDir, "manifest.json"))).screens.home.domUrl, undefined, "an adapter must explicitly approve publishing measured local DOM");
    assert.equal(JSON.parse(await readFile(join(legacyDir, "manifest.json"))).screens.home.sharedUrl, undefined);
    await assert.rejects(() => access(join(legacyDir, "assets/dom-home.json")), "shared DOM is not exported implicitly");
    await assert.rejects(() => access(join(legacyDir, "assets/dom-home.html")), "local DOM is not exported implicitly");
    await assert.rejects(() => exportCanvas({ output, outDir, project, preview, manifest }), /exist/i);
    await assert.rejects(() => exportCanvas({ output, outDir: join(root, "no-adapter"), project, preview: {}, manifest }), /exportStatic/);
    await assert.rejects(() => access(join(root, "no-adapter")));
    for (const url of ["https://elsewhere.example/frame", "/frame", "../frame", "./frame/missing.html"])
      await assert.rejects(() => exportCanvas({ output, outDir: join(root, "bad"), project, preview: { exportStatic: async () => ({ home: url }) }, manifest }));
    await assert.rejects(() => access(join(root, "bad")), "failed export must not leave a publishable partial site");
    await assert.rejects(() => exportCanvas({ output, outDir: join(root, "linked"), project, preview: { async exportStatic({ outDir }) { await symlink(output, join(outDir, "outside"), "dir"); return { home: "./outside/canvas.js" }; } }, manifest }), /symlink/);
  } finally { await rm(root, { recursive: true }); }
});
