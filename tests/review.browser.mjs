import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from './locale-browser.mjs';
import { serveStatic } from './serve-static.mjs';
import { exportImportReview } from '../lib/import/export.mjs';
import { projectFixture, documentFixture } from './fixtures/import-model.mjs';
const root = await mkdtemp(join(tmpdir(), 'review-browser-')), source = join(root, 'source');
await mkdir(join(source, 'documents'), { recursive: true });
const project = projectFixture();
project.screens.push({ ...project.screens[0], id: 'screen-b', pageId: '/study', title: 'Saved study' });
project.flows = [{ id: 'reference-a', from: 'screen-a', to: 'screen-b', label: 'Study reference', kind: 'reference' }];
await writeFile(join(source, 'project.json'), JSON.stringify(project));
await writeFile(join(source, 'documents/doc-a.json'), JSON.stringify(documentFixture()));
const directory = process.env.APP_CANVAS_REVIEW_DIR || join(root, 'site');
if (!process.env.APP_CANVAS_REVIEW_DIR) await exportImportReview({ directory: source, outDir: directory });
const metadata = JSON.parse(await readFile(join(directory, 'project.json'))), manifest = JSON.parse(await readFile(join(directory, 'manifest.json')));
const host = await serveStatic(directory), browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], unwanted = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.method() !== 'GET' || /\/events(?:\?|$)|\/api\//.test(r.url()) || !r.url().startsWith(host.url) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) unwanted.push(r.url()); });
  await page.goto(host.url + '?lang=en');
  await page.locator('.review-workspace[data-live-ready="true"][data-camera-ready="true"]').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Interact', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Edit', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Start Demo', exact: true }).count(), 0);
  assert.equal(await page.locator('iframe[data-screen]').count(), 0);
  const first = metadata.catalog[0];
  await page.getByLabel('Search screens').fill(first.id);
  await page.locator(`[title="${first.id}"]`).click();
  await page.locator('.inspector code').waitFor();
  assert.equal(await page.locator('.inspector code').innerText(), first.id);
  const edge = metadata.flows.find(f => f.from === first.id || f.to === first.id);
  if (edge) { await page.locator('.inspector .flow-link').filter({ hasText: edge.label }).click(); assert.equal(await page.locator('.inspector code').innerText(), edge.from === first.id ? edge.to : edge.from); }
  if (process.env.APP_CANVAS_REVIEW_SCREENSHOT) await page.screenshot({ path: process.env.APP_CANVAS_REVIEW_SCREENSHOT });
  // Every exported full document boots under a nested path. The snapshots run
  // no app code and their embedded local images must still decode.
  for (const screen of Object.values(manifest.screens)) {
    await page.goto(new URL(screen.domUrl, host.url).href);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
    assert.equal(await page.locator('img').evaluateAll(images => images.filter(i => i.getAttribute('src') && !i.naturalWidth).length), 0);
  }
  assert.deepEqual(errors, []); assert.deepEqual(unwanted, []);
  console.log(`PASS: review browse/search/reference navigation, no mutation or events, ${metadata.catalog.length} documents and images under nested hosting`);
} finally { await browser.close(); await host.close(); await rm(root, { recursive: true, force: true }); }
