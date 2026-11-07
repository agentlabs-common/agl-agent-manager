const{test}=require('node:test');const assert=require('node:assert/strict');const{Attention}=require('../attention.js');
test('attention dots: permission prompts and blocked agents are urgent; a finished reply is unread until seen or on screen',()=>{const a=new Attention();
 let r=a.update([{key:'p',status:'waiting',waitingFor:'permission prompt',state:'blocked'},{key:'b',status:'idle',state:'blocked'},{key:'w',status:'busy',state:'working'},{key:'v',status:'busy'}]);
 assert.deepEqual(r.get('p'),{reason:'Waiting for your permission',urgent:true});assert.equal(r.get('b').reason,'Waiting for you');assert.ok(!r.has('w'));
 r=a.update([{key:'w',status:'idle',state:'done'},{key:'v',status:'idle'}],key=>key==='v');assert.deepEqual(r.get('w'),{reason:'New reply',urgent:false});assert.ok(!r.has('v'),'reply seen on screen is not unread');
 a.seen('w');assert.ok(!a.update([{key:'w',status:'idle',state:'done'}]).has('w'));
 a.update([{key:'w',status:'busy'}]);assert.ok(a.update([{key:'w',status:'idle'}]).has('w'));a.update([{key:'w',status:'busy'}]);assert.ok(!a.unread.has('w'),'starting work again clears unread');});
