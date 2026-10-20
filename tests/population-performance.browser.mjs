import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Equivalent completed outputs: the same original app/fixtures, viewport and
// checks. Baseline repeats each capture for four evidence labels. Planning
// retains every label and combines read-only probes before touching the actor.
export async function measureCapturePlanning({ browser, preview, catalog, planCaptures, directory, sourceDigest }) {
  const viewport = { width: 390, height: 844 }, requests = catalog.flatMap(item => ['visible', 'ready', 'navigation', 'viewport'].map(observation => ({
    caseId: item.id + '-' + observation, stateId: item.id, pageId: item.pageId, feature: item.feature,
    entry: item.path, platform: 'web', layout: 'phone', locale: 'en', sourceDigest,
    buildFingerprint: sourceDigest, viewport, inputs: { scenario: item.id }, steps: ['seed-original-preview'], observe: [observation],
  })));
  const planned = planCaptures(requests), trials = [];
  await mkdir(directory, { recursive: true });
  const page = await browser.newPage({ viewport });
  async function run(jobs, mode) {
    const started = performance.now(), outputs = new Map();
    for (const job of jobs) {
      const item = catalog.find(row => row.id === job.stateId);
      await page.goto(preview.url(item));
      await page.locator('html[data-review-ready=true]').waitFor();
      await page.locator(item.ready).waitFor();
      for (const observation of job.observe) {
        if (observation === 'visible') assert.equal(await page.locator(item.ready).isVisible(), true);
        if (observation === 'ready') assert.equal(await page.locator('html').getAttribute('data-review-ready'), 'true');
        if (observation === 'navigation') assert.equal(await page.locator('nav a').count(), 2);
        if (observation === 'viewport') assert.deepEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })), viewport);
      }
      const pixels = await page.screenshot({ animations: 'disabled' });
      const digest = createHash('sha256').update(pixels).digest('hex');
      for (const id of job.caseIds) outputs.set(id, digest);
    }
    return { mode, elapsedMs: performance.now() - started, captures: jobs.length, labels: outputs.size, outputs };
  }
  try {
    // Warm Vite/fonts once; alternate order to avoid giving the planner an
    // exclusive warm-cache advantage. Keep all unaggregated trial values.
    await page.goto(preview.url(catalog[0])); await page.locator('html[data-review-ready=true]').waitFor();
    const baseline = requests.map(row => ({ ...row, caseIds: [row.caseId] }));
    for (let trial = 0; trial < 3; trial++) {
      const order = trial % 2 ? ['planned', 'baseline'] : ['baseline', 'planned'];
      const pair = {};
      for (const mode of order) pair[mode] = await run(mode === 'planned' ? planned.jobs : baseline, mode);
      assert.deepEqual([...pair.planned.outputs].sort(), [...pair.baseline.outputs].sort(), 'all evidence labels retain identical original UI pixels');
      trials.push({ trial: trial + 1, order, baselineMs: pair.baseline.elapsedMs, plannedMs: pair.planned.elapsedMs });
    }
  } finally { await page.close(); }
  const median = values => [...values].sort((a, b) => a - b)[1];
  const beforeMs = median(trials.map(row => row.baselineMs)), afterMs = median(trials.map(row => row.plannedMs));
  const report = { workload: '8 original React UI states, 4 independent read-only evidence labels each; 390x844 phone viewport; 3 alternating-order trials',
    sourceDigest, beforeCaptures: requests.length, afterCaptures: planned.captures, labelsRetained: requests.length,
    captureReductionPercent: 100 * (1 - planned.captures / requests.length), beforeMedianMs: beforeMs, afterMedianMs: afterMs,
    elapsedReductionPercent: 100 * (1 - afterMs / beforeMs), identicalPixelsForAllLabels: true, trials,
    limits: 'Synthetic React example; measures avoided repeated navigation/capture work, not GPU/FPS/native emulator speed or universal project duration.' };
  await writeFile(join(directory, 'capture-planning.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
