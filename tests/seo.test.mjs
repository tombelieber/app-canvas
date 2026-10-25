import test from "node:test";
import assert from "node:assert/strict";
import { seoMetadata, renderSitemap, renderRobots, renderLlms } from "../launch/seo.mjs";

const siteUrl = "https://agent-canvas-app.pages.dev/";
const base = { siteUrl, url: siteUrl, locale: "en", page: "product", version: "0.16.0", title: "Build with agents. Shape it live.", description: "Real app review." };

test("root metadata keeps brand, canonical, free offer and WebSite identity consistent", () => {
  const metadata = seoMetadata(base);
  assert.equal(metadata.title, "Agent Canvas — Visual Workspace for Claude Code & Codex");
  assert.equal(metadata.url, siteUrl);
  assert.match(metadata.description, /real app/);
  const app = metadata.structuredData.find(value => value["@type"] === "SoftwareApplication");
  assert.equal(app.name, "Agent Canvas");
  assert.equal(app.softwareVersion, "0.16.0");
  assert.equal(app.offers.price, "0");
  assert.equal(app.aggregateRating, undefined);
  assert.equal(app.review, undefined);
  const site = metadata.structuredData.find(value => value["@type"] === "WebSite");
  assert.equal(site.name, app.name);
  assert.equal(site.url, app.url);
});

test("localized and guide pages retain their own content and avoid competing site identities", () => {
  const metadata = seoMetadata({ ...base, locale: "zh-TW", page: "start", url: `${siteUrl}about/zh-TW/start/`, title: "開始使用", description: "從真實 app 開始。", steps: [["安裝", "使用已發布版本。"]] });
  assert.equal(metadata.title, "開始使用 | Agent Canvas");
  assert.equal(metadata.description, "從真實 app 開始。");
  assert.ok(!metadata.structuredData.some(value => value["@type"] === "WebSite"));
  assert.equal(metadata.structuredData.find(value => value["@type"] === "HowTo").step[0].text, "使用已發布版本。");
  const story = seoMetadata({ ...base, page: "release", url: `${siteUrl}about/release/`, title: "Why Agent Canvas" });
  assert.equal(story.structuredData.find(value => value["@type"] === "Article").datePublished, undefined);
});

test("canonical input rejects foreign origins, credential-bearing and query URLs", () => {
  assert.throws(() => seoMetadata({ ...base, url: "https://example.com/" }), /canonical site origin/);
  assert.throws(() => seoMetadata({ ...base, siteUrl: "https://secret@example.com/" }), /without credentials/);
  assert.throws(() => seoMetadata({ ...base, url: `${siteUrl}?campaign=1` }), /query or fragment/);
  assert.throws(() => renderSitemap(["javascript:alert(1)"]), /HTTP/);
});

test("sitemap and robots list canonical URLs without duplicates or stale GitHub host", () => {
  const sitemap = renderSitemap([siteUrl, `${siteUrl}about/start/`, siteUrl]);
  assert.equal((sitemap.match(/<loc>/g) || []).length, 2);
  assert.ok(!sitemap.includes("github.io"));
  assert.equal(renderRobots(siteUrl), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);
  assert.throws(() => renderSitemap([`${siteUrl}#preview`]), /query or fragment/);
});

test("agent discovery text connects a real install path with explicit hosted/native limits", () => {
  const text = renderLlms({ siteUrl, demoUrl: `${siteUrl}demo/`, guideUrl: `${siteUrl}about/start/`, version: "0.16.0", languages: [{ name: "繁體中文", url: `${siteUrl}about/zh-TW/` }] });
  assert.match(text, /# Agent Canvas/);
  assert.match(text, /v0\.16\.0\/AGENT_GUIDE\.md/);
  assert.match(text, /Installation alone does not populate/);
  assert.match(text, /does not edit your repository or run an LLM/);
  assert.match(text, /Captures are not live native controls/);
  assert.match(text, /\/about\/zh-TW\//);
  assert.ok(!text.includes("# App Canvas"));
});
