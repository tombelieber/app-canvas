import assert from "node:assert/strict";
import example from "./catalog.json";
export default {
  title: "Tasks example",
  port: 6110,
  viewport: { width: 1280, height: 900 },
  ...example,
  routeCoverage: [{ file: "src/App.jsx", snapshot: "ui-review/routes.json" }],
  watchPaths: ["src", "ui-review"],
  preview: (ctx) => ctx.createVitePreview({ configFile: "vite.config.mjs", entry: "/ui-review/frame.jsx" }),
  async verify({ browser, preview }) {
    const page = await browser.newPage();
    try {
      await page.goto(preview.url(example.catalog[0]));
      await page.locator("html[data-review-ready=true]").waitFor();
      await page.getByRole("link", { name: "Settings", exact: true }).click();
      await page.getByLabel("Display name").fill("Synthetic edit");
      await page.getByRole("button", { name: "Save profile" }).click();
      await page.getByRole("status").filter({ hasText: "Saved Synthetic edit" }).waitFor();
      await page.getByRole("link", { name: "Tasks", exact: true }).click();
      await page.getByLabel("Task title").fill("Another synthetic task");
      await page.getByRole("button", { name: "Add task" }).click();
      await page.getByText("Another synthetic task", { exact: true }).waitFor();
      assert.equal(await page.locator("li").count(), 3);
      await page.reload();
      await page.locator("html[data-review-ready=true]").waitFor();
      assert.equal(await page.locator("li").count(), 2, "reload resets the frame-local fixture");
      await page.goto(preview.url(example.catalog.find((s) => s.id === "tasks-error")));
      await page.getByRole("button", { name: "Retry" }).click();
      await page.locator("[data-state=populated]").waitFor();
      assert.deepEqual(await page.evaluate(() => globalThis.__appCanvas.requests), []);
    } finally { await page.close(); }
  },
};
