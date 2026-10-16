import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

test("browser setup resolves Playwright's declared executable before spawning installation", async () => {
  // Keep downloads outside the unit gate, but use real dependency metadata and
  // the actual public app-canvas entry point. Intercept only the process IO.
  const preload = `
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    import { existsSync } from 'node:fs';
    import assert from 'node:assert/strict';
    childProcess.spawnSync = (executable, args) => {
      assert.equal(executable, process.execPath);
      assert.ok(existsSync(args[0]));
      assert.match(args[0], /playwright.*cli\\.js$/);
      assert.deepEqual(args.slice(1), ['install', 'chromium']);
      console.log('public browser setup entry reached');
      return { status: 0 };
    };
    syncBuiltinESMExports();
  `;
  const cli = fileURLToPath(new URL("../bin/app-canvas.mjs", import.meta.url));
  const result = await promisify(execFile)(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, cli, "browsers"]);
  assert.match(result.stdout, /public browser setup entry reached/);
});
