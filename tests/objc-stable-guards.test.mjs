import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverSources } from '../lib/discovery.mjs';
import { checkDiscoveryCoverage } from '../lib/discovery-coverage.mjs';
import { stableNativeGuards } from '../lib/objc-stable-guards.mjs';

const story = `<document><scenes><scene><objects><viewController id="panel" customClass="Panel"><view><subviews><segmentedControl id="mode"/><button><connections><action selector="run:" destination="panel"/></connections></button></subviews></view><connections><outlet property="mode" destination="mode"/></connections></viewController></objects></scene></scenes></document>`;
const body = (prefix = 'NSString *result = [equation stringByReplacingOccurrencesOfString:@"x" withString:value];') => `
- (void)evaluate {
  if (mode.selectedSegmentIndex == 0) {
    ${prefix}
    if (mode.selectedSegmentIndex == 0) { self.title = @"first"; } else { self.title = @"second"; }
  } else {
    ${prefix}
    if (mode.selectedSegmentIndex == 0) { self.title = @"third"; } else { self.title = @"fourth"; }
  }
}`;
const source = (code = body()) => `@interface Panel : UIViewController {
IBOutlet UISegmentedControl *mode;
NSString *equation;
NSString *value;
}
@end
@implementation Panel
- (void)viewDidLoad { equation = @"x + 1"; value = [NSString stringWithFormat:@"%d", 1]; }
- (IBAction)run:(id)sender { [self evaluate]; }
${code}
@end`;
const proofs = (s = source(), xml = story, extras = []) => stableNativeGuards([{path:'Panel.m',text:s}, ...extras], [{path:'Main.storyboard',text:xml}]);
const textSource = (code = body('NSString *result = [equation stringByReplacingOccurrencesOfString:@"x" withString:entry.text]; NSLog(@"%@", [entry text]);')) => source(code).replace('IBOutlet UISegmentedControl *mode;', 'IBOutlet UISegmentedControl *mode;\nIBOutlet UITextField *entry;');
const textStory = story.replace('<segmentedControl id="mode"/>', '<segmentedControl id="mode"/><textField id="entry"/>').replace('<outlet property="mode" destination="mode"/>', '<outlet property="mode" destination="mode"/><outlet property="entry" destination="entry"/>');

test('plain scene-bound readonly text fields are a data getter only inside the synchronous guard interval', () => {
  assert.deepEqual(proofs(textSource(), textStory).map(p => p.outcome), ['false', 'true']);
  assert.equal(proofs(textSource(), story).length, 0);
  assert.equal(proofs(textSource().replace('UITextField *entry', 'UILabel *entry'), textStory).length, 0);
  const extra={path:'Other.m',text:'@interface Other : NSObject { UITextField *entry; } @end @implementation Other - (void)edit { [entry resignFirstResponder]; } @end'};
  assert.equal(proofs(textSource(), textStory, [extra]).length, 2);
});

test('text reads require strong unambiguous native bindings in every scene', () => {
  for(const [s,xml]of [
    [textSource(),textStory.replace('<textField id="entry"/>','<textField id="entry" customClass="CustomInput"/>')],
    [textSource(),textStory.replace('<textField id="entry"/>','<textField id="entry" customModule="Other"/>')],
    [textSource(),textStory.replace('<outlet property="entry" destination="entry"/>','<outlet property="entry" destination="entry"/><outletCollection property="entry" destination="mode"/>')],
    [textSource(),textStory.replace('<textField id="entry"/>','<textField id="entry"><userDefinedRuntimeAttributes><userDefinedRuntimeAttribute keyPath="text" type="image" value="other"/></userDefinedRuntimeAttributes></textField>')],
    [textSource(),textStory.replace('<textField id="entry"/>','<textField id="entry"><connections><outlet property="text" destination="mode"/></connections></textField>')],
    [textSource().replace('IBOutlet UITextField','__weak IBOutlet UITextField'),textStory],
    [textSource().replace('IBOutlet UITextField','__unsafe_unretained IBOutlet UITextField'),textStory],
    [textSource().replace('IBOutlet UITextField *entry;', 'IBOutlet UITextField *entry;\nIBOutlet UITextField *entry;'),textStory],
  ])assert.equal(proofs(s,xml).length,0);
  assert.equal(stableNativeGuards([{path:'Panel.m',text:textSource()}],[{path:'First.storyboard',text:textStory},{path:'Second.storyboard',text:story}]).length,0);
});

test('native text writes, slot replacement, alias escape and source string subclasses stay opaque', () => {
  for(const statement of ['entry = unknown;','entry.text = @"data";','[entry setText:@"data"];','id alias = entry;','escape(entry);','[self setValue:unknown forKeyPath:@"entry.text"];','id alias = [self valueForKey:@"entry"];','id alias = [self valueForKeyPath:key];','UITextField *entry = unknown;']){
    const s=textSource().replace('- (void)viewDidLoad {','- (void)viewDidLoad { '+statement);
    assert.equal(proofs(s,textStory).length,0,statement);
  }
  for(const extra of [
    {path:'Other.m',text:'@interface Evil : NSString @end'},
    {path:'Other.m',text:'@implementation UITextField (Hook) - (NSString *)text { change_native_control(); return @"data"; } @end'},
    {path:'Other.m',text:'#define text sideEffect'},
  ])assert.equal(proofs(textSource(),textStory,[extra]).length,0);
  assert.equal(proofs(textSource(body('NSLog(@"%@", entry);')),textStory).length,0);
});

test('a custom text-field delegate cannot borrow another plain field main-action root', () => {
  const s=source().replace('- (IBAction)run:', '- (BOOL)textFieldShouldReturn:(UITextField *)input { [self run:nil]; return YES; }\n- (IBAction)run:');
  const fields='<textField><connections><outlet property="delegate" destination="panel"/></connections></textField><textField customClass="CustomInput"><connections><outlet property="delegate" destination="panel"/></connections></textField>';
  assert.equal(proofs(s,story.replace('<button>',fields+'<button>')).length,0);
});

test('an immutable property-list local is data only after its inspected parse and readonly lifetime', () => {
  const declaration='NSDictionary *record = (NSDictionary *)[NSPropertyListSerialization propertyListWithData:bytes options:NSPropertyListImmutable format:&format error:&error]; if (!record) { NSLog(@"empty"); }';
  const code=body('NSString *result = [equation stringByReplacingOccurrencesOfString:@"x" withString:entry.text]; NSLog(@"%@", [record objectForKey:@"value"]);').replace('- (void)evaluate {','- (void)evaluate { '+declaration);
  assert.equal(proofs(textSource(code),textStory).length,2);
  for(const mutate of [
    s=>s.replace('NSPropertyListImmutable','NSPropertyListMutableContainers'),
    s=>s.replace('NSPropertyListSerialization propertyListWithData','Unknown propertyListWithData'),
    s=>s.replace('if (!record)', 'id alias = record; if (!record)'),
    s=>s.replace('if (!record)', 'record = unknown; if (!record)'),
    s=>s.replace('if (!record)', 'escape(&record); if (!record)'),
    s=>s.replace('NSDictionary *record','__block NSDictionary *record'),
    s=>s.replace('NSDictionary *record','if (condition) { NSDictionary *record').replace('if (!record)', '} if (!record)'),
    s=>'#define REPLACE record = unknown\n'+s.replace('if (!record)','REPLACE; if (!record)'),
    s=>'#define INNER record = unknown\n#define REPLACE INNER\n'+s.replace('if (!record)','REPLACE; if (!record)'),
    s=>'#define REPLACE(x) rec ## x = unknown\n'+s.replace('if (!record)','REPLACE(ord); if (!record)'),
    s=>s.replace('NSDictionary *record', 'id NSPropertyListSerialization = self; NSDictionary *record'),
  ])assert.equal(proofs(mutate(textSource(code)),textStory).length,0);
  const fake={path:'Other.m',text:'@implementation NSPropertyListSerialization (Hook) + (id)propertyListWithData:(id)b options:(int)o format:(id)f error:(id)e { return unknown; } @end'};
  assert.equal(proofs(textSource(code),textStory,[fake]).length,0);
  const unrelated='#define DISCARD(x) [x release]\n'+textSource(code).replace('if (!record)', 'DISCARD(other); if (!record)');
  assert.equal(proofs(unrelated,textStory).length,2);
});

test('Foundation formatting, copying and private-class hooks cannot enter a supposedly data-only interval', () => {
  for(const text of [
    '@implementation NSDictionary (Hook) - (NSString *)descriptionWithLocale:(id)value { show_ui(); return @"data"; } @end',
    '@implementation NSArray (Hook) - (NSString *)descriptionWithLocale:(id)value indent:(int)i { show_ui(); return @"data"; } @end',
    '@implementation NSString (Hook) - (id)copyWithZone:(id)zone { show_ui(); return self; } @end',
    '@implementation __NSCFString (Hook) - (NSString *)description { show_ui(); return self; } @end',
    '@implementation NSAttributedString (Hook) - (NSString *)string { show_ui(); return @"data"; } @end',
    '@implementation NSString (Hook) - (id)initWithString:(id)s { show_ui(); return self; } @end',
    '@implementation NSDecimalNumber (Hook) + (void)initialize { show_ui(); } @end',
  ])assert.equal(proofs(textSource(),textStory,[{path:'Hook.m',text}]).length,0);
});

test('source-bound native action admits only contradictory nested outcomes after closed string operations', () => {
  const p = proofs();
  assert.deepEqual(p.map(p => p.outcome), ['false', 'true']);
  assert.ok(p.every(p => p.path === 'Panel.m' && p.intervalStart < p.intervalEnd && p.enclosingGuardOffset < p.offset));
});

test('UI effects, calls, callbacks, writes and unknown fields keep the outcome pending', () => {
  for (const prefix of [
    'self.title = @"changed";', '[self update];', 'unknown_hook();',
    'dispatch_async(dispatch_get_main_queue(), ^{ mode.selectedSegmentIndex = 1; });',
    'mode.selectedSegmentIndex = 1;', 'mode = other;', '[mode setSelectedSegmentIndex:1];',
    'NSString *result = [unknown stringByReplacingOccurrencesOfString:@"x" withString:value];',
    'NSString *result = [equation objectForKey:@"x"];',
    'NSLog(@"%@", self);',
  ]) assert.equal(proofs(source(body(prefix))).length, 0, prefix);
});

test('declared fields, unknown producers, indirect writes and overrides do not establish concrete data', () => {
  for (const mutate of [
    s => s.replace('equation = @"x + 1";', 'equation = unknown;'),
    s => s.replace('equation = @"x + 1";', ''),
    s => s.replace('equation = @"x + 1";', 'equation = (NSString *)self;'),
    s => s.replace('equation = @"x + 1";', '[self setValue:self forKey:@"equation"];'),
    s => s + '\n@implementation NSString (Hidden) - (id)stringByReplacingOccurrencesOfString:(id)a withString:(id)b { show_ui(); } @end',
    s => '#define stringByReplacingOccurrencesOfString otherSelector\n' + s,
    s => '#define if(x) altered(x)\n' + s,
    s => s.replace('@end\n@implementation', '@property id equation;\n@end\n@implementation'),
    s => s.replace('- (void)viewDidLoad', '- (void)setEquation:(id)e { equation = e; }\n- (void)viewDidLoad'),
  ]) assert.equal(proofs(mutate(source())).length, 0, String(mutate));
});

test('unbound actions, ambiguous controls, weak ownership and asynchronous entry remain unresolved', () => {
  for (const [s, xml] of [
    [source(), story.replace('selector="run:"', 'selector="other:"')],
    [source(), story.replace('<segmentedControl id="mode"/>', '<segmentedControl id="mode" customClass="CustomControl"/>')],
    [source(), story.replace('<outlet property="mode" destination="mode"/>', '<outlet property="mode" destination="mode"/><outlet property="mode" destination="mode"/>')],
    [source(), story.replace('<outlet property="mode" destination="mode"/>', '<outletCollection property="equation" destination="mode"/><outlet property="mode" destination="mode"/>')],
    [source(), story.replace('id="mode"/>', 'id="mode" invalid=unquoted/>')],
    [source().replace('IBOutlet UISegmentedControl', '__weak IBOutlet UISegmentedControl'), story],
    [source().replace('[self evaluate];', 'dispatch_async(dispatch_get_main_queue(), ^{ [self evaluate]; });'), story],
    [source().replace('- (IBAction)run:', '- (void)run:'), story],
    [source() + '\n@implementation Panel (Override) - (NSInteger)selectedSegmentIndex { return 1; } @end', story],
    [source() + '\n@interface Subpanel : Panel @end', story],
  ]) assert.equal(proofs(s, xml).length, 0);
});

test('shadowed receivers, dormant blocks and reflective invocation cannot borrow an action proof', () => {
  for (const s of [
    source().replace('- (void)evaluate {', '- (void)evaluate { UISegmentedControl *mode = unknownControl;'),
    source().replace('- (void)evaluate {', '- (void)evaluate { NSString *equation = (NSString *)self;'),
    source().replace(body(), '- (void)evaluate { void (^dormant)(void) = ^{' + body().slice(body().indexOf('{')+1,-1) + '}; }'),
    source() + '\n@implementation Caller - (void)call:(id)target { [target performSelector:NSSelectorFromString(@"evaluate")]; } @end',
    source().replace('value = [NSString stringWithFormat:@"%d", 1];', 'value = [NSString stringWithFormat:@"%d" unknown:1];'),
  ]) assert.equal(proofs(s).length, 0, s);
});

test('a bound standard text-field Return delegate may synchronously call its original UI action', () => {
  const s = source().replace('- (IBAction)run:', '- (BOOL)textFieldShouldReturn:(UITextField *)field { [self run:nil]; return YES; }\n- (IBAction)run:');
  const xml = story.replace('<button>', '<textField><connections><outlet property="delegate" destination="panel"/></connections></textField><button>');
  assert.equal(proofs(s, xml).length, 2);
  assert.equal(proofs(s, story).length, 0);
  assert.equal(proofs(s, xml.replace('<textField>', '<textField customClass="CustomField">')).length, 0);
  assert.equal(proofs(s.replace('(UITextField *)field', '(id)field'), xml).length, 0);
});

test('unrelated resource owners and HTTP header setters cannot masquerade as writes to an own ivar', () => {
  const extra = {path:'Other.m',text:'@interface Other : NSObject @property id equation; @end @implementation Other - (void)configure { [request setValue:value forHTTPHeaderField:@"X-Test"]; } @end'};
  assert.equal(proofs(source(), story, [extra]).length, 2);
  assert.equal(proofs(source(), story, [{...extra,text:extra.text.replace('forHTTPHeaderField:@"X-Test"', 'forKey:@"equation"')}]).length, 0);
});

test('indirect native receiver replacement, unsupported source languages and runtime IMPs remain opaque', () => {
  for (const extra of [
    {path:'Other.m',text:'@implementation Other - (void)change:(id)x { [x setValue:unknown forKey:@"mode"]; } @end'},
    {path:'Other.m',text:'#define CHANGE_RECEIVER mode = unknown'},
    {path:'Other.m',text:'void change(void) { method_getImplementation(method); }'},
    {path:'Other.swift',text:'func change(_ object: AnyObject) { object.setValue(other, forKey: "mode") }'},
  ]) assert.equal(proofs(source(), story, [extra]).length, 0);
});

test('selectors cannot escape through timers or source class aliases', () => {
  const direct = '@interface Utility : NSObject @end @implementation Registry - (void)register { SEL local = NSSelectorFromString(name); if ([Utility respondsToSelector:local]) [Utility performSelector:local]; } @end';
  assert.equal(proofs(source(), story, [{path:'Registry.m',text:direct}]).length, 2);
  for (const text of [
    direct.replace('[Utility performSelector:local]', '[timer setSelector:local]'),
    direct.replace('[Utility performSelector:local]', '[Panel performSelector:local]'),
    direct.replace('[Utility performSelector:local]', '[object performSelector:local]'),
    direct.replace('[Utility performSelector:local]', 'saveSelector(local)'),
    direct.replace('[Utility performSelector:local]', 'alias = local'),
  ]) assert.equal(proofs(source(), story, [{path:'Registry.m',text}]).length, 0);
});

test('native control aliases and shadowed Foundation class identifiers are not ownership evidence', () => {
  for (const mutate of [
    s => s.replace('- (void)evaluate {', '- (void)evaluate { UISegmentedControl *mode;'),
    s => s.replace('equation = @"x + 1";', 'id NSString = self; equation = [NSString stringWithFormat:@"x"];'),
    s => s.replace('equation = @"x + 1";', 'saveControl(mode); equation = @"x + 1";'),
    s => s + '\n@implementation UISegmentedControl (Hook) - (void)setTitleTextAttributes:(id)a forState:(int)s { saveControl(self); } @end',
    s => s + '\n@implementation NSString (Hook) - (void)dealloc { show_ui(); } @end',
  ]) assert.equal(proofs(mutate(source())).length, 0);
});


test('fresh canonical discovery preserves source IDs and requires an explicit review for each guard annotation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'canvas-native-guard-'));
  try {
    await writeFile(join(root, 'Panel.m'), source());
    await writeFile(join(root, 'Main.storyboard'), story);
    const first = await discoverSources(root), eligible = d => d.obligations.filter(o => o.nonRenderingOutcome?.kind === 'objc-stable-native-guard');
    assert.equal(eligible(first).length, 2);
    const inventory = d => ({obligations:d.obligations,items:d.obligations.map(o => ({id:o.id,sources:[o.path],cases:['case-'+o.id]})),reviews:d.obligations.map(o =>
      eligible(d).includes(o) ? {id:o.id,nonUiReason:'Contradictory nested outcome after the source-bound synchronous native control read.'} : {id:o.id,items:[o.id]})});
    assert.equal(checkDiscoveryCoverage(first, inventory(first)).reviewed, first.obligations.length);
    const without = inventory(first); without.reviews = without.reviews.filter(r => r.id !== eligible(first)[0].id);
    assert.throws(()=>checkDiscoveryCoverage(first, without), /source obligations unreviewed/);
    await writeFile(join(root, 'Main.storyboard'), story.replace('<button>', '<button id="submit">'));
    const changed = await discoverSources(root);
    assert.deepEqual(eligible(changed).map(o=>o.id), eligible(first).map(o=>o.id));
    assert.notEqual(eligible(changed)[0].nonRenderingOutcome.dependencyDigest, eligible(first)[0].nonRenderingOutcome.dependencyDigest);
    await writeFile(join(root, 'Main.storyboard'), story.replace('<segmentedControl id="mode"/>', '<segmentedControl id="mode" customClass="CustomControl"/>'));
    const unsafe = await discoverSources(root); assert.equal(eligible(unsafe).length, 0);
    const forged = inventory(unsafe);
    for (const o of eligible(first)) { const r = forged.reviews.find(r=>r.id===o.id); delete r.items; r.nonUiReason = 'Copied inventory annotation is insufficient.'; }
    assert.throws(()=>checkDiscoveryCoverage(unsafe, forged), /Rendering source cannot be dismissed/);
  } finally { await rm(root, {recursive:true,force:true}); }
});

test('a capability-closed Swift data model does not authorize Swift UI, reflection or opaque calls', () => {
  const model = '@objc class Record: NSObject { var code: String = "data"; @objc func getCode() -> String { return self.code } }';
  assert.equal(proofs(source(), story, [{path:'Record.swift',text:model}]).length, 2);
  for (const text of [
    model.replace('return self.code', 'unknownNative(); return self.code'),
    model.replace('return self.code', 'object.setValue(other, forKey: "mode"); return self.code'),
    model.replace('return self.code', 'timer.selector = Selector("run:"); return self.code'),
    model.replace('getCode()', 'getCode(target: AnyObject)'),
    model.replace('getCode()', 'getCode(target: NSObject)'),
    model.replace('@objc class', '@objc(Panel) class'),
    model.replace('return self.code', 'return "\\(unknownNative())"'),
    'import UIKit\n' + model,
    'extension UISegmentedControl { func mutate() {} }',
  ]) assert.equal(proofs(source(), story, [{path:'Record.swift',text}]).length, 0);
});

test('Swift AnyObject conversions require concrete data producers and fresh dictionaries', () => {
  const s = '@objc class Record: NSObject { var code: String = "data"; func convert() -> Data { var values = [String:AnyObject](); values["key"] = code as AnyObject; return Data() } }';
  assert.equal(proofs(source(), story, [{path:'Record.swift',text:s}]).length, 2);
  for (const text of [
    s.replace('code as AnyObject', 'coder.decodeObject(forKey:"other") as AnyObject'),
    s.replace('[String:AnyObject]()', 'coder.decodeObject(forKey:"other") as! [String:AnyObject]'),
    s.replace('func convert()', 'func convert(input: [String:AnyObject])'),
    s.replace('code as AnyObject', 'self as AnyObject'),
  ]) assert.equal(proofs(source(), story, [{path:'Record.swift',text}]).length, 0);
});

test('unparsed owner writers, multiline macros and opaque C self escapes cannot establish data origins', () => {
  for (const mutate of [
    s => s.replace('- (void)viewDidLoad', '- (void)更新 { equation = (NSString *)self; }\n- (void)viewDidLoad'),
    s => '#define REWRITE(x) \\\n equation = (NSString *)x\n' + s,
    s => '#define REWRITE(x,k) [x setValue:unknown forKey:@#k]\n' + s.replace('equation = @"x + 1";', 'REWRITE(self,equation); equation = @"x + 1";'),
    s => s.replace('equation = @"x + 1";', 'opaque_native(self); equation = @"x + 1";'),
  ]) assert.equal(proofs(mutate(source())).length, 0);
});

test('literal scheduler continuations retain inspected writers and never become a permitted guard interval', () => {
  const before = '- (void)observe { dispatch_after(0, queue, ^{ NSLog(@"%@", self); }); }\n';
  assert.equal(proofs(source(before + body())).length, 2);
  assert.equal(proofs(source(before.replace('NSLog(@"%@", self);', 'equation = (NSString *)self;') + body())).length, 0);
  assert.equal(proofs(source(body('dispatch_after(0, queue, ^{ NSLog(@"%@", self); });'))).length, 0);
});
