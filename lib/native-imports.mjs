// Annotate after discovery assigns stable worklist IDs. Adding source proof
// must not orphan existing reviews of the same immutable source unit.
export function annotateJavaImportOutcomes(source, obligations) {
  for (const item of obligations) {
    if (item.kind !== 'presentation') continue;
    const start = source.lastIndexOf('\n', item.offset) + 1, end = source.indexOf('\n', item.offset);
    const declaration = source.slice(start, end < 0 ? source.length : end).trim();
    if (/^import\s+(?:static\s+)?(?:[A-Za-z_$][\w$]*\.)*(?:[A-Za-z_$][\w$]*|\*)\s*;$/.test(declaration))
      item.nonRenderingOutcome = { kind: 'java-import-declaration', reason: 'Java import binds a type or static name at compile time; it constructs and presents no UI. The imported implementation, owning UI source and actual calls remain separate review obligations.' };
  }
}
