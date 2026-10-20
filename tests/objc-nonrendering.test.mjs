import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSources } from "../lib/discovery.mjs";
import { checkDiscoveryCoverage } from "../lib/discovery-coverage.mjs";

async function discover(source, extras = {}) {
  const root = await mkdtemp(join(tmpdir(), "canvas-objc-effects-"));
  try {
    for (const [path, text] of Object.entries({ "Panel.m": source, ...extras }))
      await writeFile(join(root, path), text);
    return await discoverSources(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
const panel = body => `@interface Panel : UIViewController @end
@implementation Panel
${body}
@end`;
const branches = d => d.obligations.filter(o => o.kind === "branch");
const admitted = d => branches(d).filter(o => o.nonRenderingOutcome?.kind === "objc-nonrendering-method");

test("a closed log-only method in a rendering owner retains both source IDs with canonical non-rendering outcomes", async () => {
  const source = panel(`- (void)note:(BOOL)ready {
    if (ready) NSLog(@"ready"); else NSLog(@"waiting");
  }
  - (void)viewDidLoad { if (self.view) self.title = @"Visible title"; }`);
  const d = await discover(source), notes = admitted(d);
  assert.equal(notes.length, 2);
  assert.equal(branches(d).length, 4);
  assert.equal(d.obligations.find(o => o.kind === "file").nativeUi.classes[0], "Panel");
  assert.ok(notes.every(o => Number.isInteger(o.nonRenderingOutcome.methodOffset)));
  const item = { id: "visible", sources: ["Panel.m"], cases: ["phone", "tablet"] };
  const inv = { obligations: d.obligations, items: [item], reviews: d.obligations.map(o =>
    notes.includes(o) ? { id: o.id, nonUiReason: "Closed diagnostic method; its independent caller UI remains required." }
      : { id: o.id, items: [item.id] }) };
  // Distinct visible outcome cases are still required for the real UI branch.
  const ui = branches(d).filter(o => !notes.includes(o));
  inv.items.push({ id: "visible-false", sources: ["Panel.m"], cases: ["nil-view"] });
  inv.reviews.find(r => r.id === ui.find(o => o.outcome === "false").id).items = ["visible-false"];
  assert.equal(checkDiscoveryCoverage(d, inv).reviewed, d.obligations.length);
});

test("UI writes and unresolved native calls keep every enclosing method outcome pending", async () => {
  for (const effect of [
    "self.title = @\"changed\";", "[self showPanel];", "unknown_native_hook();",
    "[self performSelector:selector];", "[[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];",
  ]) {
    const d = await discover(panel(`- (void)note:(BOOL)ready { if (ready) { NSLog(@"before"); ${effect} } }`));
    assert.equal(admitted(d).length, 0, effect);
  }
});

test("source helper summaries propagate both data-only behavior and hidden UI effects", async () => {
  for (const [body, expected] of [["NSLog(@\"data\");", 2], ["self.title = @\"UI\";", 0]]) {
    const d = await discover(panel(`- (void)helper { ${body} }
      - (void)note:(BOOL)ready { if (ready) [self helper]; }`));
    assert.equal(admitted(d).length, expected);
  }
});

test("a parameter callback is not intrinsically non-rendering; a closed data-only block can be specialized by its caller", async () => {
  const d = await discover(panel(`
    - (void)deliver:(void (^)(void))completion { if (completion) completion(); }
    - (void)note:(BOOL)ready { [self deliver:^{ if (ready) NSLog(@"data\"); }]; }
    - (void)draw:(BOOL)ready { [self deliver:^{ if (ready) self.title = @"UI"; }]; }
  `));
  assert.equal(admitted(d).length, 2);
  assert.equal(branches(d).length, 6);
});

test("a scheduled block retains its own effects instead of being dismissed as background work", async () => {
  for (const [body, expected] of [["NSLog(@\"data\");", 2], ["self.title = @\"UI\";", 0]]) {
    const d = await discover(panel(`- (void)note:(BOOL)ready {
      dispatch_async(dispatch_get_main_queue(), ^{ if (ready) { ${body} } });
    }`));
    assert.equal(admitted(d).length, expected);
  }
});

test("macro substitution, primitive shadowing and unknown callback aliases fail closed", async () => {
  for (const source of [
    `#define DIAGNOSTIC() [self showPanel]\n${panel('- (void)note:(BOOL)x { if(x) DIAGNOSTIC(); }')}`,
    `#define NSLog(...) [self showPanel]\n${panel('- (void)note:(BOOL)x { if(x) NSLog(@"hidden"); }')}`,
    panel('- (void)note:(BOOL)x callback:(void (^)(void))fn { void (^alias)(void) = fn; if(x) alias(); }'),
  ]) assert.equal(admitted(await discover(source)).length, 0);
});

test("an inventory cannot self-assert a non-rendering scope for visible native effects", async () => {
  const d = await discover(panel('- (void)draw:(BOOL)x { if(x) self.title = @"UI"; }'));
  const inv = { obligations: d.obligations.map(o => ({ ...o, nonRenderingOutcome: { kind: "objc-nonrendering-method" } })), items: [],
    reviews: d.obligations.map(o => ({ id: o.id, nonUiReason: "Claimed outside canonical discovery." })) };
  assert.throws(() => checkDiscoveryCoverage(d, inv), /Rendering source cannot be dismissed/);
});

test("callbacks preserve aliasing, lexical scope, and non-scalar identities", async () => {
  for (const body of [
    'void (^fn)(void) = ^{ self.title = @"UI"; }; if (x) fn();',
    'void (^fn)(void) = ^{ NSLog(@"data"); }; if (x) { fn = ^{ self.title = @"UI"; }; } fn();',
    '__block void (^fn)(void) = ^{ NSLog(@"data"); }; dispatch_async(dispatch_get_main_queue(), ^{ fn(); }); if (x) fn = ^{ self.title = @"UI"; };',
    'void (^fn)(void) = ^{ self.title = @"UI"; }; { void (^fn)(void) = ^{ NSLog(@"shadow"); }; } if (x) fn();',
    'if(x) NSLog(@"%@", x ? @"text" : self);',
    'if(x) NSLog(@"%@", (NSString *)self);',
    'if(x) NSLog(@"%@", self + 1);',
    'if(x) NSLog(@"%@", ((NSMutableArray *)self)[0]);',
  ]) assert.equal(admitted(await discover(panel(`- (void)note:(BOOL)x { ${body} }`))).length, 0, body);
});

test("unexecuted local block bodies do not inherit a root method's data-only annotation", async () => {
  const d = await discover(panel('- (void)note:(BOOL)x { void (^unused)(void) = ^{ if(x) self.title = @"UI"; }; }'));
  assert.equal(admitted(d).length, 0);
});

test("opaque collection contents cannot acquire a data identity through casts or copies", async () => {
  for (const type of ['NSArray', 'NSMutableArray', 'NSDictionary', 'NSMutableDictionary']) {
    const selector = type.includes('Array') ? 'firstObject' : 'objectForKey:@"key"';
    const d = await discover(panel(`- (void)note:(BOOL)x values:(${type} *)values { if(x) NSLog(@"%@", [values ${selector}]); }`));
    assert.equal(admitted(d).length, 0, type);
  }
  assert.equal(admitted(await discover(panel('- (void)note:(BOOL)x { NSArray *values = @[@"data"]; if(x) NSLog(@"%@", values[0]); }'))).length, 2);
});

test("source subclasses, category overrides, C definitions and function pointers cannot hide UI", async () => {
  const base = panel('- (void)helper { NSLog(@"data"); } - (void)note:(BOOL)x { if(x) [self helper]; }');
  assert.equal(admitted(await discover(base, { 'Child.m': '@interface Child : Panel @end @implementation Child - (void)helper { self.title = @"UI"; } @end' })).length, 0);
  for (const extra of [
    'void NSLog(id format, ...) { show_native_ui(); }',
    'void (*NSLog)(id, ...) = show_native_ui;',
    '#define YES show_native_ui()\n',
    '#define if(x) show_native_ui(); if(x)\n',
    '@implementation NSString (Replacement) + (NSString *)stringWithFormat:(id)fmt { show_native_ui(); return @""; } @end',
    '@implementation NSString (Replacement) - (NSString *)description { show_native_ui(); return @""; } @end',
  ]) {
    const d = await discover(panel('- (void)note:(BOOL)x { if(x && YES) NSLog(@"%@", [NSString stringWithFormat:@"value"]); }'), { 'Effects.m': extra });
    assert.equal(admitted(d).length, 0, extra);
  }
});

test("a modeled shared data task specializes its concrete completion without waiving a UI completion", async () => {
  for (const [effect, expected] of [['NSLog(@"data");', 2], ['self.title = @"UI";', 0]]) {
    const d = await discover(panel(`- (void)note:(BOOL)x {
      NSURL *url = [NSURL URLWithString:@"https://example.test"];
      NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
      [[[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) { if(x) { ${effect} } }] resume];
    }`));
    assert.equal(admitted(d).length, expected, effect);
  }
});

test("dynamic registration, incomplete syntax and unsupported loops stay pending", async () => {
  for (const extra of [
    'void mutate(void) { method_exchangeImplementations(a, b); }',
    'void registerIO(void) { sqlite3_vfs_register(custom, 1); }',
    'void registerIO(void) { sqlite3_create_module(db, "plugin", callbacks, 0); }',
    '@implementation CacheOwner - (void)setup { [NSURLCache setSharedURLCache:custom]; } @end',
    '@implementation Observer - (void)setup { [store addObserver:self forKeyPath:@"state" options:0 context:0]; } @end',
    '@implementation Broken - (void)broken {',
  ]) assert.equal(admitted(await discover(panel('- (void)note:(BOOL)x { if(x) NSLog(@"data"); }'), { 'Unknown.m': extra })).length, 0, extra);
  assert.equal(admitted(await discover(panel('- (void)note:(BOOL)x { for(id value in values) { if(x) NSLog(@"data"); } }'))).length, 0);
});

test("deferred source initialization, primitive receiver tricks and pointer suffixes stay pending", async () => {
  const base = panel('- (void)note:(BOOL)x { if(x) [Store log]; }');
  assert.equal(admitted(await discover(base, { 'Store.m': '@interface Store : StoreBase @end @implementation StoreBase + (void)initialize { show_native_ui(); } + (void)log { NSLog(@"data"); } @end @implementation Store @end' })).length, 0);
  assert.equal(admitted(await discover(base, { 'Store.m': '@implementation Store + (void)initialize { show_native_ui(); } + (void)log { NSLog(@"data"); } @end' })).length, 0);
  for (const body of [
    'if(x) NSLog(@"%@", *pointer);',
    'int count; if(x) NSLog(@"%@", &count + self);',
    'if(x) [@"text" stringWithFormat:@"bad instance factory"];',
    'if(x) [NSString appendString:@"bad class mutation"];',
    'if(x) [[[NSURLSession sharedSession] dataTaskWithRequest:NSMutableURLRequest completionHandler:^(NSData *d, NSURLResponse *r, NSError *e) {}] resume];',
    'void (^fn)(void) = ^{ NSLog(@"data"); }; if(x) unknown_sink(fn);',
  ]) assert.equal(admitted(await discover(panel(`- (void)note:(BOOL)x { ${body} }`))).length, 0, body);
});

test("a supported SQLite output pointer establishes only a data handle and cannot carry a callback", async () => {
  const safe = panel('- (void)note { sqlite3 *db; if(sqlite3_open("private.db", &db) == SQLITE_OK) { sqlite3_exec(db, "select 1", NULL, NULL, NULL); sqlite3_close(db); } }');
  assert.equal(admitted(await discover(safe)).length, 2);
  assert.equal(admitted(await discover(safe.replace('NULL, NULL, NULL', 'callback, NULL, NULL'))).length, 0);
});

test("annotation eligibility changes with helper dependencies while existing source IDs stay stable", async () => {
  const main = panel('- (void)helper { NSLog(@"data"); } - (void)note:(BOOL)x { if(x) [self helper]; }');
  const before = await discover(main), after = await discover(main, { 'Child.m': '@interface Child : Panel @end @implementation Child - (void)helper { self.title = @"UI"; } @end' });
  assert.deepEqual(branches(before).map(o => o.id), branches(after).map(o => o.id));
  assert.equal(admitted(before).length, 2);
  assert.equal(admitted(after).length, 0);
  const item = { id: 'visible', sources: ['Panel.m', 'Child.m'], cases: ['phone'] };
  const previousIds = new Set(admitted(before).map(o => o.id));
  const inv = { obligations: after.obligations.map(o => previousIds.has(o.id) ? { ...o, nonRenderingOutcome: admitted(before)[0].nonRenderingOutcome } : o), items: [item],
    reviews: after.obligations.map(o => previousIds.has(o.id) ? { id: o.id, nonUiReason: 'Previously closed helper scope.' } : { id: o.id, items: [item.id] }) };
  assert.throws(() => checkDiscoveryCoverage(after, inv), /Rendering source cannot be dismissed/);
  const serialized = JSON.stringify(before);
  assert.ok(!serialized.includes('data"'));
});

test("output pointer domains and Foundation ancestor overrides cannot create data evidence", async () => {
  for (const body of [
    'int db; if(sqlite3_open("x", &db) == SQLITE_OK) NSLog(@"data");',
    'sqlite3 *db; if(sqlite3_open("x", &db) == SQLITE_OK) sqlite3_exec(db, "select 1", NULL);',
  ]) assert.equal(admitted(await discover(panel(`- (void)note { ${body} }`))).length, 0, body);
  const d = await discover(panel('- (void)note:(BOOL)x { if(x) NSLog(@"data"); }'), { 'Ancestor.m': '@implementation NSObject (Replacement) - (NSString *)description { show_native_ui(); return @""; } @end' });
  assert.equal(admitted(d).length, 0);
});

test("a UI KVC write elsewhere is not confused with global KVO callback registration", async () => {
  const d = await discover(panel('- (void)note:(BOOL)x { if(x) NSLog(@"data"); } - (void)draw { [self.view setValue:nil forKeyPath:@"visibleState"]; }'));
  assert.equal(admitted(d).length, 2);
});
