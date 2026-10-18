import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareCaptureProfile } from "../lib/import/profile.mjs";
test("only separate dedicated capture profiles can be reused", async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "canvas-profile-"))); t.after(() => rm(root, { recursive: true, force: true }));
  const project = join(root, "project"), profile = join(root, "profile"), daily = join(root, "daily");
  assert.equal(await prepareCaptureProfile(profile, project), profile);
  await writeFile(join(profile, "Local State"), "{}"); assert.equal(await prepareCaptureProfile(profile, project), profile);
  await mkdir(daily); await writeFile(join(daily, "Local State"), "{}");
  await assert.rejects(() => prepareCaptureProfile(daily, project), /dedicated|daily/i);
  await assert.rejects(() => prepareCaptureProfile(join(project, "profile"), project), /separate/i);
});
