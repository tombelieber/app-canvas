import { readFile } from "node:fs/promises";
import { extname, join, posix } from "node:path";
import { maskedSource } from "./source-obligations.mjs";

// Parse the source project's OpenStep dictionaries without executing Xcode or
// build scripts. Unsupported syntax leaves the branch pending, not excluded.
function projectDictionary(source) {
  const lexer = /\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|[{}()=;,]|[^\s{}()=;,"]+/y;
  const tokens = [];
  for (let offset = 0; offset < source.length;) {
    lexer.lastIndex = offset;
    const token = lexer.exec(source)?.[0];
    if (!token) throw Error("Unsupported project token");
    offset = lexer.lastIndex;
    if (!/^\s|^\/\*|^\/\//.test(token)) tokens.push(token);
  }
  let index = 0;
  function take(expected) {
    const value = tokens[index++];
    if (value === undefined || expected && value !== expected) throw Error("Unsupported project syntax");
    return value;
  }
  function value(depth = 0) {
    if (depth > 100) throw Error("Nested project syntax");
    const token = take();
    if (token === "{") {
      const object = Object.create(null);
      while (tokens[index] !== "}") {
        const key = scalar(take());
        if (Object.hasOwn(object, key)) throw Error("Duplicate project key");
        take("="); object[key] = value(depth + 1); take(";");
      }
      take("}"); return object;
    }
    if (token === "(") {
      const array = [];
      while (tokens[index] !== ")") {
        array.push(value(depth + 1));
        if (tokens[index] !== ")") take(",");
      }
      take(")"); return array;
    }
    return scalar(token);
  }
  function scalar(token) {
    if (/^[{}()=;,]$/.test(token)) throw Error("Invalid project value");
    return token.startsWith('"') ? JSON.parse(token) : token;
  }
  const result = value();
  if (index !== tokens.length) throw Error("Trailing project syntax");
  return result;
}

function version(text) {
  if (typeof text !== "string" || !/^\d+(?:\.\d+)*$/.test(text)) return;
  const parts = text.split(".").map(Number);
  if (parts.every(Number.isSafeInteger)) return parts;
}
function compare(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] || 0) - (b[i] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}
const lowest = values => values.sort((a, b) => compare(version(a), version(b)))[0];

function androidMinimum(source) {
  const clean = maskedSource(source), values = [];
  for (const token of clean.matchAll(/\bminSdk(?:Version)?\b/g)) {
    const literal = clean.slice(token.index + token[0].length).match(/^\s*(?:=\s*)?(?:\(\s*(\d+)\s*\)|(\d+))[^\S\n]*?(?=;|\r?\n|}|$)/);
    if (!literal) return;
    values.push(literal[1] || literal[2]);
  }
  if (values.length && values.every(value => Number.isSafeInteger(Number(value)) && Number(value) > 0)) return lowest(values);
}

function iosMinimum(source) {
  try {
    const project = projectDictionary(source), objects = project.objects;
    const root = objects?.[project.rootObject];
    if (root?.isa !== "PBXProject" || !Array.isArray(root.targets)) return;
    if (root.targets.some(id => !objects[id])) return;
    const testProducts = new Set(["com.apple.product-type.bundle.ocunit-test", "com.apple.product-type.bundle.unit-test", "com.apple.product-type.bundle.ui-testing"]);
    const targets = root.targets.map(id => objects[id]).filter(target => target?.isa === "PBXNativeTarget" && !testProducts.has(target.productType));
    if (!targets.some(target => target.productType === "com.apple.product-type.application")) return;
    const floors = [];
    // Include every product target, including extensions. Hosted test bundles
    // are not independently installable user interfaces.
    for (const target of targets) {
      const configs = objects[target.buildConfigurationList]?.buildConfigurations;
      if (!Array.isArray(configs) || !configs.length) return;
      for (const id of configs) {
        const config = objects[id];
        if (config?.isa !== "XCBuildConfiguration") return;
        const settings = config.buildSettings;
        if (!settings || Object.keys(settings).some(key => key.startsWith("IPHONEOS_DEPLOYMENT_TARGET[") || key === "SDKROOT" && !["iphoneos", "iphonesimulator"].includes(settings[key]))) return;
        const floor = settings.IPHONEOS_DEPLOYMENT_TARGET;
        if (!version(floor)) return;
        floors.push(floor);
      }
    }
    if (floors.length) return lowest(floors);
  } catch { /* An opaque project is not evidence of an unreachable outcome. */ }
}

// Published VERSION_CODES integer constants are immutable. Unknown names stay
// pending; this table was checked against the Android SDK's android.jar.
const sdkLevels = Object.fromEntries(("BASE BASE_1_1 CUPCAKE DONUT ECLAIR ECLAIR_0_1 ECLAIR_MR1 FROYO GINGERBREAD GINGERBREAD_MR1 HONEYCOMB HONEYCOMB_MR1 HONEYCOMB_MR2 ICE_CREAM_SANDWICH ICE_CREAM_SANDWICH_MR1 JELLY_BEAN JELLY_BEAN_MR1 JELLY_BEAN_MR2 KITKAT KITKAT_WATCH LOLLIPOP LOLLIPOP_MR1 M N N_MR1 O O_MR1 P Q R S S_V2 TIRAMISU").split(" ").map((name, index) => [name, index + 1]));

function guardAt(source, offset, extension) {
  const clean = source.slice(offset);
  if ([".java", ".kt"].includes(extension)) {
    const match = clean.match(/^if\s*\(\s*(android\.os\.)?Build\.VERSION\.SDK_INT\s*(<=|>=|==|!=|<|>)\s*(?:(\d+)|(?:android\.os\.)?Build\.VERSION_CODES\.([A-Z_0-9]+))\s*\)/);
    const imported = /\bimport\s+android\.os\.Build\s*[;\n]/.test(source) && !/\b(?:class|interface|object|enum|record)\s+Build\b/.test(source);
    const level = match && (match[3] ? Number(match[3]) : sdkLevels[match[4]]);
    if (match && (match[1] || imported) && Number.isSafeInteger(level)) return { platform: "android", operator: match[2], level: [level] };
  }
  if ([".m", ".mm", ".swift"].includes(extension)) {
    const match = clean.match(/^if\s*(?:\(\s*@available\(\s*iOS\s+(\d+(?:\.\d+)*),\s*\*\s*\)\s*\)|#available\(\s*iOS\s+(\d+(?:\.\d+)*),\s*\*\s*\))/);
    if (match) return { platform: "ios", operator: ">=", level: version(match[1] || match[2]) };
  }
}

function impossible(guard, minimum, outcome) {
  const order = compare(version(minimum), guard.level);
  const alwaysTrue = [">=", ">", "!="].includes(guard.operator) && (guard.operator === ">=" ? order >= 0 : order > 0);
  const alwaysFalse = ["<", "<=", "=="].includes(guard.operator) && (guard.operator === "<" ? order >= 0 : order > 0);
  return outcome === "true" ? alwaysFalse : alwaysTrue;
}

export async function annotateNativeConstraints(root, files, obligations) {
  const paths = new Map(files.map(file => [file.path, file]));
  const contents = new Map(), cleanContents = new Map(), floors = new Map();
  async function content(path) {
    if (!contents.has(path)) contents.set(path, await readFile(join(root, path), "utf8"));
    return contents.get(path);
  }
  async function bounds(path, platform) {
    for (let directory = posix.dirname(path); ; directory = posix.dirname(directory)) {
      const prefix = directory === "." ? "" : `${directory}/`;
      const candidates = platform === "android"
        ? ["build.gradle", "build.gradle.kts"].map(name => prefix + name).filter(path => paths.has(path))
        : files.filter(file => file.path.endsWith(".xcodeproj/project.pbxproj") && posix.dirname(posix.dirname(file.path)) === directory).map(file => file.path);
      if (candidates.length) {
        if (candidates.length !== 1) return;
        const buildFile = candidates[0];
        if (!floors.has(buildFile)) floors.set(buildFile, (platform === "android" ? androidMinimum : iosMinimum)(await content(buildFile)));
        const minimum = floors.get(buildFile);
        if (minimum) return { kind: platform === "android" ? "android-min-sdk" : "ios-deployment-target", buildFile, buildSha256: paths.get(buildFile).sha256, minimum };
        return; // Never substitute a higher, unrelated ancestor's minimum.
      }
      if (directory === ".") return;
    }
  }
  // A version-only alternative matches every supported configuration when its
  // API floor is no higher than the module's minimum. This concerns normal
  // Android resource selection, not a claim that the replacement was rendered.
  // Keep both files and all IDs; only source-fresh shadowed XML tags lose their
  // rendering guard. Values resources merge by entry, so never infer this from
  // a values filename. Other qualifiers can be configuration-dependent too.
  const resourceFiles = [];
  for (const file of files) {
    const match = file.path.match(/^((?:.*\/)?src\/main\/res\/)(drawable|color|anim|animator)(?:-v([1-9]\d*))?\/([a-z][a-z0-9_]*\.xml)$/);
    if (match) resourceFiles.push({ file, prefix: match[1], type: match[2], api: Number(match[3] || 0), name: match[4] });
  }
  const opaqueResourceAccess = new Map();
  for (const resource of resourceFiles) {
    const floor = await bounds(resource.file.path, "android");
    if (!floor) continue;
    const module = resource.prefix.slice(0, -"src/main/res/".length);
    if (![`${module}build.gradle`, `${module}build.gradle.kts`].includes(floor.buildFile)) continue;
    const alternatives = resourceFiles.filter(other => other.prefix === resource.prefix && other.type === resource.type && other.name === resource.name && other.api > resource.api && other.api <= Number(floor.minimum));
    if (!alternatives.length) continue;
    const replacement = alternatives.sort((a, b) => b.api - a.api)[0];
    // Exclude recognizable resource-source-set overrides. An opaque Gradle
    // source configuration is not proof that both alternatives are packaged.
    const build = maskedSource(await content(floor.buildFile));
    if (/\b(?:sourceSets|setSrcDirs|srcDirs|setRoot|exclude|ignoreAssetsPattern)\b/.test(build)) continue;
    if (!opaqueResourceAccess.has(module)) {
      let opaque = false;
      const directPaths = new Set();
      for (const file of files) {
        if (!file.path.startsWith(module) || !/\.(?:java|kt|c|cc|cpp|h|gradle|kts)$/.test(file.path)) continue;
        const source = await content(file.path);
        // Explicit APK/file loaders can bypass the normal resource resolver.
        // Do not turn selection dominance into a waiver of those paths.
        if (/\b(?:openNonAsset|openXmlResourceParser|ApkAssets|ZipResourceFile|getPackageCodePath|getPackageResourcePath)\b|\.sourceDir\b/.test(maskedSource(source))) opaque = true;
        for (const match of source.matchAll(/res\/(?:drawable|color|anim|animator)(?:-v\d+)?\/[a-z][a-z0-9_]*\.xml/g)) directPaths.add(match[0]);
      }
      opaqueResourceAccess.set(module, { opaque, directPaths });
    }
    const access = opaqueResourceAccess.get(module);
    if (access.opaque || access.directPaths.has(`res/${resource.type}${resource.api ? `-v${resource.api}` : ""}/${resource.name}`)) continue;
    for (const obligation of obligations) {
      if (obligation.path !== resource.file.path || obligation.kind !== "element") continue;
      obligation.nonRenderingConfiguration = true;
      obligation.resourceSelection = {
        kind: "android-version-shadowed-resource",
        constraint: floor,
        resourceApi: resource.api,
        replacement: replacement.file.path,
        replacementSha256: replacement.file.sha256,
        replacementApi: replacement.api,
      };
    }
  }
  for (const obligation of obligations) {
    if (obligation.kind !== "branch" || !["true", "false"].includes(obligation.outcome)) continue;
    const extension = extname(obligation.path).toLowerCase();
    if (![".java", ".kt", ".m", ".mm", ".swift"].includes(extension)) continue;
    if (!cleanContents.has(obligation.path)) cleanContents.set(obligation.path, maskedSource(await content(obligation.path)));
    const guard = guardAt(cleanContents.get(obligation.path), obligation.offset, extension);
    if (!guard) continue;
    const floor = await bounds(obligation.path, guard.platform);
    if (floor && impossible(guard, floor.minimum, obligation.outcome)) obligation.unreachable = floor;
  }
}
