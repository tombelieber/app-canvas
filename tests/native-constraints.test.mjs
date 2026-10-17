import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { discoverSources, checkSourceCoverage } from "../lib/inventory.mjs";

async function fixture(t, sources) {
  const root = await mkdtemp(join(tmpdir(), "app-canvas-native-bounds-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(sources)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  await mkdir(join(root, ".artifacts"));
  return root;
}
const java = guard => `import android.os.Build;\nclass Screen { void render() { if (${guard}) setText("Old"); else setText("Current"); } }`;

test("a declared Android minimum accounts for an impossible legacy UI outcome without inventing a capture", async t => {
  const root = await fixture(t, {
    "app/build.gradle": "android { defaultConfig {\n minSdkVersion 21\n} }",
    "app/src/Screen.java": java("Build.VERSION.SDK_INT < 16"),
  });
  const found = await discoverSources(root), branches = found.obligations.filter(o => o.kind === "branch");
  const dead = branches.find(o => o.outcome === "true");
  assert.equal(dead.unreachable?.kind, "android-min-sdk");
  assert.equal(dead.unreachable?.minimum, "21");
  assert.equal(dead.unreachable?.buildFile, "app/build.gradle");
  assert.equal(branches.find(o => o.outcome === "false").unreachable, undefined);
  const inventory = { ...found,
    files: found.files.map(f => f.path.endsWith(".gradle") ? { ...f, nonUiReason: "Declares the app's supported Android minimum" } : f),
    items: [{ id: "screen", kind: "screen", sources: ["app/src/Screen.java"], cases: ["current"] }],
    reviews: found.obligations.map(o => o.unreachable || o.path.endsWith(".gradle") || o.kind === "exclusion"
      ? { id: o.id, nonUiReason: o.unreachable ? "The declared supported Android range excludes SDK below 16" : "Build configuration" }
      : { id: o.id, items: ["screen"] }),
  };
  await writeFile(join(root, ".artifacts/inventory.json"), JSON.stringify(inventory));
  const result = await checkSourceCoverage({ catalog: [{ id: "current" }], sourceCoverage: { inventory: ".artifacts/inventory.json" } }, root, { complete: true });
  assert.equal(result.cases, 1);
});

test("reachable, dynamic and unrelated Android build bounds cannot dismiss a UI branch", async t => {
  for (const [minimum, guard] of [["21", "Build.VERSION.SDK_INT < 23"], ["project.minimum", "Build.VERSION.SDK_INT < 16"], ["21 + offset", "Build.VERSION.SDK_INT < 16"]]) {
    const root = await fixture(t, {
      "build.gradle": "minSdkVersion 99\n",
      "app/build.gradle": `android { defaultConfig {\n minSdkVersion ${minimum}\n} }`,
      "app/src/Screen.java": java(guard),
    });
    const found = await discoverSources(root);
    assert.ok(found.obligations.filter(o => o.kind === "branch").every(o => !o.unreachable));
  }
});

test("every declared flavor minimum participates in the Android lower bound", async t => {
  const root = await fixture(t, {
    "app/build.gradle.kts": "android { defaultConfig {\n minSdk = 21\n}\n productFlavors { create(\"legacy\") {\n minSdk = 14\n} } }",
    "app/src/Screen.kt": java("Build.VERSION.SDK_INT < 16"),
  });
  const found = await discoverSources(root);
  assert.ok(found.obligations.filter(o => o.kind === "branch").every(o => !o.unreachable));
});

test("published Android SDK constants have the same bounds as their numeric guards", async t => {
  const root = await fixture(t, {
    "app/build.gradle": "minSdkVersion 21\n",
    "app/src/Screen.java": java("Build.VERSION.SDK_INT < Build.VERSION_CODES.GINGERBREAD"),
    "app/src/Current.java": java("Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN"),
    "app/src/Future.java": java("Build.VERSION.SDK_INT < Build.VERSION_CODES.UNKNOWN_RELEASE"),
    "app/src/Shadow.java": java("Build.VERSION.SDK_INT < 16").replace("import android.os.Build;", "class Build {}"),
  });
  const found = await discoverSources(root), dead = found.obligations.filter(o => o.unreachable);
  assert.deepEqual(dead.map(o => [o.path, o.outcome]).sort(), [["app/src/Current.java", "false"], ["app/src/Screen.java", "true"]]);
});

const pbx = minimum => `// !$*UTF8*$!
{ objects = {
 ROOT = {isa = PBXProject; targets = (APP, TEST,);};
 APP = {isa = PBXNativeTarget; productType = "com.apple.product-type.application"; buildConfigurationList = LIST;};
 LIST = {isa = XCConfigurationList; buildConfigurations = (DEBUG, RELEASE,);};
 DEBUG = {isa = XCBuildConfiguration; buildSettings = { IPHONEOS_DEPLOYMENT_TARGET = ${minimum}; };};
 RELEASE = {isa = XCBuildConfiguration; buildSettings = { IPHONEOS_DEPLOYMENT_TARGET = ${minimum}; };};
 PROJECT_DEBUG = {isa = XCBuildConfiguration; buildSettings = { IPHONEOS_DEPLOYMENT_TARGET = 12.0; };};
 TEST = {isa = PBXNativeTarget; productType = "com.apple.product-type.bundle.ocunit-test"; buildConfigurationList = TEST_LIST;};
 TEST_LIST = {isa = XCConfigurationList; buildConfigurations = (TEST_DEBUG,);};
 TEST_DEBUG = {isa = XCBuildConfiguration; buildSettings = {};};
}; rootObject = ROOT; }`;

test("iOS availability uses the application target floor rather than the lower project default", async t => {
  const root = await fixture(t, {
    "ios/App.xcodeproj/project.pbxproj": pbx('"15.0"'),
    "ios/App/Screen.m": 'void render() { if (@available(iOS 13.0, *)) { presentViewController(current); } else { presentViewController(legacy); } }',
  });
  const found = await discoverSources(root), branches = found.obligations.filter(o => o.kind === "branch");
  assert.equal(branches.find(o => o.outcome === "false").unreachable?.minimum, "15.0");
  assert.equal(branches.find(o => o.outcome === "true").unreachable, undefined);
});

test("an inherited iOS floor or an unparsed project remains unresolved", async t => {
  for (const project of [pbx('"$(INHERITED_MINIMUM)"'), pbx('"15.0'), "not a project"]) {
    const root = await fixture(t, {
      "ios/App.xcodeproj/project.pbxproj": project,
      "ios/App/Screen.m": 'void render() { if (@available(iOS 13, *)) { presentViewController(current); } else { presentViewController(legacy); } }',
    });
    const found = await discoverSources(root);
    assert.ok(found.obligations.filter(o => o.kind === "branch").every(o => !o.unreachable));
  }
});

test("a lower extension floor cannot be hidden by selecting the higher app target", async t => {
  const root = await fixture(t, {
    "ios/App.xcodeproj/project.pbxproj": pbx("15.0").replace("com.apple.product-type.bundle.ocunit-test", "com.apple.product-type.app-extension").replace("buildSettings = {};", "buildSettings = { IPHONEOS_DEPLOYMENT_TARGET = 12.0; };"),
    "ios/App/Screen.m": 'void render() { if (@available(iOS 13, *)) { presentViewController(current); } else { presentViewController(legacy); } }',
  });
  const found = await discoverSources(root);
  assert.ok(found.obligations.filter(o => o.kind === "branch").every(o => !o.unreachable));
});

test("a hand-edited unreachable annotation cannot waive an ordinary rendering branch", async t => {
  const root = await fixture(t, { "Screen.java": java("denied") });
  const found = await discoverSources(root);
  const inventory = { ...found, items: [{ id: "screen", kind: "screen", sources: ["Screen.java"], cases: ["current"] }],
    obligations: found.obligations.map(o => ({ ...o, unreachable: { kind: "android-min-sdk", minimum: "99" } })),
    reviews: found.obligations.map(o => o.kind === "exclusion" ? { id: o.id, nonUiReason: "Generated worklist directory" } : o.kind === "branch" ? { id: o.id, nonUiReason: "Claimed unreachable" } : { id: o.id, items: ["screen"] }),
  };
  await writeFile(join(root, ".artifacts/inventory.json"), JSON.stringify(inventory));
  await assert.rejects(() => checkSourceCoverage({ catalog: [{ id: "current" }], sourceCoverage: { inventory: ".artifacts/inventory.json" } }, root, { complete: true }), /Rendering source cannot be dismissed/);
});
