import { languages, baseUrl, repository, technicalArticle, pageUrl, pagePath, commands, text } from "./content.mjs";

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const e = escapeHtml;
const code = value => `<pre tabindex="0"><code>${e(value)}</code></pre>`;
const list = items => `<ul>${items.map(item => `<li>${e(item)}</li>`).join("")}</ul>`;
const assets = `${baseUrl}about/assets/`;
const localAssets = "/app-canvas/about/assets/";
const tree = `ui-review/\n  canvas.config.mjs\n  catalog.json\n  frame.jsx\n  fixtures.js\n  README.md\n.artifacts/app-canvas/inventory.json`;
const scripts = `// package.json → scripts\n"ui:review": "app-canvas --config ui-review/canvas.config.mjs"`;

export function renderPage(locale, page, { locales, facts }) {
  const c = locales[locale], t = value => text(value, facts), cmd = commands(facts);
  const url = pageUrl(locale, page);
  const title = page === "start" ? c.guideTitle : page === "release" ? c.storyTitle : c.title;
  const alternateLinks = languages.map(lang => `<link rel="alternate" hreflang="${lang}" href="${pageUrl(lang, page)}">`).join("\n");
  const languageLinks = languages.map(lang => `<a lang="${lang}" hreflang="${lang}" href="${pagePath(lang, page)}"${lang === locale ? ' aria-current="page"' : ""}>${e(locales[lang].name)}</a>`).join("");
  const image = (file, alt, caption, phone = false) => `<figure${phone ? ' class="phone"' : ""}><a href="${localAssets}${file}"><img src="${localAssets}${file}" alt="${e(alt)}" width="${phone ? 1170 : file === "playback.jpg" ? 1280 : 1319}" height="${phone ? 2532 : file === "playback.jpg" ? 720 : 827}" loading="${page === "product" && file === "overview.jpg" ? "eager" : "lazy"}" decoding="async"></a><figcaption>${e(t(caption))}</figcaption></figure>`;
  const overview = image("overview.jpg", c.overviewAlt, c.overviewCaption);
  const flow = image("flow.jpg", c.flowAlt, c.flowCaption);
  const playback = image("playback.jpg", c.playbackAlt, c.playbackCaption);
  const summary = `<section class="summary" aria-labelledby="tldr"><h2 id="tldr">${e(c.summary)}</h2>${list(c.tldr.map(t))}</section>`;
  const features = `<section><h2>${e(c.tour)}</h2><div class="features">${c.features.map(([heading, body]) => `<div><h3>${e(heading)}</h3><p>${e(body)}</p></div>`).join("")}</div></section>`;
  const guide = `<section id="walkthrough"><h2>${e(c.guideTitle)}</h2><p>${e(c.guideIntro)}</p><h3>${e(c.promptLabel)}</h3>${code(cmd.prompt)}<ol class="steps">${c.steps.map(([heading, body], i) => `<li><h3>${e(heading)}</h3><p>${e(body)}</p>${[code(cmd.install), code(cmd.discover), `${code(tree)}${code(scripts)}<p><a href="${repository}/tree/v${facts.version}/examples/react-vite">React/Vite</a> · <a href="${repository}/blob/v${facts.version}/AGENT_GUIDE.md">${e(c.docsLabel)}</a></p>`, code(cmd.verify), code(cmd.review)][i]}</li>`).join("")}</ol><h3>${e(c.filesTitle)}</h3><p>${e(c.filesText)}</p><h3>${e(c.skillTitle)}</h3><p>${e(c.skillText)}</p>${code(cmd.skill)}</section>`;
  const limits = `<section><h2>${e(c.limitsTitle)}</h2>${list(c.limits)}</section>`;
  const story = `<section><h2>${e(c.storyTitle)}</h2>${c.story.map(paragraph => `<p>${e(paragraph)}</p>`).join("")}</section>`;
  const schema = [
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "App Canvas", url: baseUrl, applicationCategory: "DeveloperApplication", operatingSystem: "Web; Node.js 22+", softwareVersion: facts.version, license: `${repository}/blob/main/LICENSE`, isAccessibleForFree: true, description: c.description, image: `${assets}overview.jpg`, author: { "@type": "Person", name: "Tom Tang" } },
    ...(page === "release" ? [{ "@context": "https://schema.org", "@type": "BlogPosting", headline: title, description: c.description, inLanguage: locale, datePublished: "2026-10-18", image: `${assets}overview.jpg`, mainEntityOfPage: url, author: { "@type": "Person", name: "Tom Tang" } }] : []),
    ...(page === "start" ? [{ "@context": "https://schema.org", "@type": "HowTo", name: title, inLanguage: locale, step: c.steps.map(([name, item], index) => ({ "@type": "HowToStep", position: index + 1, name, text: item })) }] : []),
  ];
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} | App Canvas</title><meta name="description" content="${e(c.description)}"><meta name="theme-color" content="#f7faf9"><link rel="canonical" href="${url}">${alternateLinks}<link rel="alternate" hreflang="x-default" href="${pageUrl("en", page)}"><meta property="og:type" content="${page === "release" ? "article" : "website"}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(c.description)}"><meta property="og:url" content="${url}"><meta property="og:site_name" content="App Canvas"><meta property="og:image" content="${assets}overview.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(c.description)}"><meta name="twitter:image" content="${assets}overview.jpg"><link rel="icon" href="${localAssets}icon.svg"><link rel="stylesheet" href="${localAssets}launch.css"><link rel="sitemap" href="${baseUrl}sitemap.xml"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script></head>
<body><a class="skip" href="#main">${e(c.skip)}</a><header><a class="brand" href="${pagePath(locale)}"><span aria-hidden="true">▦</span> App Canvas</a><nav aria-label="App Canvas"><a href="${pagePath(locale, "start")}"${page === "start" ? ' aria-current="page"' : ""}>${e(c.start)}</a><a href="${pagePath(locale, "release")}"${page === "release" ? ' aria-current="page"' : ""}>${e(c.release)}</a><a href="${repository}">GitHub ↗</a></nav><details class="languages"><summary>${e(c.name)} ▾</summary><nav aria-label="${e(c.languages)}">${languageLinks}</nav></details></header>
<main id="main"><div class="hero"><p class="eyebrow">${e(c.eyebrow)} · v${facts.version}</p><h1>${e(title)}</h1><p class="deck">${e(c.description)}</p><div class="actions"><a class="button primary" href="${baseUrl}">${e(c.demo)} ↗</a><a class="button" href="${pagePath(locale, page === "start" ? "release" : "start")}">${e(page === "start" ? c.release : c.start)} →</a></div><p class="privacy">${e(c.privacy)}</p></div>
${summary}
${page === "product" ? `${overview}${features}${flow}${playback}<section class="callout"><h2>${e(c.guideTitle)}</h2><p>${e(c.guideIntro)}</p><a class="button primary" href="${pagePath(locale, "start")}">${e(c.start)} →</a></section>` : page === "start" ? `${guide}${overview}` : `${story}${overview}${features}${flow}${playback}${guide}`}
${limits}<section class="phone-story">${image("iphone.png", c.phoneAlt, c.phoneCaption, true)}<div><h2>${e(c.technical)}</h2><p>${e(c.phoneCaption)}</p><a class="button" href="${technicalArticle}">${e(c.technical)} →</a></div></section>
</main><footer><p><strong>App Canvas</strong> · MIT · ${e(c.versionLabel)} v${facts.version}</p><nav><a href="${repository}">${e(c.source)}</a><a href="${repository}/blob/v${facts.version}/AGENT_GUIDE.md">${e(c.docsLabel)}</a><a href="${baseUrl}llms.txt">llms.txt</a></nav><nav class="locale-footer" aria-label="${e(c.languages)}">${languageLinks}</nav></footer></body></html>`;
}
