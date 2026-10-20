import { randomUUID } from "node:crypto";
import { createStore } from "./store.mjs";
import { normalizeRendered } from "./capture.mjs";
import { agentResources } from "./agent-resources.mjs";
import { limits, plain, text, finite } from "./schema.mjs";
import { privateSurface, sourceUrl, redactText } from "./privacy.mjs";
export { captureScript } from "./reader.mjs";

export async function createAgentProject({ url, directory }) {
  const source = sourceUrl(url);
  const store = await createStore(directory, { create: true, source, title: new URL(source).hostname });
  return { directory: store.root, source, viewport: { width: 1440, height: 1000 }, mode: "agent", coverage: "observed" };
}

export function decodeSnapshot(input) {
  if (Array.isArray(input)) {
    if (input.length > 1000 || input.length < 2 || !/^\d+$/.test(input[0]) || input.some(part => typeof part !== "string")) throw Error("Invalid snapshot fragments");
    const expected = Number(input[0]);
    if (expected > limits.state || input.slice(1).reduce((sum, part) => sum + part.length, 0) !== expected) throw Error("Truncated or oversized snapshot fragments");
    input = JSON.parse(input.slice(1).join(""));
  }
  plain(input);
  if (input.paused) throw Error("Capture paused on a private authentication or credential surface");
  if (input.version !== 1 || typeof input.redacted !== "boolean") throw Error("Unsupported agent snapshot");
  if (Buffer.byteLength(JSON.stringify(input)) > limits.state * 2) throw Error("Agent snapshot exceeds transport budget");
  return input;
}

export async function ingestSnapshot({ directory, snapshot, label, action }) {
  const input = decodeSnapshot(snapshot), url = sourceUrl(input.url), rendered = structuredClone(plain(input.rendered));
  const store = await createStore(directory), project = await store.metadata();
  const source = project.source || project.screens[0]?.url;
  if (!source || new URL(url).origin !== new URL(source).origin) throw Error("Snapshot origin does not match the project source; create a separate project");
  if (privateSurface(url) && !input.redacted) throw Error("Credential-adjacent overview requires allowlisted redacted capture");
  if (new URL(rendered.baseUrl).origin !== new URL(url).origin) throw Error("Snapshot base origin does not match its source");
  finite(rendered.viewport?.width, 1000, 2400); finite(rendered.viewport?.height, 200, 4000);
  finite(rendered.height, rendered.viewport.height, limits.height);
  if (!Array.isArray(rendered.issues) || rendered.issues.length > 100 || !Array.isArray(rendered.families) || rendered.families.length > limits.nodes || !Array.isArray(rendered.embeddedStyles) || rendered.embeddedStyles.length > 1000) throw Error("Invalid rendered metadata");
  text(rendered.title, 10000);
  rendered.families.forEach(value => text(value, 1000));
  rendered.embeddedStyles.forEach(entry => { if (!Array.isArray(entry) || entry.length !== 2) throw Error("Invalid embedded font rule"); sourceUrl(entry[0]); text(entry[1], limits.asset); });
  if (input.redacted && ((input.resources || []).length || rendered.embeddedStyles.length)) throw Error("Redacted snapshots cannot include external resources");
  validateRenderedTree(rendered.root, input.redacted);
  const issues = [], resources = agentResources(input.resources || [], issues);
  rendered.issues.push(...issues);
  const trigger = action === undefined ? undefined : { id: `a-${randomUUID()}`, type: "navigate", label: redactText(text(action, 200)) };
  const capture = await normalizeRendered({ rendered, resources, url, label: label === undefined ? undefined : text(label, 200), reason: input.redacted ? "agent-redacted" : "agent", trigger });
  const result = await store.capture(capture, { metadataOnly: true });
  const observation = result.project.observations.at(-1), screen = result.project.screens.find(screen => screen.id === observation.screenId);
  return { directory: store.root, revision: result.project.revision, screenId: screen.id, quality: screen.quality, issues: screen.issues, states: result.project.screens.length, observations: result.project.observations.length, flows: result.project.flows.length };
}

export async function importStatus(directory) {
  const store = await createStore(directory), project = await store.metadata();
  const pages = new Map();
  for (const screen of project.screens) {
    if (!pages.has(screen.pageId)) pages.set(screen.pageId, { path: screen.pageId, states: 0, partial: 0 });
    const page = pages.get(screen.pageId); page.states++; if (screen.quality === "partial") page.partial++;
  }
  return { directory: store.root, coverage: "observed", revision: project.revision, source: project.source || project.screens[0]?.url,
    states: project.screens.length, observations: project.observations.length, flows: { observed: project.flows.filter(flow => flow.kind === "observed").length, reference: project.flows.filter(flow => flow.kind === "reference").length },
    savedEdits: project.cursor, pages: [...pages.values()], screens: project.screens.map(({ id, title, pageId, quality, issues }) => ({ id, title, path: pageId, quality, issues })) };
}

export async function linkStates({ directory, from, to, label }) {
  const store = await createStore(directory);
  return store.link({ from, to, label: text(label, 200) });
}

function validateRenderedTree(root, redacted) {
  const allowed = new Set(["id", "text", "tag", "attrs", "style", "rect", "scroll", "children", "resource", "uneditable"]);
  let count = 0;
  const visit = (node, depth) => {
    plain(node);
    if (++count > limits.nodes || depth > 100 || Object.keys(node).some(key => !allowed.has(key))) throw Error("Unsupported rendered layer or complexity limit");
    if (redacted && (node.resource || Object.values(node.style || {}).some(value => typeof value === "string" && /url\s*\(/i.test(value)) || Object.entries(node.attrs || {}).some(([key, value]) => ["src", "href"].includes(key) && !String(value).startsWith("#")))) throw Error("Redacted snapshots cannot include resource references");
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) throw Error("Invalid rendered children");
      node.children.forEach(child => visit(child, depth + 1));
    }
  };
  visit(root, 0);
}
