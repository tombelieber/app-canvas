import assert from "node:assert/strict";
export async function verifyCanvas({ browser, address, project }) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
  try {
    await page.goto(address);
    await page.locator('.review-workspace[data-live-ready="true"]').waitFor({ timeout: 45000 });
    assert.equal(await page.locator(".screen-frame iframe").count(), project.catalog.length, "all named cases render live DOM");
    assert.equal(await page.locator(".screen-frame img").count(), 0, "overview must not display screenshots");
    assert.equal(await page.locator(".render-error").count(), 0);
    await page.getByRole("button", { name: "▶ 操作 App", exact: true }).click();
    await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
    const first = page.frameLocator(`iframe[data-screen="${project.catalog[0].id}"]`);
    await first.locator("html[data-review-ready=true]").waitFor();
    assert.ok((await page.locator(`iframe[data-screen="${project.catalog[0].id}"]`).boundingBox()).x >= 0, "wide controls remain reachable");
    await page.getByRole("button", { name: "停止操作 · 保留畫面" }).click();
    assert.equal(await page.locator(".prototype-overlay").count(), 0, "interaction stays inside the canvas");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "desktop overflow");
    await verifyJourneys({ page, journeys: project.journeys });
  } finally { await page.close(); }
}

export async function verifyJourneys({ page, journeys = [] }) {
  if (!journeys.length) return;
  await page.getByLabel("播放速度").selectOption("0");
  for (const journey of journeys) {
    await page.getByLabel("播放流程").selectOption(journey.id);
    await page.getByRole("button", { name: "▶ 播放", exact: true }).click();
    await page.waitForFunction(() => ["complete", "error"].includes(document.querySelector(".journey-panel")?.dataset.status), null, { timeout: 30000 });
    assert.equal(await page.locator(".journey-panel").getAttribute("data-status"), "complete", `Journey ${journey.id}: ${await page.locator(".journey-panel").innerText()}`);
    assert.equal(await page.locator(".journey-panel").getAttribute("data-step"), String(journey.steps.length));
    await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
    assert.equal(await page.locator(".inspector code").innerText(), journey.steps.at(-1).screen);
    const bounds = await page.locator(".journey-live").boundingBox(), area = await page.locator(".flow-stage").boundingBox();
    assert.ok(bounds && bounds.x >= area.x && bounds.x + bounds.width <= area.x + area.width && bounds.y >= area.y, `Journey ${journey.id} terminal screen must be focused in the canvas`);
  }
}
