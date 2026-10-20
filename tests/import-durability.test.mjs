import "./fixtures/import-storage.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, cp, lstat, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { createStore } from "../lib/import/store.mjs";
import { locationRisks } from "../lib/import/location.mjs";
import { listProjects, recoverProject } from "../lib/import/recovery.mjs";
import { backupProject } from "../lib/import/agent.mjs";
import { captureFixture } from "./fixtures/import-model.mjs";
import { inspectAsset } from "../lib/import/assets.mjs";
const exec = promisify(execFile);
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "canvas-durability-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function repository(root) {
  const repo = join(root, "repository"), worktree = join(root, "worktree");
  await mkdir(repo); await exec("git", ["init", repo]);
  await writeFile(join(repo, ".gitignore"), ".artifacts/\n");
  await exec("git", ["-C", repo, "add", ".gitignore"]);
  await exec("git", ["-C", repo, "-c", "user.name=Synthetic Test", "-c", "user.email=fixture@example.test", "commit", "-m", "fixture"]);
  await exec("git", ["-C", repo, "worktree", "add", "--detach", worktree]);
  return { repo, worktree };
}
async function tree(path) {
  const files = {};
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) for (const [name, bytes] of Object.entries(await tree(join(path, entry.name)))) files[`${entry.name}/${name}`] = bytes;
    else files[entry.name] = (await readFile(join(path, entry.name))).toString("base64");
  }
  return files;
}
test("capture/edit/save survives actual linked worktree removal with every document, asset, reference and redo operation", async t => {
  const root = await fixture(t), { repo, worktree } = await repository(root), directory = join(worktree, ".artifacts", "targets", "reference");
  const risks = await locationRisks(directory);
  assert.ok(risks.risks.some(risk => /ignored/.test(risk)));
  assert.ok(risks.risks.some(risk => /linked Git/.test(risk)));
  await assert.rejects(createStore(directory, { create: true }), /--allow-ephemeral/);
  await assert.rejects(lstat(directory), { code: "ENOENT" });
  const store = await createStore(directory, { create: true, allowEphemeral: true });
  const capture = captureFixture(), image = inspectAsset(pixel);
  capture.assets = [image]; capture.reference = pixel;
  capture.document.root.children.push({ id: "image", tag: "img", attrs: { src: `asset:${image.id}` }, style: {}, children: [] });
  let current = await store.capture(capture);
  const next = captureFixture("second"); next.document.root.children[0].children[0].text = "Menu open";
  next.source.trigger = { id: "menu-action", type: "click", label: "Open menu" };
  current = await store.capture(next);
  await store.link({ from: current.project.screens[1].id, to: current.project.screens[0].id, label: "Reference" });
  const replacement = Buffer.concat([pixel, Buffer.from("replacement")]);
  current = await store.asset(replacement, current.project.revision + 1);
  const id = current.project.screens[0].id;
  const history = [{ type: "setText", screenId: id, layerId: "n3", value: "Saved edit" }, { type: "setImage", screenId: id, layerId: "image", value: current.assetId }, { type: "duplicateScreen", screenId: id, newId: "alternative", value: "Alternative" }];
  await store.save({ expectedRevision: current.project.revision, history, cursor: 2 });
  const expected = await store.read(), bytes = await tree(directory), recoveryId = store.storage.recoveryId;
  await exec("git", ["-C", repo, "worktree", "remove", "--force", worktree]);
  await assert.rejects(lstat(directory), { code: "ENOENT" });
  assert.ok((await listProjects()).projects.some(project => project.recoveryId === recoveryId));
  const result = await recoverProject(recoveryId);
  assert.ok(result.directory.startsWith(join(process.env.APP_CANVAS_HOME, "projects")));
  assert.deepEqual(await tree(result.directory), bytes);
  const reopened = await createStore(result.directory);
  assert.deepEqual(await reopened.read(), expected);
  const redone = await reopened.save({ expectedRevision: expected.project.revision, history, cursor: 3 });
  assert.equal(redone.documents.alternative.root.children[0].children[0].text, "Saved edit");
  assert.ok(Object.values(redone.assets).some(asset => asset.data === replacement.toString("base64")));
});
test("old project directories are protected in place and portable backups reopen without the library", async t => {
  const root = await fixture(t), original = await createStore(join(root, "original"), { create: true, allowEphemeral: true });
  await original.capture(captureFixture());
  const legacy = join(root, "legacy"); await cp(original.root, legacy, { recursive: true });
  const before = await tree(legacy), adopted = await createStore(legacy);
  assert.equal(adopted.root, await (await import("node:fs/promises")).realpath(legacy));
  assert.deepEqual(await tree(legacy), before, "adoption never changes or relocates the existing format");
  const backup = await backupProject(legacy, { directory: join(root, "portable"), allowEphemeral: true });
  assert.deepEqual(await tree(backup.directory), before);
  const savedHome = process.env.APP_CANVAS_HOME;
  try {
    process.env.APP_CANVAS_HOME = join(root, "fresh-library");
    assert.deepEqual(await (await createStore(backup.directory)).read(), await adopted.read());
  } finally { process.env.APP_CANVAS_HOME = savedHome; }
});
test("SIGKILL between checkpoint and local commit preserves the newest history and prevents a silent rollback", async t => {
  const root = await fixture(t), store = await createStore(join(root, "project"), { create: true, allowEphemeral: true });
  const first = await store.capture(captureFixture()), id = first.project.screens[0].id;
  const script = `import fs from 'node:fs/promises'; import {syncBuiltinESMExports} from 'node:module';
    const {createStore}=await import(${JSON.stringify(pathToFileURL(new URL("../lib/import/store.mjs", import.meta.url).pathname).href)});
    const store=await createStore(${JSON.stringify(store.root)}); const original=fs.rename;
    fs.rename=async(from,to)=>{if(to===${JSON.stringify(join(store.root, "project.json"))}){console.log('checkpoint-ready');setInterval(()=>{},1000);await new Promise(()=>{});}return original(from,to);}; syncBuiltinESMExports();
    await store.save({expectedRevision:1,history:[{type:'setText',screenId:${JSON.stringify(id)},layerId:'n3',value:'Interrupted save'}],cursor:1});`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => child.kill("SIGKILL"));
  await new Promise((resolve, reject) => { let error = ""; child.stderr.on("data", data => error += data); child.once("exit", code => reject(Error(`Interrupted writer exited early (${code}): ${error}`))); child.stdout.once("data", data => String(data).includes("checkpoint-ready") ? resolve() : reject(Error(String(data)))); });
  await assert.rejects(createStore(store.root), /busy/);
  const exited = new Promise(resolve => child.once("exit", resolve)); child.kill("SIGKILL"); await exited;
  assert.equal(JSON.parse(await readFile(join(store.root, "project.json"))).revision, 1);
  // The production heartbeat lock expires after ten seconds, without manual deletion.
  await new Promise(resolve => setTimeout(resolve, 11000));
  await assert.rejects(createStore(store.root), /checkpoint is ahead/);
  const recovered = await recoverProject(store.storage.recoveryId), reopened = await createStore(recovered.directory);
  assert.equal((await reopened.read()).documents[id].root.children[0].children[0].text, "Interrupted save");
  await reopened.save({ expectedRevision: 2, history: [], cursor: 0 });
});
test("recovery failures reject a write before advancing the local project and keep the previous checkpoint usable", async t => {
  const root = await fixture(t), store = await createStore(join(root, "project"), { create: true, allowEphemeral: true });
  const current = await store.capture(captureFixture()), before = await tree(store.root);
  const history = [{ type: "setText", screenId: current.project.screens[0].id, layerId: "n3", value: "Uncommitted edit" }];
  const next = { ...current.baseProject, history, cursor: 1, revision: 2 };
  const hash = createHash("sha256").update(JSON.stringify(next)).digest("hex");
  await writeFile(join(process.env.APP_CANVAS_HOME, "objects", hash), "corrupt object");
  await assert.rejects(store.save({ expectedRevision: 1, history, cursor: 1 }), /integrity/);
  assert.deepEqual(await tree(store.root), before);
  const restored = await recoverProject(store.storage.recoveryId);
  assert.deepEqual(await tree(restored.directory), before);
});
test("recovery refuses corruption, symlink objects, path escapes and existing destinations", async t => {
  const root = await fixture(t), store = await createStore(join(root, "project"), { create: true, allowEphemeral: true });
  await store.capture(captureFixture());
  await assert.rejects(recoverProject(store.storage.recoveryId, { directory: store.root, allowEphemeral: true }), /already exists/);
  const pointer = join(process.env.APP_CANVAS_HOME, "checkpoints", `${store.storage.recoveryId}.json`), record = JSON.parse(await readFile(pointer));
  const file = record.files.find(file => file.path.startsWith("documents/")), object = join(process.env.APP_CANVAS_HOME, "objects", file.sha256), bytes = await readFile(object);
  t.after(async () => { await rm(object, { force: true }); await writeFile(object, bytes); await rm(pointer, { force: true }); });
  await writeFile(object, "truncated");
  const destination = join(root, "restore");
  await assert.rejects(recoverProject(store.storage.recoveryId, { directory: destination, allowEphemeral: true }), /integrity/);
  await assert.rejects(lstat(destination), { code: "ENOENT" });
  await rm(object); const outside = join(root, "outside"); await writeFile(outside, bytes); await symlink(outside, object);
  await assert.rejects(recoverProject(store.storage.recoveryId), /ELOOP/);
  await rm(object); await writeFile(object, bytes);
  record.files.push({ ...file, path: "../escaped" }); await writeFile(pointer, JSON.stringify(record));
  await assert.rejects(recoverProject(store.storage.recoveryId), /Invalid recovery file/);
  await rm(pointer); // Do not retain the deliberately corrupted synthetic record.
});
test("repository-owned projects remain ordinary shareable files; recovery storage cannot live in a checkout", async t => {
  const root = await fixture(t), { repo } = await repository(root), directory = join(repo, "designs", "reference");
  assert.ok(!(await locationRisks(directory)).risks.some(risk => /ignored|linked Git/.test(risk)));
  const store = await createStore(directory, { create: true, allowEphemeral: true }); await store.capture(captureFixture());
  await exec("git", ["-C", repo, "add", "designs"]);
  const tracked = (await exec("git", ["-C", repo, "ls-files", "designs"])).stdout;
  assert.match(tracked, /project.json/); assert.match(tracked, /documents\/doc-a.json/);
  assert.doesNotMatch(JSON.stringify(await store.metadata()), /recoveryId|recoveryDirectory/);
  const savedHome = process.env.APP_CANVAS_HOME;
  try { process.env.APP_CANVAS_HOME = join(repo, "ignored-library"); await assert.rejects(createStore(join(root, "other"), { create: true, allowEphemeral: true }), /outside Git/); }
  finally { process.env.APP_CANVAS_HOME = savedHome; }
});
test("standard temporary directories are explicit even when the OS default uses a different path", async () => {
  for (const path of ["/tmp/app-canvas-risk-check", "/var/tmp/app-canvas-risk-check"]) {
    assert.ok((await locationRisks(path)).risks.some(risk => /temporary/.test(risk)));
    await assert.rejects(createStore(path, { create: true }), /--allow-ephemeral/);
  }
});
