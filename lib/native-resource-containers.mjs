// Android values XML declares resources through its children, not its filename.
// Recognize only a structurally empty, attribute-free root in that directory.
// Active values, namespaces, entities, processing instructions and opaque XML
// stay rendering work. Annotate after discovery creates IDs so reviews survive.
export function annotateEmptyValueContainers(source, path, obligations) {
  if (!/(^|\/)res\/values(?:-[A-Za-z0-9+]+)*\/[a-z][a-z0-9_]*\.xml$/.test(path)) return;
  let body = source.replace(/^\uFEFF/, '');
  if (body.startsWith('<?xml')) {
    const declaration = body.match(/^<\?xml[ \t\r\n]+version[ \t\r\n]*=[ \t\r\n]*(?:"1\.0"|'1\.0')(?:[ \t\r\n]+encoding[ \t\r\n]*=[ \t\r\n]*(?:"[Uu][Tt][Ff]-8"|'[Uu][Tt][Ff]-8'))?[ \t\r\n]*\?>/);
    if (!declaration) return;
    body = body.slice(declaration[0].length);
  }
  // Invalid comments remain unconsumed. A space also prevents an illegal
  // comment inside a tag name from silently joining into a recognized tag.
  body = body.replace(/<!--(?:[^-]|-(?!-))*-->/g, ' ');
  if (!/^[ \t\r\n]*<resources[ \t\r\n]*(?:\/>|>[ \t\r\n]*<\/resources[ \t\r\n]*>)[ \t\r\n]*$/.test(body)) return;
  for (const item of obligations) if (item.kind === 'element') item.nonRenderingConfiguration = true;
}
