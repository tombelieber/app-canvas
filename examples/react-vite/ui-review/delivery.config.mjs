import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { discoverUi } from '@tombelieber/agent-canvas/inventory';
import { populationFingerprint } from '@tombelieber/agent-canvas/population';
import base from './canvas.config.mjs';

export default {
  ...base,
  coverage: { requireAllCases: true, requireConnected: true },
  uiCoverage: { inventory: 'ui-review/ui-inventory.json' },
  async population({ root }) {
    const discovery = await discoverUi(root, { exclude: ['ui-review/ui-inventory.json'] });
    return { concurrency: 2, tasks: [{ id: 'inspect-example', kind: 'prepare', fingerprint: populationFingerprint(discovery.files), command: [process.execPath, 'ui-review/prepare.mjs'], resources: [], artifacts: ['ui-review/ui-inventory.json', '.artifacts/app-canvas/inspected.json'] }] };
  },
  async verifyUi(context) {
    const { browser, preview, uiCoverage } = context;
    await base.verify(context);
    const page = await browser.newPage(), cases = [];
    try {
      for (const item of base.catalog) {
        await page.goto(preview.url(item));
        await page.locator('html[data-review-ready=true]').waitFor();
        await page.locator(item.ready).waitFor();
        cases.push({ id: item.id, runtime: 'web', buildId: uiCoverage.digest, fixtureId: item.id, assertions: [{ id: item.id + '-visible', passed: true, sources: [item.id] }] });
      }
      const inventory = JSON.parse(await readFile('ui-review/ui-inventory.json', 'utf8'));
      for (const transition of inventory.transitions.filter(row => ['action', 'recovery'].includes(row.kind))) {
        const journey = base.journeys.find(row => row.id === transition.journey);
        await page.goto(preview.url(base.catalog.find(row => row.id === journey.entry)));
        await page.locator('html[data-review-ready=true]').waitFor();
        let previous = journey.entry;
        for (const step of journey.steps) {
          for (const action of step.actions) {
            const element = page.locator(action.selector);
            if (action.type === 'click') await element.click();
            else if (action.type === 'fill') await element.fill(action.value);
            else if (action.type === 'expect') { await element.waitFor(); if (action.text) assert.match(await element.innerText(), new RegExp(action.text)); }
          }
          // Continue in the same page; no reseeding between flow steps.
          if (previous === transition.from && step.screen === transition.to) cases.find(row => row.id === transition.to).assertions.push({ id: transition.id + '-performed', passed: true, sources: [transition.id] });
          previous = step.screen;
        }
      }
      assert.deepEqual(await page.evaluate(() => globalThis.__appCanvas.requests), []);
    } finally { await page.close(); }
    return { sourceDigest: uiCoverage.digest, cases };
  },
};
