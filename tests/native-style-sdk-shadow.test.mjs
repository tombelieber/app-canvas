import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {discoverSources} from '../lib/discovery.mjs';
import {checkDiscoveryCoverage} from '../lib/discovery-coverage.mjs';

const module='android/app/',res=module+'src/main/res/',base=res+'values/styles.xml',replacement=res+'values-v21/themes.xml';
const style='<style name="ExampleTheme" parent="Theme.Material"><item name="colorPrimary">#223344</item><item name="android:windowNoTitle">true</item></style>';
const wrap=s=>'<resources>'+s+'</resources>';
const sources=()=>({[module+'build.gradle']:'android {\n defaultConfig {\n minSdk 21\n }\n}\n',[base]:wrap(style+'<style name="OtherTheme"><item name="colorPrimary">#112233</item></style>'),[replacement]:wrap(style.replace('#223344','#556677'))});
async function scan(t,entries){const root=await mkdtemp(join(tmpdir(),'canvas-style-shadow-'));t.after(()=>rm(root,{recursive:true,force:true}));for(const[path,body]of Object.entries(entries)){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),body);}return discoverSources(root);}
const annotations=d=>d.obligations.filter(o=>o.resourceSelection?.kind==='android-version-shadowed-style');

test('same-name version-only style entry shadows only its old declaration/items, not neighboring UI or roots',async t=>{
 const d=await scan(t,sources()),proof=annotations(d);assert.equal(proof.length,3);
 for(const o of proof){assert.equal(o.path,base);assert.equal(o.kind,'element');assert.equal(o.nonRenderingConfiguration,true);assert.equal(o.resourceSelection.styleName,'ExampleTheme');assert.equal(o.resourceSelection.constraint.minimum,'21');assert.equal(o.resourceSelection.replacement,replacement);assert.equal(o.resourceSelection.replacementApi,21);assert.equal(o.resourceSelection.replacementSha256,d.files.find(f=>f.path===replacement).sha256);}
 assert.ok(d.obligations.some(o=>o.path===base&&o.kind==='element'&&!o.nonRenderingConfiguration));assert.ok(!d.obligations.some(o=>['file','region'].includes(o.kind)&&o.resourceSelection));
});

test('fresh canonical entry proof permits a specific non-UI review inside a file that still renders other styles',async t=>{
 const d=await scan(t,sources()),proof=annotations(d);assert.equal(proof.length,3);
 const inv={obligations:d.obligations,items:[{id:'visible',sources:d.files.map(f=>f.path),cases:['original']}],reviews:d.obligations.map(o=>o.resourceSelection?{id:o.id,nonUiReason:'This exact default style entry is dominated throughout the literal supported SDK range.'}:{id:o.id,items:['visible']})};assert.doesNotThrow(()=>checkDiscoveryCoverage(d,inv));
});

test('forged recorded annotation cannot waive a style without fresh selection proof',async t=>{
 const s=sources();s[module+'build.gradle']=s[module+'build.gradle'].replace('21','20');const d=await scan(t,s);assert.equal(annotations(d).length,0);
 const target=d.obligations.find(o=>o.path===base&&o.kind==='element'&&o.offset>0),inv={obligations:d.obligations.map(o=>o.id===target.id?{...o,nonRenderingConfiguration:true,resourceSelection:{kind:'android-version-shadowed-style'}}:o),items:[{id:'visible',sources:d.files.map(f=>f.path),cases:['original']}],reviews:d.obligations.map(o=>o.id===target.id?{id:o.id,nonUiReason:'Forged default style waiver'}:{id:o.id,items:['visible']})};assert.throws(()=>checkDiscoveryCoverage(d,inv),/Rendering source/);
});

for(const[name,mutate]of[
 ['lower supported SDK',s=>s[module+'build.gradle']=s[module+'build.gradle'].replace('21','20')],
 ['dynamic SDK',s=>s[module+'build.gradle']=s[module+'build.gradle'].replace('21','rootProject.minimumApi')],
 ['lower flavor SDK',s=>s[module+'build.gradle']+='android { productFlavors { legacy {\n minSdk 19\n} } }'],
 ['source-set override',s=>s[module+'build.gradle']+='android { sourceSets { main.res.srcDirs = ["other"] } }'],
 ['resource configuration filter',s=>s[module+'build.gradle']+='android { defaultConfig { resConfigs "v19" } }'],
 ['custom resource packager',s=>s[module+'build.gradle']+='android { androidResources { additionalParameters += "opaque" } }'],
 ['dynamic shrinker',s=>s[module+'build.gradle']+='android { buildTypes { release { shrinkResources project.flag } } }'],
 ['direct resource-table loader',s=>s[module+'src/main/java/Loader.java']='class Loader { void load() { ResourcesProvider.loadFromApk(input); } }'],
 ['quoted reflective loader',s=>s[module+'src/main/java/Loader.java']='class Loader { String method = "addAssetPath"; }'],
 ['Unicode-escaped reflective loader',s=>s[module+'src/main/java/Loader.java']='class Loader { String method = "\\u0061ddAssetPath"; }'],
 ['octal-escaped reflective loader',s=>s[module+'src/main/java/Loader.java']='class Loader { String method = "\\141ddAssetPath"; }'],
 ['concatenated reflective loader',s=>s[module+'src/main/java/Loader.java']='class Loader { String method = "add" + "AssetPath"; }'],
 ['direct source file access',s=>s[module+'src/main/java/Loader.java']='class Loader { String file = "res/values/styles.xml"; }'],
 ['concatenated source file access',s=>s[module+'src/main/java/Loader.java']='class Loader { String file = "res/values/" + "styles.xml"; }'],
 ['duplicate old style entry',s=>s[res+'values/themes.xml']=wrap(style)],
 ['duplicate selected style entry',s=>s[res+'values-v21/duplicate.xml']=wrap(style)],
 ['selected style alias',s=>s[replacement]=wrap('<item type="style" name="ExampleTheme">@style/OtherTheme</item>')],
 ['additional selected qualifier',s=>{s[res+'values-land-v21/themes.xml']=s[replacement];delete s[replacement];}],
 ['lower qualified bag',s=>{s[res+'values-land/styles.xml']=s[base];delete s[base];}],
 ['opaque parent',s=>s[replacement]=wrap(style.replace('Theme.Material','?attr/parentStyle'))],
 ['self parent',s=>s[replacement]=wrap(style.replace('Theme.Material','ExampleTheme'))],
 ['malformed XML',s=>s[replacement]='<resources>'+style],
 ['duplicate XML attribute',s=>s[replacement]=wrap(style.replace('name="ExampleTheme"','name="ExampleTheme" name="OtherTheme"'))],
 ['external entity declaration',s=>s[replacement]='<!DOCTYPE resources SYSTEM "other.xml">'+wrap(style)],
 ['opaque XML instruction',s=>s[replacement]='<?unknown input?>'+wrap(style)],
 ['style markup only in string',s=>s[replacement]=wrap('<string name="template"><![CDATA['+style+']]></string>')],
 ['nested style item markup',s=>s[replacement]=wrap(style.replace('#223344','<shape/>'))],
 ['duplicate style item',s=>s[replacement]=wrap(style.replace('</style>','<item name="colorPrimary">#889999</item></style>'))],
 ['undeclared XML entity',s=>s[replacement]=wrap(style.replace('#223344','&unknown;'))],
 ['repeated XML declaration',s=>s[replacement]='<?xml version="1.0"?><?xml version="1.0"?>'+wrap(style)],
])test('style dominance stays pending for '+name,async t=>{const s=sources();mutate(s);assert.equal(annotations(await scan(t,s)).length,0);});

test('literal standard shrinkers and ordinary higher API alternatives preserve the bounded proof',async t=>{
 const s=sources();s[module+'build.gradle']+='android { buildTypes { debug {\n shrinkResources false\n } release {\n isShrinkResources = true\n } } }';s[res+'values-v24/themes.xml']=wrap(style);const d=await scan(t,s);assert.equal(annotations(d).length,3);assert.ok(annotations(d).every(o=>o.resourceSelection.replacementApi===21));
});

test('plain resource-container text cannot define or hide a named style entry',async t=>{
 const s=sources();s[res+'values/colors.xml']='<resources><color name="ink">#000000</color>--></resources>';s[replacement]=wrap(style+' &lt;style name="ExampleTheme"/&gt;');const d=await scan(t,s);assert.equal(annotations(d).length,3);
});

test('highest alternative at the supported floor shadows each lower entry and preserves existing IDs',async t=>{
 const s=sources();s[module+'build.gradle']=s[module+'build.gradle'].replace('21','26');s[res+'values-v24/themes.xml']=wrap(style);const d=await scan(t,s);assert.equal(annotations(d).length,6);assert.ok(annotations(d).every(o=>o.resourceSelection.replacementApi===24));
 const noReplacement={...s};delete noReplacement[replacement];delete noReplacement[res+'values-v24/themes.xml'];const before=await scan(t,noReplacement);assert.deepEqual(d.obligations.filter(o=>o.path===base).map(o=>o.id),before.obligations.filter(o=>o.path===base).map(o=>o.id));
});
