import { cloudSection } from "./cloud.mjs";
import { seoMetadata } from "./seo.mjs";
import { demoAssetForLocale, demoLanguageBadge, demoLocaleForLocale } from "./demo-assets.mjs";
import { languages, baseUrl, demoUrlForLocale, repository, technicalArticle, publicSiteUrl, publicPageUrl as pageUrl, pagePath, commands, text } from "./content.mjs";

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const e = escapeHtml;
const code = value => `<pre tabindex="0"><code>${e(value)}</code></pre>`;
const list = items => `<ul>${items.map(item => `<li>${e(item)}</li>`).join("")}</ul>`;
const assets = `${publicSiteUrl}about/assets/`;
const localAssets = `${new URL(baseUrl).pathname}about/assets/`;
const brandMark = `<svg aria-hidden="true" viewBox="0 0 28 28" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="2"/><path d="m13 12 11 4-4 2-2 6-5-12Z" fill="currentColor" stroke="var(--paper)" stroke-width="1.3"/></svg>`;
const tree = `ui-review/\n  canvas.config.mjs\n  catalog.json\n  frame.jsx\n  fixtures.js\n  README.md\n.artifacts/app-canvas/inventory.json`;
const scripts = `// package.json → scripts\n"ui:review": "agent-canvas --config ui-review/canvas.config.mjs"`;

export function renderPage(locale, page, { locales, facts }) {
  const c = locales[locale], t = value => text(value, facts), cmd = commands(facts, locale);
  const overviewAsset = demoAssetForLocale(locale, "overview");
  const shareImage = overviewAsset ? `${assets}${overviewAsset.asset}` : undefined;
  const demoLocale = demoLocaleForLocale(locale);
  const demoBadge = demoLanguageBadge(locale);
  const title = page === "start" ? c.guideTitle : page === "release" ? c.storyTitle : c.title;
  const meta = seoMetadata({ siteUrl: publicSiteUrl, url: pageUrl(locale, page), locale, page, title,
    description: c.description, version: facts.version, image: shareImage, repository, steps: c.steps });
  const alternateLinks = languages.map(lang => `<link rel="alternate" hreflang="${lang}" href="${pageUrl(lang, page)}">`).join("\n");
  const languageLinks = languages.map(lang => `<a lang="${lang}" hreflang="${lang}" href="${pagePath(lang, page)}"${lang === locale ? ' aria-current="page"' : ""}>${e(locales[lang].name)}</a>`).join("");
  const image = (kind, alt, caption) => {
    const shot = demoAssetForLocale(locale, kind);
    if (!shot) return "";
    const img = `<img src="${localAssets}${shot.asset}" alt="${e(alt)}" width="${shot.width}" height="${shot.height}" loading="${page === "product" && kind === "overview" ? "eager" : "lazy"}" decoding="async" data-demo-locale="${shot.locale}">`;
    const phone = kind === "reference" ? demoAssetForLocale(locale, "referencePhone") : null;
    const visual = phone ? `<picture><source media="(max-width: 760px)" srcset="${localAssets}${phone.asset}" width="${phone.width}" height="${phone.height}">${img}</picture>` : img;
    return `<figure><a href="${localAssets}${shot.asset}" aria-label="${e(alt)}">${visual}</a><figcaption>${e(t(caption))}</figcaption></figure>`;
  };
  const overview = image("overview", c.overviewAlt, c.overviewCaption);
  const flow = image("flow", c.flowAlt, c.flowCaption);
  const playback = image("playback", c.playbackAlt, c.playbackCaption);
  const reference = image("reference", c.referenceAlt, c.referenceCaption);
  const summary = `<section class="summary" aria-labelledby="tldr"><h2 id="tldr">${e(c.summary)}</h2>${list(c.tldr.map(t))}</section>`;
  const features = `<section class="workflow" id="workflow"><h2>${e(c.tour)}</h2><div class="features">${c.features.map(([heading, body], i) => `<div><span class="step-index" aria-hidden="true">${i + 1}</span><h3>${e(heading)}</h3><p>${e(body)}</p></div>`).join("")}</div></section>`;
  const guide = `<section id="walkthrough" class="guide"><h2>${e(c.guideTitle)}</h2><p>${e(c.guideIntro)}</p><h3>${e(c.promptLabel)}</h3>${code(cmd.prompt)}<ol class="steps">${c.steps.map(([heading, body], i) => `<li><h3>${e(heading)}</h3><p>${e(body)}</p>${[code(cmd.install), code(cmd.discover), `${code(tree)}${code(scripts)}<p><a href="${repository}/tree/v${facts.version}/examples/react-vite">React/Vite</a> · <a href="${repository}/blob/v${facts.version}/AGENT_GUIDE.md">${e(c.docsLabel)}</a></p>`, code(cmd.verify), code(cmd.review)][i]}</li>`).join("")}</ol><h3>${e(c.filesTitle)}</h3><p>${e(c.filesText)}</p><h3>${e(c.skillTitle)}</h3><p>${e(c.skillText)}</p>${code(cmd.skill)}</section>`;
  const limits = `<section class="limits"><h2>${e(c.limitsTitle)}</h2>${list(c.limits)}</section>`;
  const story = `<section class="story"><h2>${e(c.storyTitle)}</h2>${c.story.map(paragraph => `<p>${e(paragraph)}</p>`).join("")}</section>`;
  const faq = `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${e(c.faqTitle)}</h2>${c.faq.map(([question, answer]) => `<details><summary>${e(question)}</summary><p>${e(answer)}</p></details>`).join("")}</section>`;
  const demoLink = demoUrlForLocale(locale);
  const hero = `<div class="hero"><div class="hero-copy"><p class="eyebrow"><span aria-hidden="true"></span>${e(c.eyebrow)}</p><h1>${e(title).replace(/\n/g, "<br>")}</h1><p class="deck">${e(c.description)}</p><div class="actions"><a class="button primary" data-action="demo" data-demo-locale="${demoLocale}" href="${e(demoLink)}"><span class="play-icon" aria-hidden="true">▶</span>${e(c.demo)}</a><a class="button" data-action="start" href="${pagePath(locale, "start")}${page === "start" ? "#walkthrough" : ""}">${e(c.start)}</a></div><p class="free-note">${e(c.freeLabel)}</p><p class="privacy demo-language" data-demo-locale="${demoLocale}">${e(demoBadge)}</p></div><div class="hero-note"><span class="version">v${facts.version}</span><p>Claude Code<br>Codex<br><span>${e(c.eyebrow)}</span></p></div></div>`;
  const product = `<section class="product-proof" aria-labelledby="product-proof-title"><div class="section-heading"><div><h2 id="product-proof-title">${e(c.demoProofTitle)}</h2><p>${e(c.demoProofIntro)}</p></div><a data-action="demo" data-demo-locale="${demoLocale}" href="${e(demoLink)}">${e(c.demo)}</a></div>${overview ? `<div class="canvas-window"><div class="canvas-window-bar"><span class="window-dot" aria-hidden="true"></span><span>Agent Canvas</span><span class="window-project">StoolSense</span></div>${overview}</div>` : ""}<p class="privacy">${e(c.privacy)}</p></section>${summary}${features}${reference ? `<section class="journey-proof"><div class="section-heading"><div><h2>${e(c.features[2][0])}</h2><p>${e(c.features[2][1])}</p></div></div>${reference}<a href="${repository}/blob/v${facts.version}/docs/agent-reference.md">${e(c.docsLabel)}</a></section>` : ""}<section class="callout"><div><h2>${e(c.installTitle)}</h2><p>${e(c.installNote)}</p><a class="button primary" data-action="start" href="${pagePath(locale, "start")}">${e(c.start)}</a></div><div class="terminal"><div class="terminal-label">Node.js 22+</div>${code(cmd.try)}</div></section>${faq}`;
  const main = page === "product" ? product : page === "start" ? `${summary}${guide}${overview}${faq}` : `${summary}${story}${overview}${features}${flow}${playback}${guide}${faq}`;
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(meta.title)}</title><meta name="description" content="${e(meta.description)}"><meta name="theme-color" content="#f6f8fb"><link rel="canonical" href="${meta.url}">${alternateLinks}<link rel="alternate" hreflang="x-default" href="${pageUrl("en", page)}"><meta property="og:type" content="${page === "release" ? "article" : "website"}"><meta property="og:title" content="${e(meta.title)}"><meta property="og:description" content="${e(meta.description)}"><meta property="og:url" content="${meta.url}"><meta property="og:site_name" content="Agent Canvas">${shareImage ? `<meta property="og:image" content="${shareImage}"><meta property="og:image:alt" content="${e(c.overviewAlt)}">` : ""}<meta name="twitter:card" content="${shareImage ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${e(meta.title)}"><meta name="twitter:description" content="${e(meta.description)}">${shareImage ? `<meta name="twitter:image" content="${shareImage}"><meta name="twitter:image:alt" content="${e(c.overviewAlt)}">` : ""}<link rel="icon" href="${localAssets}icon.svg"><link rel="stylesheet" href="${localAssets}launch.css"><link rel="sitemap" href="${publicSiteUrl}sitemap.xml"><script type="application/ld+json">${JSON.stringify(meta.structuredData).replace(/</g, "\\u003c")}</script></head>
<body data-page="${page}" data-version="${facts.version}" data-locale="${locale}"><a class="skip" href="#main">${e(c.skip)}</a><header><a class="brand" href="${pagePath(locale)}">${brandMark}<span>Agent Canvas</span></a><nav aria-label="Agent Canvas"><a data-action="start" href="${pagePath(locale, "start")}"${page === "start" ? ' aria-current="page"' : ""}>${e(c.start)}</a><a data-action="release" href="${pagePath(locale, "release")}"${page === "release" ? ' aria-current="page"' : ""}>${e(c.release)}</a><a data-action="github" href="${repository}">GitHub <span aria-hidden="true">↗</span></a></nav><details class="languages"><summary>${e(c.name)} <span aria-hidden="true">⌄</span></summary><nav aria-label="${e(c.languages)}">${languageLinks}</nav></details></header>
<main id="main">${hero}${main}${limits}<div class="secondary-services">${cloudSection(locale, e, facts.version, { includeWaitlist: page === "release" })}</div></main>
<script type="module" src="${localAssets}analytics.js" data-endpoint="https://app-canvas-services.vickyai-tech.workers.dev/capture"></script>${page === "release" ? `<script type="module" src="${localAssets}cloud.js"></script>` : ""}<footer><div class="footer-top"><a class="brand" href="${pagePath(locale)}">${brandMark}<span>Agent Canvas</span></a><p>MIT · ${e(c.versionLabel)} v${facts.version}</p><nav><a data-action="github" href="${repository}">${e(c.source)}</a><a href="${repository}/blob/v${facts.version}/AGENT_GUIDE.md">${e(c.docsLabel)}</a><a href="${repository}/blob/main/docs/support.md">Support</a><a href="${technicalArticle}">${e(c.technical)}</a><a data-action="privacy" href="#privacy">Privacy</a><a href="${publicSiteUrl}llms.txt">llms.txt</a></nav></div><nav class="locale-footer" aria-label="${e(c.languages)}">${languageLinks}</nav></footer></body></html>`;
}
