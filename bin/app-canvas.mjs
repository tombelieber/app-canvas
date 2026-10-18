#!/usr/bin/env node
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { startCanvas, packageRoot } from "../lib/server.mjs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    config: { type: "string" },
    port: { type: "string" },
    version: { type: "boolean" },
    verify: { type: "boolean" },
    check: { type: "boolean" },
    complete: { type: "boolean" },
    "source-root": { type: "string" },
    inventory: { type: "string" },
    target: { type: "string" },
    out: { type: "string" },
    help: { type: "boolean" },
    headless: { type: "boolean" },
    "no-record": { type: "boolean" },
    profile: { type: "string" },
  },
});
if (values.version) {
  console.log(
    JSON.parse(await readFile(new URL("../package.json", import.meta.url)))
      .version,
  );
  process.exit(0);
}
if (values.help) {
  console.log(
    "app-canvas --config <project.config.mjs> [--port <port>] [--verify | --check | --complete]\napp-canvas import <URL> --out <new-private-directory> [--port <port>] [--headless] [--no-record]\napp-canvas open <private-project-directory> [--port <port>]\napp-canvas discover [--source-root <repository>] --out <new-inventory.json>\napp-canvas pending --inventory <inventory.json>\napp-canvas demo\napp-canvas export [--config <config>] --out <new-directory>\napp-canvas browsers\napp-canvas install --target codex|claude|both",
  );
  process.exit(0);
}
if (positionals[0] === "install") {
  const { install } = await import("../lib/install.mjs");
  await install({ target: values.target || "both" });
  process.exit(0);
}
if (positionals[0] === "browsers") {
  const require = createRequire(import.meta.url);
  const metadata = require.resolve("playwright/package.json");
  const { bin } = JSON.parse(await readFile(metadata, "utf8"));
  const cli = resolve(dirname(metadata), typeof bin === "string" ? bin : bin.playwright);
  const r = spawnSync(process.execPath, [cli, "install", "chromium"], {
    stdio: "inherit",
  });
  process.exit(r.status ?? 1);
}
let app;
try {
  if (["import", "open"].includes(positionals[0])) {
    const { runImportCommand } = await import("../lib/import/cli.mjs");
    await runImportCommand(positionals, values);
  } else {
  if (values.complete && (values.check || values.verify || positionals.length)) throw Error("Cannot combine --complete with --check, --verify or another command");
  if (["discover", "pending"].includes(positionals[0])) {
    const { discoverSources } = await import("../lib/inventory.mjs");
    if (positionals[0] === "discover") {
      if (!values.out) throw Error("discover requires --out <new-inventory.json>");
      const output = resolve(values.out), sourceRoot = resolve(values["source-root"] || ".");
      await mkdir(dirname(output), { recursive: true });
      const discovery = await discoverSources(sourceRoot, { exclude: [relative(sourceRoot, output)] });
      await writeFile(output, JSON.stringify({ ...discovery, sourceRoot: relative(dirname(output), sourceRoot) || ".", items: [], reviews: [] }, null, 2) + "\n", { flag: "wx" });
      console.log(`Source worklist: ${discovery.files.length} files, ${discovery.obligations.length} pending obligations, ${discovery.issues.length} unresolved sources. ${output}`);
    } else {
      if (!values.inventory) throw Error("pending requires --inventory <inventory.json>");
      const path = resolve(values.inventory), inventory = JSON.parse(await readFile(path, "utf8"));
      if (inventory.version !== 2) throw Error("pending needs a version 2 source discovery worklist");
      const sourceRoot = resolve(dirname(path), inventory.sourceRoot || ".");
      const discovery = await discoverSources(sourceRoot, { exclude: [relative(sourceRoot, path)] });
      const reviewed = new Set((inventory.reviews || []).map(item => item.id));
      const pending = discovery.obligations.filter(item => !reviewed.has(item.id));
      console.log(JSON.stringify({ files: discovery.files.length, total: discovery.obligations.length, pending: pending.length, issues: discovery.issues, next: pending.slice(0, 10) }, null, 2));
    }
    process.exit(0);
  }
  const exporting = positionals[0] === "export";
  if (exporting && !values.out) throw Error("export requires --out <new-directory>");
  if (values.check) {
    const { loadProject } = await import("../lib/config.mjs");
    const project = await loadProject(
      values.config || "canvas.config.mjs",
      process.cwd(),
    );
    console.log(
      `PASS: ${project.title}, ${project.catalog.length} registered cases; ${project.sourceCoverageReport ? `${project.sourceCoverageReport.items} source inventory items mapped` : "no source inventory configured (catalog/route checks only)"}`,
    );
    process.exit(0);
  }
  let completeProject;
  if (values.complete) {
    const { loadProject } = await import("../lib/config.mjs");
    completeProject = await loadProject(values.config || "canvas.config.mjs", process.cwd(), { complete: true });
    if (await realpath(completeProject.sourceCoverageReport.sourceRoot) !== await realpath(resolve(values["source-root"] || "."))) throw Error("Source discovery root does not match the requested application repository; use --source-root for the original repository");
    if (typeof completeProject.verify !== "function") throw Error("Complete validation requires a project verify hook with source-linked runtime evidence");
  }
  app = await startCanvas({
    config: completeProject,
    root: positionals[0] === "demo" ? packageRoot : process.cwd(),
    configPath:
      positionals[0] === "demo"
        ? "examples/stoolsense/canvas.config.mjs"
        : values.config || "canvas.config.mjs",
    port: values.port ? Number(values.port) : exporting ? 0 : undefined,
    watchFiles: !values.verify && !values.complete && !exporting,
  });
  console.log(`App canvas: ${app.address}`);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await app.close();
      process.exit(0);
    });
  if (exporting) {
    const result = await app.exportStatic({ outDir: values.out });
    console.log(`Exported ${result.total} screens and interactive previews to ${result.directory}`);
    await app.close();
  } else if (values.verify || values.complete) {
    const proof = await app.verify({ complete: values.complete });
    console.log(
      values.complete ? `PASS: source population verified, ${proof.total} cases` : `PASS: ${proof.total} registered screens${proof.interactionsVerified ? " and project interactions" : ""} (registered cases only; use --complete for population acceptance)`,
    );
    await app.close();
  }
  }
} catch (error) {
  console.error(error.message);
  await app?.close();
  process.exitCode = 1;
}
