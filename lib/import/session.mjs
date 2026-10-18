import { chromium } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createStore } from "./store.mjs";
import { observeResources } from "./resources.mjs";
import { capturePage } from "./capture.mjs";
import { installRecorder } from "./recorder.js";
import { redactText, sourceUrl } from "./privacy.mjs";
import { limits } from "./schema.mjs";
import { prepareCaptureProfile } from "./profile.mjs";

export async function startCaptureSession({ url, directory, headless = false, record = true, onChange = () => {}, profile }) {
  sourceUrl(url);
  if (profile) profile = await prepareCaptureProfile(profile, directory);
  const store = await createStore(directory, { create: true, title: new URL(url).hostname });
  const ownedProfile = !profile, profilePath = profile || await mkdtemp(join(tmpdir(), "app-canvas-profile-"));
  let context;
  try { context = await chromium.launchPersistentContext(profilePath, { headless, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce", acceptDownloads: false }); }
  catch (error) { if (ownedProfile) await rm(profilePath, { recursive: true, force: true }); throw error; }
  const page = context.pages()[0] || await context.newPage(), resources = observeResources(page);
  const status = { phase: "starting", message: "Opening capture browser", states: 0, observations: 0 }, subscribers = new Set([onChange]);
  let timer, deadline, pendingAction, queue = Promise.resolve(), closed = false, started = false, serial = 0;
  const update = patch => { Object.assign(status, patch); for (const callback of subscribers) callback({ ...status }); };
  const enqueue = (label, reason = "manual") => {
    const action = pendingAction; pendingAction = undefined;
    const work = queue.then(async () => {
      if (closed) return;
      if (status.states >= limits.states || status.observations >= limits.observations) { update({ phase: "limited", message: "Session limit reached; saved states are available. Start a new session to continue." }); return; }
      const capture = await capturePage({ page, resources, label, reason, trigger: action });
      if (capture.paused) { update({ phase: "paused", message: capture.reason }); return; }
      const result = await store.capture(capture);
      update({ phase: "recording", message: "State saved", states: result.project.screens.length, observations: result.project.observations.length }); return result;
    });
    queue = work.catch(() => { update({ phase: "error", message: "Capture failed; previous states remain saved. Retry Capture State after the page settles." }); });
    return work;
  };
  const schedule = (reason = "mutation") => {
    if (!started || closed || !record) return;
    clearTimeout(timer);
    const flush = timedOut => { clearTimeout(timer); clearTimeout(deadline); timer = deadline = undefined; void enqueue(undefined, timedOut ? "settling-timeout" : reason).catch(() => {}); };
    timer = setTimeout(() => flush(false), 320); deadline ||= setTimeout(() => flush(true), 10000);
  };
  const cdp = await context.newCDPSession(page), contexts = new Set();
  await cdp.send("Runtime.enable"); await cdp.send("Page.enable");
  cdp.on("Runtime.executionContextCreated", ({ context: world }) => { if (world.name === "app-canvas-recorder") contexts.add(world.id); });
  cdp.on("Runtime.executionContextDestroyed", ({ executionContextId }) => contexts.delete(executionContextId));
  cdp.on("Runtime.bindingCalled", event => {
    if (!contexts.has(event.executionContextId) || event.name !== "__appCanvasRecord" || event.payload.length > 2048 || closed) return;
    try {
      const message = JSON.parse(event.payload);
      if (message.kind === "action" && message.action && ["click", "change"].includes(message.action.type)) {
        pendingAction = { id: `a-${randomUUID()}`, type: message.action.type, label: redactText(message.action.label).slice(0, 200) }; schedule("action");
      } else if (message.kind === "mutation") schedule();
      else if (message.kind === "capture") void enqueue(undefined, "manual").catch(() => {});
    } catch { /* untrusted/malformed event does not cross the driver boundary */ }
  });
  await cdp.send("Runtime.addBinding", { name: "__appCanvasRecord", executionContextName: "app-canvas-recorder" });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(${installRecorder.toString()})()`, worldName: "app-canvas-recorder" });
  page.on("domcontentloaded", () => { if (started) schedule("navigation"); });
  const ready = (async () => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});
    await enqueue(undefined, "initial"); started = true;
  })().catch(error => { update({ phase: "error", message: "Could not open the requested page; capture browser remains available." }); throw error; });
  return {
    page, context, store, status, ready,
    subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
    async capture(label) {
      // Flush this CDP channel before reading action evidence. Playwright's
      // click completion arrives on a different connection from the recorder.
      await cdp.send("Runtime.evaluate", { expression: "void 0" });
      clearTimeout(timer); clearTimeout(deadline); timer = deadline = undefined; return enqueue(label);
    },
    async whenIdle() {
      // A completion barrier for tests/agents; production capture is event-driven.
      await page.waitForTimeout(650); clearTimeout(timer); clearTimeout(deadline); const pending = !!timer; timer = deadline = undefined;
      if (pending) await enqueue(undefined, "settled"); await queue;
    },
    async close() { if (closed) return; closed = true; clearTimeout(timer); clearTimeout(deadline); await queue; await resources.close(); await context.close(); if (ownedProfile) await rm(profilePath, { recursive: true, force: true }); update({ phase: "closed", message: "Capture browser closed; local project retained" }); },
  };
}
