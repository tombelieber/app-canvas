import {maskedSource} from './source-obligations.mjs';
import {valuesStyleEntries} from './android-values-styles.mjs';

function ordinaryPackaging(source) {
  const clean = maskedSource(source);
  if (/\b(?:sourceSets|setSrcDirs|srcDirs|setRoot|exclude|ignoreAssetsPattern|aaptOptions|androidResources|resourceConfigurations|resConfigs|splits|androidComponents|applicationVariants|libraryVariants)\b/.test(clean)) return false;
  // Standard shrinking removes unused resource identities, not individual
  // alternative configurations. Explicit configuration filters above differ.
  for (const token of clean.matchAll(/\b(?:shrinkResources|isShrinkResources)\b/g)) {
    if (!/^\s*(?:=\s*)?(?:true|false)\s*(?=;|\r?\n|}|$)/.test(clean.slice(token.index + token[0].length))) return false;
  }
  return true;
}

function inspectedSource(source) {
  // Decode a conservative superset of literal escape/concatenation forms for
  // exclusion checks only. False positives leave work pending; they never add
  // an annotation. Do not let a quoted reflective loader evade the boundary.
  return source.replace(/\\u+([\da-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([\da-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/["']\s*\+\s*["']/g, '');
}

// A values filename is not a resource identity. Select same module/type/name
// entries, retain all IDs, and annotate only the old bag's own opening tags.
export async function annotateShadowedAndroidStyles({files, obligations, content, bounds}) {
  const elements = new Map();
  for (const obligation of obligations) {
    if (obligation.kind !== 'element') continue;
    if (!elements.has(obligation.path)) elements.set(obligation.path, new Map());
    const file = elements.get(obligation.path);
    if (!file.has(obligation.offset)) file.set(obligation.offset, []);
    file.get(obligation.offset).push(obligation);
  }
  const modules = new Map();
  for (const file of files) {
    const match = file.path.match(/^((?:.*\/)?src\/main\/res\/)(values(?:-[A-Za-z0-9+]+)*)\/([a-z][a-z0-9_]*\.xml)$/);
    if (!match) continue;
    const prefix = match[1], module = prefix.slice(0, -'src/main/res/'.length);
    if (!modules.has(module)) modules.set(module, []);
    modules.get(module).push({file, qualifier:match[2], api:/^values(?:-v[1-9]\d*)?$/.test(match[2]) ? Number(match[2].slice('values-v'.length) || 0) : undefined});
  }
  for (const [module, resources] of modules) {
    const floor = await bounds(resources[0].file.path, 'android');
    if (!floor || ![module+'build.gradle', module+'build.gradle.kts'].includes(floor.buildFile) || !ordinaryPackaging(await content(floor.buildFile))) continue;
    const entries = []; let opaque = false;
    for (const resource of resources) {
      const parsed = valuesStyleEntries(await content(resource.file.path));
      if (!parsed) { opaque = true; break; }
      entries.push(...parsed.map(entry => ({...resource, ...entry})));
    }
    if (opaque || !entries.length) continue;
    const directFiles = new Set(resources.map(r => r.file.path.slice((module+'src/main/').length)));
    for (const file of files) {
      if (!file.path.startsWith(module) || !/\.(?:java|kt|c|cc|cpp|h|gradle|kts)$/.test(file.path)) continue;
      const raw = await content(file.path), source = raw+'\n'+inspectedSource(raw);
      // Explicit package/table loaders and named file access escape the normal
      // Resources resolver. Quoted reflective method names also stay pending.
      if (/\b(?:openNonAsset|openXmlResourceParser|ApkAssets|ZipResourceFile|getPackageCodePath|getPackageResourcePath|ResourcesLoader|ResourcesProvider|addAssetPath|setApkAssets|loadFromApk|loadFromTable)\b|\.sourceDir\b/.test(source)) { opaque = true; break; }
      if ([...source.matchAll(/res\/values(?:-[A-Za-z0-9+]+)*\/[a-z][a-z0-9_]*\.xml/g)].some(m => directFiles.has(m[0]))) { opaque = true; break; }
    }
    if (opaque) continue;
    const byName = new Map();
    for (const entry of entries) {
      if (!byName.has(entry.name)) byName.set(entry.name, []);
      byName.get(entry.name).push(entry);
    }
    for (const [name, alternatives] of byName) {
      const qualifiers = new Set(); let ambiguous = false;
      for (const entry of alternatives) {
        if (!entry.valid || qualifiers.has(entry.qualifier)) { ambiguous = true; break; }
        qualifiers.add(entry.qualifier);
      }
      if (ambiguous) continue;
      for (const old of alternatives) {
        if (!Number.isInteger(old.api)) continue;
        const selected = alternatives.filter(entry => Number.isInteger(entry.api) && entry.api > old.api && entry.api <= Number(floor.minimum)).sort((a,b) => b.api-a.api)[0];
        if (!selected) continue;
        for (const offset of old.elementOffsets) for (const obligation of elements.get(old.file.path)?.get(offset) || []) {
          obligation.nonRenderingConfiguration = true;
          obligation.resourceSelection = {kind:'android-version-shadowed-style',constraint:floor,styleName:name,
            resourceApi:old.api,declarationOffset:old.offset,replacement:selected.file.path,
            replacementSha256:selected.file.sha256,replacementApi:selected.api,replacementOffset:selected.offset};
        }
      }
    }
  }
}
