import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent, languages, publicSiteUrl, publicDemoUrl, publicPageUrl, repository, commands } from "../launch/content.mjs";
import { renderSitemap, renderRobots, renderLlms } from "../launch/seo.mjs";
import { renderPage } from "../launch/pages.mjs";
import { syncReadmes } from "../launch/readmes.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
export async function buildLaunch(outDir, content) {
  content ||= await loadContent();
  const assets = join(outDir, "about/assets");
  await mkdir(assets, { recursive: true });
  for (const [from, to] of [["launch/launch.css", "launch.css"], ["launch/cloud.js", "cloud.js"], ["launch/analytics.js", "analytics.js"], ["docs/agent-reference.png", "reference.png"], ["docs/agent-reference-phone.png", "reference-phone.png"], ["docs/stoolsense-overview.jpg", "overview.jpg"], ["docs/stoolsense-flow.jpg", "flow.jpg"], ["docs/stoolsense-playback.jpg", "playback.jpg"], ["docs/stoolsense-iphone.png", "iphone.png"]])
    await copyFile(join(root, from), join(assets, to));
  await writeFile(join(assets, "icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="5" fill="#f6f8fb"/><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="#315be8" stroke-width="2"/><path d="m13 12 11 4-4 2-2 6-5-12Z" fill="#315be8" stroke="#f6f8fb" stroke-width="1.3"/></svg>');
  const urls = [publicSiteUrl];
  for (const locale of languages) for (const page of ["product", "start", "release"]) {
    const pathname = `about/${locale === "en" ? "" : `${locale}/`}${page === "product" ? "" : `${page}/`}`;
    const directory = join(outDir, pathname);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "index.html"), renderPage(locale, page, content));
    urls.push(publicPageUrl(locale, page));
  }
  await writeFile(join(outDir, "sitemap.xml"), renderSitemap([...urls, publicDemoUrl]));
  await writeFile(join(outDir, "robots.txt"), renderRobots(publicSiteUrl));
  await writeFile(join(outDir, "llms.txt"), renderLlms({ siteUrl: publicSiteUrl, demoUrl: publicDemoUrl, guideUrl: publicPageUrl("en", "start"), repository, version: content.facts.version, languages: languages.map(locale => ({ name: content.locales[locale].name, url: publicPageUrl(locale) })) }));
  await writeFile(join(outDir, "llms-full.txt"), await readAgentGuide(content));
  await writeFile(join(outDir, "about/launch.json"), JSON.stringify({ ...content.facts, brand: "Agent Canvas", languages, install: commands(content.facts).install, viewerLocale: "en", viewerLanguages: languages, demo: publicDemoUrl }, null, 2));
  return { pages: urls.length - 1, languages: languages.length };
}

async function readAgentGuide(content) {
  const { readFile } = await import("node:fs/promises");
  return `# Agent Canvas v${content.facts.version}\n\nCanonical repository: ${repository}\n\n${await readFile(join(root, "AGENT_GUIDE.md"), "utf8")}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = await loadContent();
  const checkOnly = process.argv.includes("--check");
  await syncReadmes(content, checkOnly);
  if (!checkOnly && !process.argv.includes("--readmes-only")) console.log(await buildLaunch(process.env.APP_CANVAS_STATIC_DIR || ".artifacts/site", content));
  else console.log(`${languages.length} language README files ${checkOnly ? "verified" : "generated"}`);
}
