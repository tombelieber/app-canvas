import { mkdir, lstat, open, realpath, rename, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, join, dirname, relative } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { applyEdits } from "./patches.mjs";
import { identity, limits, validateDocument, validateProject } from "./schema.mjs";
import { inspectAsset } from "./assets.mjs";
import { redactText, sourceUrl } from "./privacy.mjs";
import { transformCss } from "./styles.mjs";

export async function createStore(directory, { create = false, title = "Imported product", source } = {}) {
  let root = resolve(directory);
  async function checked(path) {
    const target = resolve(root, path), parts = relative(root, target).split(/[\\/]/);
    if (parts.some(part => part === "..") || !target.startsWith(root + "/") && target !== root) throw Error("Project path escape");
    const roots = root.split("/").filter(Boolean); let current = "/";
    for (const part of [...roots, ...parts.filter(Boolean)]) {
      current = join(current, part); const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw Error("Symlink in import project path");
    }
    return target;
  }
  async function read(path, max) {
    const handle = await open(await checked(path), constants.O_RDONLY | constants.O_NOFOLLOW);
    try { if ((await handle.stat()).size > max) throw Error("Project file exceeds size limit"); return await handle.readFile(); } finally { await handle.close(); }
  }
  async function writeNew(path, buffer) {
    await checked(dirname(path));
    const handle = await open(join(root, path), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(buffer); await handle.sync(); } finally { await handle.close(); }
  }
  async function writeProject(project) {
    validateProject(project);
    const bytes = Buffer.from(JSON.stringify(project)); if (bytes.length > limits.state) throw Error("Project metadata exceeds size limit");
    const temp = `.project-${randomUUID()}.tmp`;
    await writeNew(temp, bytes);
    try { await checked("project.json"); await rename(join(root, temp), join(root, "project.json")); } finally { await rm(join(root, temp), { force: true }); }
  }
  async function locked(fn) {
    await checked(""); let handle;
    try { handle = await open(join(root, ".write-lock"), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
    catch (error) { if (error.code === "EEXIST") throw Object.assign(Error("Project busy; another writer holds the lock"), { code: "CONFLICT" }); throw error; }
    try { return await fn(); } finally { await handle.close(); await rm(join(root, ".write-lock")); }
  }
  if (create) {
    await mkdir(dirname(root), { recursive: true }); await mkdir(root, { mode: 0o700 }); root = await realpath(root); await checked("");
    for (const name of ["documents", "assets", "references"]) await mkdir(join(root, name), { mode: 0o700 });
    await writeNew("project.json", JSON.stringify({ kind: "web-import", version: 1, revision: 0, ...(source ? { source: sourceUrl(source) } : {}), title: redactText(title).slice(0, 200), viewport: { width: 1440, height: 1000 }, screens: [], flows: [], observations: [], assets: [], history: [], cursor: 0 }));
  }
  if ((await lstat(root)).isSymbolicLink()) throw Error("Symlink in import project path");
  root = await realpath(root); // macOS /var is an OS alias; only inspect the canonical root and its contents.
  await checked("");
  async function readBase() {
    const project = validateProject(JSON.parse(await read("project.json", limits.state))), bases = {}, assets = {}; let size = 0;
    for (const id of new Set(project.screens.map(screen => screen.documentId))) {
      identity(id); const bytes = await read(`documents/${id}.json`, limits.state); size += bytes.length;
      bases[id] = validateDocument(JSON.parse(bytes)); if (bases[id].id !== id) throw Error("Document identity mismatch");
    }
    for (const screen of project.screens) if (screen.referenceBytes) {
      const bytes = await read(`references/${screen.id}.png`, limits.asset);
      if (bytes.length !== screen.referenceBytes || inspectAsset(bytes).mime !== "image/png") throw Error("Reference integrity mismatch");
      size += bytes.length;
    }
    for (const asset of project.assets) {
      const bytes = await read(`assets/${asset.id}`, limits.asset); size += bytes.length;
      const verified = inspectAsset(bytes); if (verified.id !== asset.id || verified.mime !== asset.mime) throw Error("Asset integrity mismatch");
      assets[asset.id] = { mime: asset.mime, data: bytes.toString("base64") };
    }
    if (size > limits.project) throw Error("Project exceeds size limit");
    for (const doc of Object.values(bases)) requireAssets(doc, project.assets);
    return { project, bases, assets, size };
  }
  async function readCurrent() {
    const { project, bases, assets } = await readBase(), edited = applyEdits(project, bases);
    return { project: { ...project, screens: edited.screens }, documents: edited.documents, assets };
  }
  async function addAssets(project, incoming, currentSize, materializedAssets) {
    let size = currentSize;
    for (const item of incoming) {
      const asset = inspectAsset(item.body);
      if (item.id && asset.id !== item.id) throw Error("Asset integrity mismatch");
      if (project.assets.some(a => a.id === asset.id)) continue;
      size += asset.body.length; if (size > limits.project) throw Error("Project exceeds size limit");
      try { await writeNew(`assets/${asset.id}`, asset.body); } catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (!asset.body.equals(await read(`assets/${asset.id}`, limits.asset))) throw Error("Asset integrity mismatch");
      }
      project.assets.push({ id: asset.id, mime: asset.mime });
      if (materializedAssets) materializedAssets[asset.id] = { mime: asset.mime, data: asset.body.toString("base64") };
    }
  }
  return {
    root, read: readCurrent,
    async metadata() { return validateProject(JSON.parse(await read("project.json", limits.state))); },
    async base(id) { identity(id); return validateDocument(JSON.parse(await read(`documents/${id}.json`, limits.state))); },
    async capture(capture, { metadataOnly = false } = {}) {
      return locked(async () => {
        const { project, size, bases, assets } = await readBase();
        if (project.observations.length >= limits.observations) throw Error("Observation limit reached");
        validateDocument(capture.document);
        requireAssets(capture.document, [...project.assets, ...(capture.assets || []).map(asset => inspectAsset(asset.body))]);
        const bytes = Buffer.from(JSON.stringify(capture.document)); if (bytes.length > limits.state || size + bytes.length > limits.project) throw Error("Capture exceeds size limit");
        const edited = applyEdits(project, bases, project.history, project.cursor, bytes.length, { metadataOnly });
        const fingerprint = createHash("sha256").update(JSON.stringify({ root: capture.document.root, viewport: capture.document.viewport, height: capture.document.height, fonts: capture.document.fonts })).digest("hex");
        const url = sourceUrl(capture.source.url), previous = project.observations.at(-1)?.screenId;
        let screen = project.screens.find(s => s.fingerprint === fingerprint && s.pageId === new URL(url).pathname);
        if (!screen) {
          if (project.screens.length + project.history.filter(op => op.type === "duplicateScreen").length >= limits.states) throw Error("Screen limit reached");
          if (capture.reference && inspectAsset(capture.reference).mime !== "image/png") throw Error("Reference must be PNG");
          await addAssets(project, capture.assets || [], size + bytes.length + (capture.reference?.length || 0), assets);
          if (size + bytes.length + (capture.reference?.length || 0) > limits.project) throw Error("Project exceeds size limit");
          await writeNew(`documents/${capture.document.id}.json`, bytes);
          const label = redactText(capture.source.label || capture.source.title || new URL(url).pathname).slice(0, 200);
          screen = { id: `s-${randomUUID()}`, documentId: capture.document.id, title: label || "Captured state", url, pageId: new URL(url).pathname,
            viewport: capture.document.viewport, capturedAt: new Date().toISOString(), quality: capture.document.issues.length ? "partial" : "captured", issues: capture.document.issues, fingerprint };
          if (capture.reference) { screen.referenceBytes = capture.reference.length; await writeNew(`references/${screen.id}.png`, capture.reference); }
          project.screens.push(screen);
          edited.screens.splice(project.screens.length - 1, 0, structuredClone(screen));
          if (!metadataOnly) edited.documents[screen.id] = structuredClone(capture.document);
        }
        const trigger = capture.source.trigger;
        if (trigger) { identity(trigger.id); if (!["click", "change", "navigate", "keyboard"].includes(trigger.type)) throw Error("Unsupported action evidence"); }
        project.observations.push({ id: `o-${randomUUID()}`, screenId: screen.id, reason: capture.source.reason || "manual", ...(trigger ? { action: { id: trigger.id, type: trigger.type, label: redactText(trigger.label).slice(0, 200) } } : {}) });
        if (previous && previous !== screen.id && trigger) project.flows.push({ id: `f-${randomUUID()}`, from: previous, to: screen.id, label: redactText(trigger.label).slice(0, 200), actionId: trigger.id, kind: "observed" });
        project.revision++; await writeProject(project);
        const currentProject = { ...project, screens: edited.screens };
        return metadataOnly ? { project: currentProject } : { project: currentProject, documents: edited.documents, assets };
      });
    },
    async link({ from, to, label }) {
      return locked(async () => {
        const project = validateProject(JSON.parse(await read("project.json", limits.state)));
        if (project.flows.length >= 2048) throw Error("Flow limit reached");
        const flow = { id: `f-${randomUUID()}`, from, to, label: redactText(label).slice(0, 200), kind: "reference" };
        project.flows.push(flow); project.revision++; await writeProject(project); return flow;
      });
    },
    async save({ expectedRevision, history, cursor }) {
      return locked(async () => {
        const { project, bases, assets } = await readBase();
        if (project.revision !== expectedRevision) throw Object.assign(Error("Project revision conflict; reload before saving"), { code: "CONFLICT" });
        const edited = applyEdits(project, bases, history, cursor); project.history = history; project.cursor = cursor; project.revision++;
        await writeProject(project); return { project: { ...project, screens: edited.screens }, documents: edited.documents, assets };
      });
    },
    async asset(body, expectedRevision) {
      return locked(async () => {
        const { project, size } = await readBase();
        if (project.revision !== expectedRevision) throw Object.assign(Error("Project revision conflict"), { code: "CONFLICT" });
        const asset = inspectAsset(body); if (!asset.mime.startsWith("image/")) throw Error("Image replacement requires a raster image");
        await addAssets(project, [asset], size); project.revision++; await writeProject(project); return { ...(await readCurrent()), assetId: asset.id };
      });
    },
  };
}
function requireAssets(document, assets) {
  const available = new Set(assets.map(asset => asset.id));
  const references = [];
  const collect = value => { if (value.startsWith("asset:")) references.push(value.slice(6)); return value; };
  const visit = node => {
    for (const value of Object.values(node.style || {})) if (/url\s*\(/i.test(value)) transformCss(value, collect);
    for (const [key, value] of Object.entries(node.attrs || {})) {
      if (["src", "href"].includes(key)) collect(value);
      else if (["fill", "stroke", "mask", "clip-path"].includes(key)) transformCss(value, collect);
    }
    node.children?.forEach(visit);
  };
  visit(document.root);
  references.push(...document.fonts.map(font => font.asset));
  for (const id of references) if (!available.has(id)) throw Error("Missing local asset");
}
