import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { maskedSource } from './source-obligations.mjs';
import { annotateConstructionOutcomes } from './native-construction.mjs';

const native = new Set(['.h', '.m', '.mm', '.swift', '.java', '.kt']);
const cocoa = /^(?:UI(?:Responder|View|ViewController|Window|TableView|TableViewCell|TableViewController|CollectionView|CollectionViewCell|CollectionViewController|NavigationController|TabBarController|PageViewController|Control|Label|Button|TextView|TextField|ScrollView|StackView)|WKWebView|NSView|NSViewController|NSWindow|NSWindowController)$/;
const android = /^(?:Activity|AppCompatActivity|ComponentActivity|FragmentActivity|PreferenceActivity|Fragment|DialogFragment|PreferenceFragment|PreferenceFragmentCompat|View|ViewGroup|LinearLayout|RelativeLayout|FrameLayout|ConstraintLayout|TextView|EditText|Button|ImageView|ScrollView|WebView|RecyclerView|ListView|BaseAdapter|ArrayAdapter|RecyclerView\.Adapter)$/;

// A native UI class remains rendering source when it assigns .text, adds a
// subview, or delegates all rendering to another method. Positive inheritance
// evidence prevents a missing spelling in the presentation-call heuristic from
// becoming a blanket non-UI waiver. Unresolved sources still need region review.
export async function annotateNativeUi(root, files, obligations) {
  const declarations = new Map(), owners = new Map(), cocoaImplementations = new Map();
  const simple = name => name.split('.').at(-1);
  for (const file of files) {
    const extension = extname(file.path).toLowerCase();
    if (!native.has(extension)) continue;
    const source = maskedSource(await readFile(join(root, file.path), 'utf8'));
    if (['.m', '.mm'].includes(extension)) cocoaImplementations.set(file.path, source);
    const language = ['.h', '.m', '.mm', '.swift'].includes(extension) ? 'cocoa' : 'android';
    const own = [];
    function declare(name, parent) {
      const key = `${language}:${name}`;
      const entry = { key, name, parent, language };
      if (!declarations.has(key)) declarations.set(key, []);
      declarations.get(key).push(entry); own.push(entry);
    }
    if (['.h', '.m', '.mm'].includes(extension)) {
      for (const match of source.matchAll(/@interface\s+(\w+)\s*:\s*(\w+)/g)) declare(match[1], match[2]);
      for (const match of source.matchAll(/@implementation\s+(\w+)/g)) own.push({ key: `${language}:${match[1]}`, name: match[1], language });
    } else if (extension === '.swift') {
      for (const match of source.matchAll(/\b(?:class|struct)\s+(\w+)(?:\s*<[^{}\n]+>)?\s*:\s*([\w.]+)/g)) declare(match[1], match[2]);
      // SwiftUI's View protocol is positive only when the source imports it.
      if (/\bimport\s+SwiftUI\b/.test(source)) for (const entry of own) if (simple(entry.parent) === 'View') entry.swiftUi = true;
    } else {
      const pattern = extension === '.java'
        ? /\bclass\s+(\w+)(?:\s*<[^{}\n]+>)?\s+extends\s+([\w.]+)/g
        : /\bclass\s+(\w+)(?:\s*<[^{}\n]+>)?(?:\s*\([^{}\n]*\))?\s*:\s*([\w.]+)/g;
      for (const match of source.matchAll(pattern)) declare(match[1], match[2]);
    }
    owners.set(file.path, own);
  }
  function rendering(key, seen = new Set()) {
    if (seen.has(key)) return false;
    const [language, name] = key.split(':');
    if (language === 'cocoa' ? cocoa.test(simple(name)) : android.test(name) || android.test(simple(name))) return true;
    const next = new Set(seen).add(key);
    return (declarations.get(key) || declarations.get(`${language}:${simple(name)}`) || []).some(entry => entry.swiftUi || entry.parent && rendering(`${language}:${entry.parent}`, next));
  }
  for (const obligation of obligations) {
    if (obligation.kind !== 'file') continue;
    const classes = (owners.get(obligation.path) || []).filter(entry => rendering(entry.key)).map(entry => entry.name);
    if (classes.length) obligation.nativeUi = { classes: [...new Set(classes)], reason: 'native UI inheritance or implementation' };
  }
  for (const [path, source] of cocoaImplementations) if ((owners.get(path) || []).some(entry => rendering(entry.key)))
    annotateConstructionOutcomes(source, obligations.filter(item => item.path === path));
}
