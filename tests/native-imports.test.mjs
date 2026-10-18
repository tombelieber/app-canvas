import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceObligations as rawObligations,maskedSource} from '../lib/source-obligations.mjs';
import {annotateJavaImportOutcomes} from '../lib/native-imports.mjs';
import {discoverSources} from '../lib/inventory.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
function sourceObligations(source,extension){const rows=rawObligations(source,extension).map(o=>({...o,...o.details}));if(extension==='.java')annotateJavaImportOutcomes(maskedSource(source),rows);return rows;}

test('fresh Java import annotations preserve the existing version 2 worklist identity',async t=>{
 const root=await mkdtemp(join(tmpdir(),'canvas-import-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(join(root,'Screen.java'),'import android.app.AlertDialog;\nclass Screen extends Activity {}');
 const d=await discoverSources(root),o=d.obligations.find(o=>o.kind==='presentation');
 assert.equal(o.id,'6bea0bbbb3adac62963187968c7e4907ca77a6a83e64cbe46ef77f5f66990e62');
 assert.equal(o.nonRenderingOutcome?.kind,'java-import-declaration');
 assert.ok(d.obligations.find(o=>o.kind==='file').nativeUi,'The actual UI class remains required');
});

test('a Java UI type import stays in the review queue without pretending to present UI',()=>{
 const rows=sourceObligations('import androidx.appcompat.app.AlertDialog;\nclass Screen extends Activity {}','.java');
 assert.equal(rows.length,1);assert.equal(rows[0].kind,'presentation');
 assert.equal(rows[0].nonRenderingOutcome?.kind,'java-import-declaration');
});

test('constructors, calls, field declarations and extra statements retain their rendering review',()=>{
 for(const source of ['new AlertDialog.Builder(this).show();','AlertDialog active;','import android.app.AlertDialog; new AlertDialog.Builder(this);','class Example { void show() {} }']){
  const rows=sourceObligations(source,'.java');assert.ok(rows.length>0);
  assert.ok(rows.every(r=>!r.nonRenderingOutcome),source);
 }
});

test('only complete Java import declarations receive the proof, including commented imports and static bindings',()=>{
 for(const source of ['import /* UI type */ android.app.AlertDialog;','import static android.app.AlertDialog.*;'])assert.equal(sourceObligations(source,'.java')[0].nonRenderingOutcome?.kind,'java-import-declaration');
 assert.ok(!sourceObligations('import android.app.AlertDialog;','.kt')[0].nonRenderingOutcome);
 assert.equal(sourceObligations('// import android.app.AlertDialog;','.java').length,0);
});
