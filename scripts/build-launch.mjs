import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent, languages, baseUrl, pageUrl, repository, commands } from "../launch/content.mjs";
import { renderPage } from "../launch/pages.mjs";
import { syncReadmes } from "../launch/readmes.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
export async function buildLaunch(outDir, content) {
  content ||= await loadContent();
  const assets = join(outDir, "about/assets");
  await mkdir(assets, { recursive: true });
  for (const [from, to] of [["launch/launch.css", "launch.css"], ["launch/cloud.js", "cloud.js"], ["docs/stoolsense-overview.jpg", "overview.jpg"], ["docs/stoolsense-flow.jpg", "flow.jpg"], ["docs/stoolsense-playback.jpg", "playback.jpg"], ["docs/stoolsense-iphone.png", "iphone.png"]])
    await copyFile(join(root, from), join(assets, to));
  await writeFile(join(assets, "icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#216e72"/><path d="M14 14h36v36H14zm0 12h36M26 14v36M38 14v36M14 38h36" fill="none" stroke="white" stroke-width="3"/></svg>');
  const urls = [baseUrl];
  for (const locale of languages) for (const page of ["product", "start", "release"]) {
    const pathname = new URL(pageUrl(locale, page)).pathname.replace("/app-canvas/", "");
    const directory = join(outDir, pathname);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "index.html"), renderPage(locale, page, content));
    urls.push(pageUrl(locale, page));
  }
  await writeFile(join(outDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${url}</loc></url>`).join("")}</urlset>`);
  await writeFile(join(outDir, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${baseUrl}sitemap.xml\n`);
  await writeFile(join(outDir, "llms.txt"), `# App Canvas\n\n> A zoomable overview of real application screens, states and interactive flows, integrated by a coding agent.\n\n## Canonical integration\n- [Agent guide](${repository}/blob/v${content.facts.version}/AGENT_GUIDE.md): full source inventory, original UI, synthetic fixtures, checked journeys, --complete. Installation alone does not populate a repo.\n- [Source and license](${repository}): MIT.\n- [Live synthetic web demo](${baseUrl}): no login, production backend or model API key.\n- [Quickstart](${pageUrl("en", "start")}): install the GitHub release, not an unpublished npm registry package.\n\n## Languages\n${languages.map(locale => `- [${content.locales[locale].name}](${pageUrl(locale)}): product, quickstart and release story.`).join("\n")}\n\n## Boundaries\nViewer defaults to English and supports all 11 launch languages. Web interactions run original application JavaScript; native captures require original-runtime evidence and are not live native controls. Coverage does not qualify production backends or AI accuracy. No universal one-command GUI importer.\n`);
  await writeFile(join(outDir, "llms-full.txt"), await readAgentGuide(content));
  await writeFile(join(outDir, "about/launch.json"), JSON.stringify({ ...content.facts, languages, install: commands(content.facts).install, viewerLocale: "en", viewerLanguages: languages, demo: baseUrl }, null, 2));
  return { pages: urls.length - 1, languages: languages.length };
}

async function readAgentGuide(content) {
  const { readFile } = await import("node:fs/promises");
  return `# App Canvas v${content.facts.version}\n\nCanonical repository: ${repository}\n\n${await readFile(join(root, "AGENT_GUIDE.md"), "utf8")}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = await loadContent();
  const checkOnly = process.argv.includes("--check");
  await syncReadmes(content, checkOnly);
  if (!checkOnly && !process.argv.includes("--readmes-only")) console.log(await buildLaunch(process.env.APP_CANVAS_STATIC_DIR || ".artifacts/site", content));
  else console.log(`${languages.length} language README files ${checkOnly ? "verified" : "generated"}`);
}
