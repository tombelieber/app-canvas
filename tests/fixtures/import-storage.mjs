// Keep synthetic capture checkpoints out of the developer's actual library.
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
if (!process.env.APP_CANVAS_TEST_STORAGE || process.env.APP_CANVAS_TEST_STORAGE !== process.env.APP_CANVAS_HOME) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "app-canvas-test-storage-")));
  process.env.APP_CANVAS_HOME = directory;
  process.env.APP_CANVAS_TEST_STORAGE = directory;
  process.once("exit", () => rmSync(directory, { recursive: true, force: true }));
}
