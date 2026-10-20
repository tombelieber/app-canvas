// Closed structural XML reader for named Android style bags. It never resolves
// entities, executes build code, or treats text/CDATA as resource declarations.
const xmlName = /^[A-Za-z_][\w:.-]*$/;
const styleName = /^[A-Za-z_][\w.]*$/;
function attributes(source) {
  const result = Object.create(null);
  let offset = 0;
  while (offset < source.length) {
    const match = source.slice(offset).match(/^\s+([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/);
    if (!match) return /^\s*$/.test(source.slice(offset)) ? result : undefined;
    const [, name, quoted, single] = match;
    if (Object.hasOwn(result, name)) return;
    const literal = quoted ?? single;
    // Resource names and parents need no entity expansion. Keeping all such
    // attributes literal also rejects externally declared/custom entities.
    if (literal.includes('&')) return;
    result[name] = literal;
    offset += match[0].length;
  }
  return result;
}

export function valuesStyleEntries(source) {
  let offset = source.startsWith('\uFEFF') ? 1 : 0, root;
  const initialOffset = offset;
  const stack = [];
  while (offset < source.length) {
    if (source.startsWith('<!--', offset)) {
      const end = source.indexOf('-->', offset + 4);
      if (end < 0 || source.slice(offset + 4, end).includes('--')) return;
      offset = end + 3; continue;
    }
    if (source.startsWith('<![CDATA[', offset)) {
      const end = source.indexOf(']]>', offset + 9);
      if (end < 0 || !stack.length) return;
      stack.at(-1).opaqueText = true; offset = end + 3; continue;
    }
    if (source.startsWith('<?', offset)) {
      const end = source.indexOf('?>', offset + 2);
      if (end < 0 || root || offset !== initialOffset || !/^<\?xml\s+version\s*=\s*(?:"1\.0"|'1\.0')(?:\s+encoding\s*=\s*(?:"[Uu][Tt][Ff]-8"|'[Uu][Tt][Ff]-8'))?\s*\?>$/.test(source.slice(offset, end + 2))) return;
      offset = end + 2; continue;
    }
    if (source[offset] !== '<') {
      const end = source.indexOf('<', offset), next = end < 0 ? source.length : end, text = source.slice(offset, next);
      if (!stack.length && text.trim()) return;
      if (/&(?!(?:amp|lt|gt|apos|quot|#\d+|#x[\da-fA-F]+);)/.test(text)) return;
      if (stack.length && text.trim()) stack.at(-1).text = true;
      offset = next; continue;
    }
    if (source.startsWith('<!', offset)) return;
    let end = offset + 1, quote;
    for (; end < source.length; end++) {
      const char = source[end];
      if (quote) { if (char === quote) quote = undefined; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
      else if (char === '<') return;
    }
    if (end === source.length || quote) return;
    const tag = source.slice(offset + 1, end);
    if (tag.startsWith('/')) {
      const name = tag.slice(1).trim();
      if (!xmlName.test(name) || stack.at(-1)?.tag !== name) return;
      stack.pop().end = end + 1;
    } else {
      const self = /\/\s*$/.test(tag), body = self ? tag.replace(/\/\s*$/, '') : tag;
      const name = body.match(/^[A-Za-z_][\w:.-]*/)?.[0];
      if (!name || stack.length > 64) return;
      const attrs = attributes(body.slice(name.length)); if (!attrs) return;
      const node = {tag:name, attrs, offset, end:self ? end + 1 : undefined, children:[]};
      if (stack.length) stack.at(-1).children.push(node);
      else if (root) return;
      else root = node;
      if (!self) stack.push(node);
    }
    offset = end + 1;
  }
  // Character data is not a named resource entry. It cannot introduce a style
  // bag, even when it contains escaped markup or a literal comment terminator.
  if (stack.length || root?.tag !== 'resources') return;
  if (Object.entries(root.attrs).some(([key, value]) => !key.startsWith('xmlns:') || key === 'xmlns:android' && value !== 'http://schemas.android.com/apk/res/android')) return;
  const entries = [];
  for (const node of root.children) {
    if (node.tag !== 'style' && !(node.tag === 'item' && node.attrs.type === 'style')) continue;
    const name = node.attrs.name;
    if (!name || !styleName.test(name)) return;
    const parent = node.attrs.parent;
    const parentName = parent?.replace(/^@(?:android:)?style\//, '');
    const valid = node.tag === 'style' && !node.text && !node.opaqueText
      && Object.keys(node.attrs).every(key => ['name', 'parent'].includes(key))
      && (parent === undefined || parent === '' || styleName.test(parentName) && parentName !== name)
      && new Set(node.children.map(child => child.attrs.name)).size === node.children.length
      && node.children.every(child => child.tag === 'item' && Object.keys(child.attrs).length === 1
        && /^[A-Za-z_][\w]*(?::[A-Za-z_][\w]*)?$/.test(child.attrs.name || '') && !child.children.length && !child.opaqueText);
    entries.push({name, valid, offset:node.offset, elementOffsets:[node.offset, ...node.children.map(child => child.offset)]});
  }
  return entries;
}
