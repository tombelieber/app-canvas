import assert from "node:assert/strict";
export { validatePopulationProof } from "./population-proof.mjs";
export async function verifyCanvas({ browser, address, project }) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
  try {
    await page.goto(address);
    await page.locator('.review-workspace[data-live-ready="true"][data-camera-ready="true"]').waitFor({ timeout: 45000 });
    // New large UI deliveries open grouped for people. Acceptance explicitly
    // expands the same complete model before checking every case/journey.
    await page.locator('.scope-selects select').nth(1).selectOption('all');
    await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
    await page.waitForFunction(count => document.querySelectorAll('.react-flow__node-screen').length === count, project.catalog.length);
    const caseIds=await page.locator('.react-flow__node-screen').evaluateAll(nodes=>nodes.map(node=>node.dataset.id).sort());
    assert.deepEqual(caseIds,project.catalog.map(item=>item.id).sort(),"all named cases remain addressable");
    assert.ok(await page.locator('.screen-frame').count()<=136,"card contents stay bounded independently of the complete case model");
    assert.ok(await page.locator("iframe[data-screen]").count() <= 8, "live UI instances stay within the desktop resource budget");
    assert.equal(await page.locator(".screen-frame img").count(), 0, "overview must not display screenshots");
    assert.equal(await page.locator(".render-error").count(), 0);
    await page.locator(".operate-app").click();
    await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
    const first = page.frameLocator(`iframe[data-screen="${project.catalog[0].id}"]`);
    await first.locator("html[data-review-ready=true]").waitFor();
    assert.ok((await page.locator(`iframe[data-screen="${project.catalog[0].id}"]`).boundingBox()).x >= 0, "wide controls remain reachable");
    await page.locator(".mode-switch button").first().click();
    assert.equal(await page.locator(".prototype-overlay").count(), 0, "interaction stays inside the canvas");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "desktop overflow");
    await verifyJourneys({ page, journeys: project.journeys });
  } finally { await page.close(); }
}

export async function verifyJourneys({ page, journeys = [], collectFailures = false, onResult = () => {} }) {
  if (!journeys.length) return;
  const failures = [];
  await page.locator(".scope-selects select").first().selectOption("all");
  if (!await page.locator(".journey-panel > label select").isVisible()) await page.locator(".playback-toggle").click();
  await page.locator(".journey-panel > label select").selectOption(journeys[0].id);
  await page.locator(".journey-controls > select").selectOption("0");
  for (const journey of journeys) {
    try {
    await page.locator(".journey-panel > label select").selectOption(journey.id);
    await page.locator(".journey-controls > button").first().click();
    await page.waitForFunction(() => ["complete", "error"].includes(document.querySelector(".journey-panel")?.dataset.status), null, { timeout: 30000 });
    assert.equal(await page.locator(".journey-panel").getAttribute("data-status"), "complete", `Journey ${journey.id}: ${await page.locator(".journey-panel").innerText()}`);
    assert.equal(await page.locator(".journey-panel").getAttribute("data-step"), String(journey.steps.length));
    await page.locator('.review-workspace[data-camera-ready="true"]').waitFor();
    assert.equal(await page.locator(".inspector code").innerText(), journey.steps.at(-1).screen);
    const bounds = await page.locator(".journey-live").boundingBox(), area = await page.locator(".flow-stage").boundingBox();
    assert.ok(bounds && bounds.x >= area.x && bounds.x + bounds.width <= area.x + area.width && bounds.y >= area.y, `Journey ${journey.id} terminal screen must be focused in the canvas`);
    onResult({ id: journey.id, passed: true });
    } catch (error) {
      onResult({ id: journey.id, passed: false, error: error.message });
      if (!collectFailures) throw error;
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} journeys failed:\n${failures.map(e=>e.message).join("\n")}`);
}
