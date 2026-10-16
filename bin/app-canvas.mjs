#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { startCanvas, packageRoot } from "../lib/server.mjs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    config: { type: "string" },
    port: { type: "string" },
    version: { type: "boolean" },
    verify: { type: "boolean" },
    check: { type: "boolean" },
    target: { type: "string" },
    out: { type: "string" },
    help: { type: "boolean" },
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
    "app-canvas --config <project.config.mjs> [--port <port>] [--verify | --check]\napp-canvas demo\napp-canvas export [--config <project.config.mjs>] --out <new-directory>\napp-canvas browsers\napp-canvas install --target codex|claude|both",
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
  const cli = require.resolve("playwright/cli");
  const r = spawnSync(process.execPath, [cli, "install", "chromium"], {
    stdio: "inherit",
  });
  process.exit(r.status ?? 1);
}
let app;
try {
  const exporting = positionals[0] === "export";
  if (exporting && !values.out) throw Error("export requires --out <new-directory>");
  if (values.check) {
    const { loadProject } = await import("../lib/config.mjs");
    const project = await loadProject(
      values.config || "canvas.config.mjs",
      process.cwd(),
    );
    console.log(
      `PASS: ${project.title}, ${project.catalog.length} registered cases; route coverage valid`,
    );
    process.exit(0);
  }
  app = await startCanvas({
    root: positionals[0] === "demo" ? packageRoot : process.cwd(),
    configPath:
      positionals[0] === "demo"
        ? "examples/stoolsense/canvas.config.mjs"
        : values.config || "canvas.config.mjs",
    port: values.port ? Number(values.port) : exporting ? 0 : undefined,
    watchFiles: !values.verify && !exporting,
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
  } else if (values.verify) {
    const proof = await app.verify();
    console.log(
      `PASS: ${proof.total} registered screens${proof.interactionsVerified ? " and project interactions" : ""}`,
    );
    await app.close();
  }
} catch (error) {
  console.error(error.message);
  await app?.close();
  process.exitCode = 1;
}
