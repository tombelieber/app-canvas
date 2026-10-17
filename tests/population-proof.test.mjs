import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import * as verification from "../lib/verify.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "app-canvas-native-proof-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const capture = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==", "base64");
  await writeFile(join(root, "denied.png"), capture);
  return {
    root,
    project: { catalog: [{ id: "denied" }], sourceCoverageReport: { digest: "current-source", requiredEvidence: { denied: [{ id: "error-branch", platform: "ios" }] } } },
    proof: { sourceDigest: "current-source", cases: [{ id: "denied", runtime: "native", platform: "ios", buildId: "test-build", fixtureId: "invalid-login", capture: { path: "denied.png", sha256: createHash("sha256").update(capture).digest("hex") }, assertions: [{ id: "invalid-login-visible", passed: true, sources: ["error-branch"] }] }] },
  };
}

test("complete native population requires source-linked state assertions and intact captures", async t => {
  const f = await fixture(t);
  assert.equal(typeof verification.validatePopulationProof, "function", "native population proof validation is missing");
  await verification.validatePopulationProof(f);
  await writeFile(join(f.root, "denied.png"), "changed capture");
  await assert.rejects(() => verification.validatePopulationProof(f), /capture.*changed|capture.*integrity/i);
});

test("a viewer-only hook or a stale build cannot complete native population", async t => {
  const f = await fixture(t);
  assert.equal(typeof verification.validatePopulationProof, "function", "native population proof validation is missing");
  await assert.rejects(() => verification.validatePopulationProof({ ...f, proof: undefined }), /runtime evidence/i);
  f.proof.sourceDigest = "older-source";
  await assert.rejects(() => verification.validatePopulationProof(f), /source.*revision|source.*digest/i);
});

test("an Android capture cannot satisfy an iOS state and missing assertions stay incomplete", async t => {
  const f = await fixture(t);
  assert.equal(typeof verification.validatePopulationProof, "function", "native population proof validation is missing");
  f.proof.cases[0].platform = "android";
  await assert.rejects(() => verification.validatePopulationProof(f), /missing.*evidence|platform/i);
  f.proof.cases[0].platform = "ios";
  f.proof.cases[0].assertions = [];
  await assert.rejects(() => verification.validatePopulationProof(f), /assertion|missing.*evidence/i);
});

test("an explicitly declared web target accepts original DOM evidence", async t => {
  const f = await fixture(t);
  f.project.sourceCoverageReport.requiredEvidence.denied[0].platform = "web";
  f.proof.cases[0].runtime = "web";
  delete f.proof.cases[0].capture;
  delete f.proof.cases[0].platform;
  await verification.validatePopulationProof(f);
});
