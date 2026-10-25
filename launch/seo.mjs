/** Search-facing facts shared by the static landing, sitemap and agent guide. */
export const brandName = "Agent Canvas";
export const productSeoTitle = "Agent Canvas — Visual Workspace for Claude Code & Codex";
export const productSeoDescription = "See and try the real app your coding agent builds. Review screens, states and flows, then refine the source with Claude Code or Codex. Free and open source.";

const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[char]);

function publicUrl(value, label = "URL") {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${label} must be an HTTP(S) URL without credentials`);
  }
  if (url.search || url.hash) throw new Error(`${label} must not include a query or fragment`);
  return url;
}

function siteRoot(value) {
  const url = publicUrl(value, "Site URL");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

/**
 * These facts describe the actual free software; they do not claim Google rich
 * result eligibility, ratings, hosted agents, or automatic repository editing.
 */
export function seoMetadata({
  siteUrl, url, locale = "en", page = "product", title, description,
  version, image, repository = "https://github.com/tombelieber/app-canvas", steps = [],
}) {
  const home = siteRoot(siteUrl);
  const canonical = publicUrl(url, "Canonical URL").href;
  if (new URL(canonical).origin !== new URL(home).origin) {
    throw new Error("Canonical URL must use the canonical site origin");
  }
  const rootProduct = page === "product" && locale === "en";
  const seoTitle = rootProduct ? productSeoTitle : `${title || brandName} | ${brandName}`;
  const seoDescription = rootProduct ? productSeoDescription : description || productSeoDescription;
  const imageUrl = image ? publicUrl(image, "Image URL").href : undefined;
  const author = { "@type": "Person", name: "Tom Tang", url: "https://tomtang3.ai/" };
  const softwareId = `${home}#software`;
  const structuredData = [
    {
      "@context": "https://schema.org", "@type": "SoftwareApplication", "@id": softwareId,
      name: brandName, url: home, description: seoDescription,
      applicationCategory: "DeveloperApplication", operatingSystem: "Node.js 22+",
      ...(version ? { softwareVersion: version } : {}),
      license: `${repository}/blob/main/LICENSE`, isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", url: home },
      ...(imageUrl ? { image: imageUrl } : {}), author,
    },
    {
      "@context": "https://schema.org", "@type": page === "release" ? "Article" : "WebPage",
      "@id": `${canonical}#webpage`, url: canonical, name: seoTitle,
      description: seoDescription, inLanguage: locale, about: { "@id": softwareId },
      ...(page === "release" ? { headline: title || seoTitle, author } : {}),
    },
  ];
  if (rootProduct && canonical === home) structuredData.push({
    "@context": "https://schema.org", "@type": "WebSite", "@id": `${home}#website`,
    name: brandName, url: home, inLanguage: "en", publisher: author,
  });
  if (page === "start" && steps.length) structuredData.push({
    "@context": "https://schema.org", "@type": "HowTo", name: title || seoTitle,
    inLanguage: locale, url: canonical,
    step: steps.map(([name, item], index) => ({
      "@type": "HowToStep", position: index + 1, name, text: item,
    })),
  });
  return { title: seoTitle, description: seoDescription, url: canonical, structuredData };
}

export function renderSitemap(urls) {
  const canonicalUrls = [...new Set(urls.map(value => publicUrl(value, "Sitemap URL").href))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${canonicalUrls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
}

export function renderRobots(siteUrl) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteRoot(siteUrl)}sitemap.xml\n`;
}

/** Supplemental plain text; ordinary accessible HTML remains canonical. */
export function renderLlms({
  siteUrl, demoUrl, guideUrl, repository = "https://github.com/tombelieber/app-canvas",
  version, languages = [],
}) {
  const home = siteRoot(siteUrl);
  const demo = publicUrl(demoUrl, "Demo URL").href;
  const guide = publicUrl(guideUrl, "Guide URL").href;
  const ref = version ? `v${version}` : "main";
  return `# ${brandName}\n\n> A free, MIT-licensed visual workspace for reviewing and refining real apps built with coding agents.\n\nCanonical product: ${home}\n\n## Start here\n- [Product](${home}): real screens, named states and connected flows.\n- [Interactive synthetic demo](${demo}): try the example without login or a model API key. The hosted demo does not edit your repository or run an LLM.\n- [Quickstart](${guide}): install the pinned GitHub release, add the canvas to an existing project, then verify first success.\n- [Agent guide](${repository}/blob/${ref}/AGENT_GUIDE.md): authoritative repository integration instructions.\n- [Source and MIT license](${repository}): source, releases and issue reporting.\n\n## Supported workflow\n1. Use a coding agent that can inspect/edit your app source and run local commands. Claude Code and Codex have a bundled installable skill; other agents can follow the agent guide.\n2. The agent inventories the whole app, creates synthetic fixtures and adapters, and renders original application UI. Installation alone does not populate a project.\n3. Review screens and states, interact with the original web UI, and play authored journeys. Ask your agent to refine the source; source-backed previews rebuild.\n4. Verify inventory, cases and interactions before treating coverage as complete.\n\n## Boundaries\n- The runtime makes no model calls; your chosen coding agent has its own permissions and costs.\n- The public demo contains synthetic data, no production session, backend or real health records.\n- URL imports provide an independent local editable capture, not a promise to modify the source website.\n- Native UIKit, SwiftUI and Android previews require original-runtime harnesses and evidence. Captures are not live native controls.\n- UI coverage does not qualify production backends or model accuracy.\n- Optional usage telemetry is separate from app content; see the repository's docs/telemetry.md for fields and opt-out.\n${languages.length ? `\n## Languages\n${languages.map(({ name, url }) => `- [${name}](${publicUrl(url, "Language URL").href})`).join("\n")}\n` : ""}`;
}
