import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from 'playwright';
import { startCanvas } from '../lib/server.mjs';

const ids = Array.from({ length: 260 }, (_, i) => 'case-' + String(i).padStart(3, '0'));
const catalog = ids.map((id, i) => ({ id, title: id, group: 'app', pageId: 'page-' + Math.floor(i / 65), feature: 'Feature ' + Math.floor(i % 65 / 13), viewport: { width: 390, height: 844 } }));
const base = { title: 'Grouped app landscape', groups: [{ id: 'app' }], pages: Array.from({ length: 4 }, (_, i) => ({ id: 'page-' + i, title: 'Page ' + (i + 1) })), catalog,
  flows: [{ from: ids[0], to: ids.at(-1), label: 'Continue to final state' }],
  journeys: [...catalog.map(item => ({ id: 'check-' + item.id, kind: 'case', title: item.title, entry: item.id, steps: [{ title: item.title, screen: item.id, actions: [{ type: 'expect', selector: 'h1', text: item.id }] }] })), { id: 'continue', kind: 'flow', title: 'Continue with retained input', entry: ids[0], steps: [{ title: 'Enter a value', screen: ids[0], actions: [{ type: 'fill', selector: 'input', value: 'Player state' }, { type: 'expect', selector: 'input', value: 'Player state' }] }, { title: 'Continue', screen: ids.at(-1), actions: [{ type: 'click', selector: 'button' }, { type: 'expect', selector: 'h1', text: ids.at(-1) }, { type: 'expect', selector: 'output', text: 'Player state' }] }] }],
  preview: ctx => ({ url: item => ctx.canvasOrigin + '/original/' + item.id, handle(req, res, url) {
    if (!url.pathname.startsWith('/original/')) return false;
    const id = url.pathname.split('/').at(-1); if (!ids.includes(id)) return false;
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html data-review-ready="true"><head><style>body{margin:0;padding:24px;background:#f8f4e9;font:20px system-ui;min-height:844px;box-sizing:border-box}input,button{display:block;font:inherit;margin:18px 0;width:100%;box-sizing:border-box}output{display:block;color:#236b46}</style></head><body><h1>${id}</h1><label>Draft<input></label><button>Continue</button><output></output><script>document.querySelector('button').onclick=()=>{document.querySelector('output').value=document.querySelector('input').value;document.querySelector('h1').textContent='case-259'}</script></body></html>`);
    return true;
  } }),
};
let before, after;
try {
  before = await startCanvas({ config: base, port: 0, watchFiles: false });
  // This fixture qualifies only viewer grouping; full source/UI acceptance is
  // exercised independently through the fresh packed React app onboarding.
  after = await startCanvas({ config: { ...base, uiCoverage: { inventory: 'viewer-fixture-only' } }, port: 0, watchFiles: false });
  await Promise.all([before.firstBuild, after.firstBuild]);
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
      const ready = () => page.locator('.review-workspace[data-live-ready=true][data-camera-ready=true]').waitFor();
      if (engine === chromium && process.env.APP_CANVAS_SCREENSHOT_DIR) {
        const out = resolve(process.env.APP_CANVAS_SCREENSHOT_DIR); await mkdir(out, { recursive: true });
        for (const [size, viewport] of [['desktop', { width: 1512, height: 982 }], ['phone', { width: 390, height: 844 }]]) {
          await page.setViewportSize(viewport);
          for (const [label, app] of [['before', before], ['after', after]]) {
            await page.goto(app.address); await ready();
            await page.frameLocator('iframe[data-overview]').locator('[data-preview]').first().waitFor({ state: 'attached' });
            await page.screenshot({ path: resolve(out, `${label}-${size}.png`), animations: 'disabled' });
          }
        }
        await page.setViewportSize({ width: 1512, height: 982 });
      }
      await page.goto(after.address); await ready();
      assert.equal(await page.getByLabel('Expansion depth').inputValue(), '1');
      assert.equal(await page.locator('.react-flow__node-screen:visible').count(), 20, '260 states start as 20 page/feature representatives');
      await page.getByLabel('Expansion depth').selectOption('all'); await ready();
      assert.equal(await page.locator('.react-flow__node-screen').count(), 260);
      await page.getByLabel('Expansion depth').selectOption('1'); await ready();
      async function select(id) { await page.getByLabel('Search screens').fill(id); await page.locator(`button[title="${id}"]`).click(); await ready(); }
      await select(ids[0]); await page.locator('.operate-app').click(); await ready();
      const original = page.frameLocator(`iframe[data-screen="${ids[0]}"]`);
      await original.getByLabel('Draft').fill('Retained draft');
      await page.locator('.inspector .flow-link').click(); await ready();
      await page.locator('.inspector code').filter({ hasText: /^case-259$/ }).waitFor();
      await select(ids[0]); assert.equal(await original.getByLabel('Draft').inputValue(), 'Retained draft');
      // Reset only browse filters. The existing retained iframe must survive
      // grouped -> all -> grouped and the continuing Demo's separate session.
      await page.getByLabel('Search screens').fill(''); await page.getByLabel('Page scope').selectOption('all');
      await page.locator('.demo-start').click();
      // This check owns the authored continuing flow. The whole-app playlist
      // also includes 260 standalone fixtures and has its own bulk-playback gates.
      await page.getByLabel('Demo scope', { exact: true }).selectOption('continue');
      await page.getByLabel('Demo speed', { exact: true }).selectOption('0');
      const player = page.locator('.demo-player');
      try {
        await page.waitForFunction(() => ['complete', 'error'].includes(document.querySelector('.demo-player')?.dataset.status));
      } catch (error) {
        throw Error(`Grouped flow did not finish: ${await player.innerText()}`, { cause: error });
      }
      assert.equal(await player.getAttribute('data-status'), 'complete', await player.innerText());
      assert.equal(await page.getByLabel('Demo scope', { exact: true }).inputValue(), 'continue');
      assert.equal(await player.getAttribute('data-finished'), '1');
      assert.equal(await player.getAttribute('data-skipped'), '0');
      assert.equal(await page.frameLocator('iframe[data-screen="journey"]').locator('output').innerText(), 'Player state');
      await page.keyboard.press('Escape'); await ready();
      assert.equal(await original.getByLabel('Draft').inputValue(), 'Retained draft');
      console.log(`PASS ${engine.name()}: 260 states → 20 initial feature representatives, all states/search/cross-page links, retained original input and continuing Demo`);
    } finally { await browser.close(); }
  }
} finally { await before?.close(); await after?.close(); }
