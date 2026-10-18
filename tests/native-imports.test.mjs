import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceObligations} from '../lib/source-obligations.mjs';

test('a Java UI type import stays in the review queue without pretending to present UI',()=>{
 const rows=sourceObligations('import androidx.appcompat.app.AlertDialog;\nclass Screen extends Activity {}','.java');
 assert.equal(rows.length,1);assert.equal(rows[0].kind,'presentation');
 assert.equal(rows[0].details.nonRenderingOutcome?.kind,'java-import-declaration');
});

test('constructors, calls, field declarations and extra statements retain their rendering review',()=>{
 for(const source of ['new AlertDialog.Builder(this).show();','AlertDialog active;','import android.app.AlertDialog; new AlertDialog.Builder(this);','class Example { void show() {} }']){
  const rows=sourceObligations(source,'.java');assert.ok(rows.length>0);
  assert.ok(rows.every(r=>!r.details.nonRenderingOutcome),source);
 }
});

test('only complete Java import declarations receive the proof, including commented imports and static bindings',()=>{
 for(const source of ['import /* UI type */ android.app.AlertDialog;','import static android.app.AlertDialog.*;'])assert.equal(sourceObligations(source,'.java')[0].details.nonRenderingOutcome?.kind,'java-import-declaration');
 assert.ok(!sourceObligations('import android.app.AlertDialog;','.kt')[0].details.nonRenderingOutcome);
 assert.equal(sourceObligations('// import android.app.AlertDialog;','.java').length,0);
});
