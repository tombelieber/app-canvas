import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createHash, randomUUID } from 'node:crypto';
import { createStore } from './store.mjs';
import { toCanvasProject } from './adapter.mjs';
import { renderDocument, overviewContent } from './render.mjs';
import { validateProject } from '../protocol.mjs';
import { exportCanvas } from '../static.mjs';
import { bundleNotices } from '../licenses.mjs';
import { overviewDocument } from '../../ui/overview-document.js';

// Materialize the saved revision, including studies, without adopting/writing
// the source project or publishing its undo history or browser session.
export async function exportImportReview({ directory, outDir }) {
  const store = await createStore(directory, { readOnly: true });
  const state = await store.read();
  if (!state.project.screens.length) throw Error('No captured screens to export');
  const project = validateProject(toCanvasProject(state));
  const output = await mkdtemp(join(tmpdir(), 'app-canvas-review-'));
  const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
  try {
    const bundle = await build({ absWorkingDir: packageRoot, entryPoints: ['ui/canvas.jsx'], bundle: true, format: 'esm', target: ['safari16.4'], outfile: join(output, 'canvas.js'), define: { 'process.env.NODE_ENV': '"production"' }, minify: true, logLevel: 'silent', metafile: true });
    await writeFile(join(output, 'canvas-LICENSES.txt'), await bundleNotices(bundle.metafile, packageRoot));
    await writeFile(join(output, 'frame-bridge.js'), '');
    await writeFile(join(output, 'overview.html'), overviewDocument(randomUUID()));
    const fingerprint = createHash('sha256').update(await readFile(join(output, 'canvas.js'))).update(await readFile(join(output, 'canvas.css')));
    const screens = {};
    for (const screen of state.project.screens) {
      const doc = state.documents[screen.id];
      fingerprint.update(JSON.stringify(doc));
      await writeFile(join(output, `dom-${screen.id}.html`), renderDocument(doc, { assets: state.assets }));
      await writeFile(join(output, `dom-${screen.id}.json`), JSON.stringify(overviewContent(doc, state.assets)));
      screens[screen.id] = { width: doc.viewport.width, height: doc.height, domUrl: 'snapshot', sharedUrl: 'snapshot' };
    }
    const manifest = { status: 'ready', revision: state.project.revision, canvasHash: fingerprint.update(JSON.stringify(project)).update(JSON.stringify(state.assets)).digest('hex'), screens };
    return await exportCanvas({ output, outDir, project, preview: { exportDom: true }, manifest, reviewOnly: true });
  } finally { await rm(output, { recursive: true, force: true }); }
}
