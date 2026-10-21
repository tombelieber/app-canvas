import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { projectFixture, documentFixture } from './fixtures/import-model.mjs';
import { exportImportReview } from '../lib/import/export.mjs';

test('captured review export materializes saved studies without source writes, history or local APIs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'import-review-')), directory = join(root, 'source');
  await mkdir(join(directory, 'documents'), { recursive: true });
  const project = projectFixture();
  project.history = [{ type: 'setText', screenId: 'screen-a', layerId: 'n3', value: 'Saved study' }]; project.cursor = 1;
  const original = JSON.stringify(project);
  await writeFile(join(directory, 'project.json'), original);
  await writeFile(join(directory, 'documents/doc-a.json'), JSON.stringify(documentFixture()));
  try {
    const outDir = join(root, 'site'), receipt = await exportImportReview({ directory, outDir });
    assert.equal(receipt.total, 1);
    assert.equal(await readFile(join(directory, 'project.json'), 'utf8'), original);
    assert.deepEqual((await readdir(directory)).sort(), ['documents', 'project.json']);
    const metadata = JSON.parse(await readFile(join(outDir, 'project.json')));
    assert.equal(metadata.reviewOnly, true); assert.equal(metadata.kind, undefined);
    assert.equal(metadata.sessionToken, undefined); assert.equal(metadata.history, undefined);
    assert.match(await readFile(join(outDir, 'assets/dom-screen-a.html'), 'utf8'), /Saved study/);
    assert.doesNotMatch(await readFile(join(outDir, 'manifest.json'), 'utf8'), /\/import\/|localhost|127\.0\.0\.1/);
    await assert.rejects(exportImportReview({ directory, outDir }), /exist/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});
