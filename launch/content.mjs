import { readFile } from "node:fs/promises";
import { createJourneys } from "../examples/stoolsense/journeys.mjs";
import { caseCoverage } from "../lib/coverage.mjs";
import { demoLocaleForLocale } from "./demo-assets.mjs";

import { languages } from "../lib/locales.mjs";
export { languages };
const siteUrl = process.env.APP_CANVAS_SITE_URL || "https://tombelieber.github.io/app-canvas/";
export const baseUrl = new URL(siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`).href;
export const demoUrl = process.env.APP_CANVAS_DEMO_URL || baseUrl;
export const repository = "https://github.com/tombelieber/app-canvas";
export const personalRelease = "https://tomtang3.ai/blog/introducing-app-canvas/";
export const technicalArticle = "https://tomtang3.ai/blog/app-canvas-safari-rendering/";
const root = new URL("../", import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), "utf8"));

export async function loadContent() {
  const pkg = await json("package.json");
  const { catalog, ...project } = await json("examples/stoolsense/catalog.json");
  const journeys = createJourneys(catalog);
  const coverage = caseCoverage({ ...project, catalog, journeys });
  const facts = { version: pkg.version, states: catalog.length, flows: coverage.flows, entries: journeys.length };
  const locales = Object.fromEntries(await Promise.all(languages.map(async locale => [locale, await json(`launch/locales/${locale}.json`)])));
  validateLocales(locales, facts);
  return { facts, locales };
}

function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, shape(value[key])]));
  return typeof value;
}

export function validateLocales(locales, facts) {
  const expected = JSON.stringify(shape(locales.en));
  for (const locale of languages) {
    if (JSON.stringify(shape(locales[locale])) !== expected) throw Error(`Locale schema mismatch: ${locale}`);
    const visit = value => {
      if (typeof value === "string") {
        if (!value.trim()) throw Error(`Empty translation in ${locale}`);
        for (const [, key] of value.matchAll(/\{(\w+)\}/g)) if (!(key in facts)) throw Error(`Unknown fact ${key} in ${locale}`);
      } else for (const item of Object.values(value)) visit(item);
    };
    visit(locales[locale]);
    for (const key of ["states", "flows", "entries"]) {
      if (!JSON.stringify(locales[locale]).includes(`{${key}}`)) throw Error(`Missing shared fact ${key}: ${locale}`);
    }
  }
}

export const text = (value, facts) => value.replace(/\{(\w+)\}/g, (_, key) => facts[key]);
export const pagePath = (locale, page = "product") => `${new URL(baseUrl).pathname}about/${locale === "en" ? "" : `${locale}/`}${page === "product" ? "" : `${page}/`}`;
export const pageUrl = (locale, page = "product") => process.env.APP_CANVAS_SITE_URL && locale === "en" && page === "product" ? baseUrl : new URL(pagePath(locale, page), baseUrl).href;
export const publicSiteUrl = process.env.APP_CANVAS_SITE_URL || "https://agent-canvas-app.pages.dev/";
export const publicDemoUrl = process.env.APP_CANVAS_DEMO_URL || new URL("demo/", publicSiteUrl).href;
export function demoUrlForLocale(locale, rootUrl = demoUrl) {
  const actualLocale = demoLocaleForLocale(locale);
  const url = new URL(rootUrl);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  if (actualLocale !== "en") url.pathname += `${actualLocale}/`;
  url.searchParams.set("lang", actualLocale);
  return url.href;
}
export const publicPageUrl = (locale, page = "product") => locale === "en" && page === "product" ? publicSiteUrl : new URL(`about/${locale === "en" ? "" : `${locale}/`}${page === "product" ? "" : `${page}/`}`, publicSiteUrl).href;
export const readmePath = locale => locale === "en" ? "README.md" : `README.${locale}.md`;

export function commands(facts, locale = "en") {
  const pin = `github:tombelieber/app-canvas#v${facts.version}`;
  const demoCommand = `agent-canvas demo${demoLocaleForLocale(locale) === "zh-TW" ? " --locale zh-TW" : ""}`;
  return {
    install: `npm install --save-dev ${pin}\nnpx agent-canvas browsers`,
    try: `npm install -g ${pin}\nagent-canvas browsers\n${demoCommand}`,
    discover: "npx agent-canvas plan --source-root . --out ui-review/ui-inventory.json\nnpx agent-canvas status --inventory ui-review/ui-inventory.json",
    verify: "npx agent-canvas populate --config ui-review/canvas.config.mjs --source-root . --verify",
    review: "npm run ui:review",
    skill: "npx agent-canvas install --target both",
    prompt: `Read ${repository}/blob/v${facts.version}/AGENT_GUIDE.md and add a completely populated Agent Canvas to this repository. Discover all screens, components, variants, states and navigation from the whole application source. Use original UI code. Create the missing synthetic fixtures and render harnesses. Reconcile an independent source inventory with rendered cases and source-linked runtime checks. Add checked happy, failure and recovery journeys. Group by actual page and feature, connect checked flows, deduplicate repeated captures and resume checkpoints. Run --ui-complete against the original source root; keep the stricter --complete source audit separate and unchanged. Continue until the full landscape is populated and verified; report genuine blockers as incomplete. Keep production sessions, credentials and real user data out of previews.`,
  };
}
