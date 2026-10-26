import { readFile, writeFile } from "node:fs/promises";
import { languages, publicPageUrl as pageUrl, readmePath, repository, technicalArticle, commands, text, publicDemoUrl, demoUrlForLocale } from "./content.mjs";
import { demoAssetForLocale, demoLanguageBadge } from "./demo-assets.mjs";
const root = new URL("../", import.meta.url);
const start = "<!-- launch:begin -->", end = "<!-- launch:end -->";
export const languageBar = locales => languages.map(locale => `[${locales[locale].name}](${readmePath(locale)})`).join(" · ");

export function translatedReadme(locale, { locales, facts }) {
  const c = locales[locale], t = value => text(value, facts), cmd = commands(facts, locale);
  const demoUrl = demoUrlForLocale(locale, publicDemoUrl);
  const screenshot = (kind, alt, caption) => {
    const shot = demoAssetForLocale(locale, kind);
    return shot ? `![${alt}](${shot.source})\n\n${t(caption)}` : "";
  };
  const code = value => `\n\`\`\`sh\n${value}\n\`\`\`\n`;
  const sections = c.steps.map(([title, body], i) => `### ${i + 1}. ${title}\n\n${body}\n${[code(cmd.install), code(cmd.discover), "", code(cmd.verify), code(cmd.review)][i]}`).join("\n");
  return `<!-- Generated from launch/locales/${locale}.json; run npm run docs:generate. -->
# Agent Canvas

${languageBar(locales)}

## ${c.title}

${c.description}

**[${c.demo}](${demoUrl}) · [${c.start}](${pageUrl(locale, "start")}) · [${c.release}](${pageUrl(locale, "release")})**

${demoLanguageBadge(locale)}

## ${c.summary}

${c.tldr.map(item => `- ${t(item)}`).join("\n")}

${screenshot("overview", c.overviewAlt, c.overviewCaption)}

## ${c.tour}

${c.features.map(([title, body]) => `### ${title}\n\n${body}`).join("\n\n")}

${screenshot("playback", c.playbackAlt, c.playbackCaption)}

## ${c.guideTitle}

${c.guideIntro}

### ${c.promptLabel}

\`\`\`text
${cmd.prompt}
\`\`\`

${sections}

### ${c.filesTitle}

${c.filesText}

[Agent guide](${repository}/blob/v${facts.version}/AGENT_GUIDE.md) · [React/Vite](${repository}/tree/v${facts.version}/examples/react-vite)

### ${c.skillTitle}

${c.skillText}
${code(cmd.skill)}
## ${c.limitsTitle}

${c.limits.map(item => `- ${item}`).join("\n")}

${c.privacy}

[${c.technical}](${technicalArticle})

${c.readmeMore} [English README](README.md) · [MIT](LICENSE)
`;
}

export async function generatedReadmes(content) {
  const original = await readFile(new URL("README.md", root), "utf8");
  const section = `${start}\n${languageBar(content.locales)}\n\n**[Product & multilingual guides](${pageUrl("en")}) · [Agent walkthrough](${pageUrl("en", "start")}) · [Release story](${pageUrl("en", "release")})**\n\nCLI **v${content.facts.version}** · Demo **${content.facts.states} states · ${content.facts.flows} flows · ${content.facts.entries} playable entries**, including standalone cases. Viewer: English by default + 10 languages. Example app: English and 繁體中文.\n${end}`;
  const english = original.includes(start)
    ? original.replace(/<!-- launch:begin -->[\s\S]*?<!-- launch:end -->/, section)
    : original.replace("# Agent Canvas\n", `# Agent Canvas\n\n${section}\n`);
  return { "README.md": english, ...Object.fromEntries(languages.filter(locale => locale !== "en").map(locale => [readmePath(locale), translatedReadme(locale, content)])) };
}

export async function syncReadmes(content, checkOnly = false) {
  for (const [path, value] of Object.entries(await generatedReadmes(content))) {
    const url = new URL(path, root);
    if (checkOnly) {
      const existing = await readFile(url, "utf8").catch(() => "");
      if (existing !== value) throw Error(`${path} is stale; run npm run docs:generate`);
    } else await writeFile(url, value);
  }
}
