import assert from "node:assert/strict";
import { mkdir, stat } from "node:fs/promises";
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
const { startCanvas, packageRoot } = await import(
  process.env.APP_CANVAS_TEST_PACKAGE
    ? pathToFileURL(join(process.env.APP_CANVAS_TEST_PACKAGE, "lib/server.mjs"))
        .href
    : "../lib/server.mjs"
);
import example from "../examples/stoolsense/catalog.json" with { type: "json" };
const { catalog } = example;

const hostedUrl = process.env.APP_CANVAS_TEST_URL;
const hostedManifest = hostedUrl ? await (await fetch(new URL("manifest.json", hostedUrl))).json() : null;
const app = hostedUrl ? {
  address: hostedUrl,
  firstBuild: Promise.resolve(),
  verify: async () => {},
  getManifest: () => hostedManifest,
  close: async () => {},
} : await startCanvas({
  root: packageRoot,
  configPath: "examples/stoolsense/canvas.config.mjs",
  port: 0,
  watchFiles: false,
});
let browser;
try {
  await app.firstBuild;
  await app.verify();
  const manifest = app.getManifest();
  assert.equal(manifest.status, "ready", JSON.stringify(manifest.screens));
  assert.equal(Object.keys(manifest.screens).length, catalog.length);
  assert.ok(
    Object.values(manifest.screens).every((s) => s.image && s.height >= 844),
  );
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1512, height: 982 },
    timezoneId: "Asia/Hong_Kong",
  });
  const errors = [],
    remote = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(app.address).origin && !request.url().startsWith("blob:"))
      remote.push(request.url());
  });
  await page.goto(app.address);
  await page
    .getByText(`${catalog.length} 個畫面 · ${hostedUrl ? "示範版本" : "已同步"}`, { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "全覽", exact: false }).click();
  await page.waitForFunction(
    (n) => document.querySelectorAll(".screen-frame").length === n,
    catalog.length,
  );
  assert.equal(
    await page.locator("iframe").count(),
    0,
    "overview must not mount dozens of apps",
  );
  assert.ok(
    (await page.locator(".react-flow__edge").count()) > 20,
    "flow connections are present",
  );
  await mkdir(".artifacts/browser-proof", { recursive: true });
  await page.screenshot({ path: ".artifacts/browser-proof/overview.png" });
  await page.getByRole("button", { name: "▶ 操作 App", exact: true }).click();
  let frame = page.frameLocator("iframe");
  await frame.locator("#manual").click();
  await frame.locator('[name=pain][value="2"]').check();
  await frame.locator(".save-capture").click();
  await frame.locator("#doctor-summary").waitFor();
  assert.match(await frame.locator("#view").innerText(), /已保存今次補記/);
  await frame
    .locator("#edit-event")
    .evaluate((form) => (form.closest("details").open = true));
  await frame.locator('#edit-event [name=pain][value="3"]').check();
  await frame.locator("#edit-event button.primary").click();
  await frame.locator("#message").filter({ hasText: "修正已保存" }).waitFor();
  await frame
    .locator("#view details")
    .filter({ has: frame.locator("summary", { hasText: "分析及修正紀錄" }) })
    .evaluate((d) => (d.open = true));
  assert.match(await frame.locator("#view").innerText(), /用戶修正 1 次/);
  await frame.locator("#delete-event").click();
  await frame.locator("dialog [data-cancel]").click();
  assert.equal(await frame.locator("#delete-event").count(), 1);
  await frame.locator("#delete-event").click();
  await frame.locator("dialog [data-confirm]").click();
  await frame.locator("#history-list .event-row").first().waitFor();
  assert.equal(await frame.locator("#history-list .event-row").count(), 4);
  await page.getByLabel("預覽狀態").selectOption("import-ready");
  frame = page.frameLocator("iframe");
  await frame.locator("#commit-import:not([disabled])").waitFor();
  await frame.locator("#commit-import").click();
  await frame.locator("#message").filter({ hasText: "已匯入 2 行" }).waitFor();
  assert.equal(await frame.locator("#meal-list .row").count(), 4);
  await page.getByLabel("預覽狀態").selectOption("import-xlsx");
  await frame.locator("#sheet").waitFor();
  assert.equal(await frame.locator("#sheet option").count(), 2);
  await frame.locator("#sheet").selectOption("1");
  await frame.locator("#map-form button").click();
  await frame
    .locator("#import-preview")
    .filter({ hasText: "雞肉飯（虛構）" })
    .waitFor();
  await page.getByLabel("預覽狀態").selectOption("data-originals");
  await frame.locator("[data-original]").first().check();
  const downloaded = page.waitForEvent("download");
  await frame.locator("#zip-export").click();
  const download = await downloaded;
  assert.equal(download.suggestedFilename(), "stoolsense-export.zip");
  assert.ok((await stat(await download.path())).size > 100);
  await frame.locator("#message").filter({ hasText: "匯出完成" }).waitFor();
  await page.getByLabel("預覽狀態").selectOption("capture-home");
  await frame.locator("#manual").click();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "App · 五個主頁" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".screen-frame").length === 5,
  );
  await page.waitForFunction(
    () => parseInt(document.querySelector(".zoom-label").textContent) > 25,
  );
  await page.screenshot({ path: ".artifacts/browser-proof/main-pages.png" });
  for (const width of [736, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `canvas overflow at ${width}px`,
    );
  }
  await page.getByRole("button", { name: "▶ 操作 App", exact: true }).click();
  await frame.locator("#manual").waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "mobile prototype overflow",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, [], "review never requests a remote service");
  if (hostedUrl) {
    // A screenshot export is insufficient: every hosted case must also boot
    // and all overview images must exist on the public/subpath deployment.
    let index = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (index < catalog.length) {
        const scenario = catalog[index++];
        const screen = hostedManifest.screens[scenario.id];
        const response = await fetch(new URL(screen.image, hostedUrl));
        assert.equal(response.status, 200, `missing hosted thumbnail ${scenario.id}`);
        assert.match(response.headers.get("content-type"), /image\/png/);
        const preview = await browser.newPage();
        const failures = [];
        preview.on("pageerror", (error) => failures.push(error.message));
        preview.on("request", (request) => {
          if (!request.url().startsWith(hostedUrl) && !request.url().startsWith("blob:")) failures.push(`Unexpected request ${request.url()}`);
        });
        try {
          await preview.goto(new URL(screen.url, hostedUrl).href);
          await preview.locator("html[data-review-ready]").waitFor();
          assert.equal(await preview.locator("html").getAttribute("data-review-ready"), "true", `hosted preview failed: ${scenario.id}`);
          assert.equal(await preview.locator("html").getAttribute("data-review-error"), null);
          assert.deepEqual(failures, [], scenario.id);
          if (scenario.id === "capture-preview-error") {
            await preview.locator("#preview-error:not([hidden])").waitFor();
            assert.equal(await preview.locator(".capture-preview img").isHidden(), true);
          } else {
            assert.equal(await preview.evaluate(() => [...document.images].every((img) => !img.complete || img.naturalWidth > 0)), true, `broken hosted image ${scenario.id}`);
          }
        } finally { await preview.close(); }
      }
    }));
    console.log(`PASS: all ${catalog.length} hosted interactive cases and thumbnails; no account, external requests or localhost runtime.`);
  }
  console.log(
    `PASS: ${catalog.length} actual-code screens; canvas, flows, save/edit/delete, CSV/Excel, ZIP, keyboard exit, responsive layout and isolated transport.`,
  );
} finally {
  await browser?.close();
  await app.close();
}
