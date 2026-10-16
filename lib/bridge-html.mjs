export function bridgeHtml(html, source, parentOrigin = "") {
  if (html.includes("data-app-canvas-bridge")) return html;
  const script = `<script data-app-canvas-bridge data-parent-origin="${parentOrigin}" src="${source}"></script>`;
  return /<head(?:\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(?:\s[^>]*)?>/i, (head) => head + script)
    : script + html;
}
