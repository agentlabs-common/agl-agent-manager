const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const{parseStep,AntigravityBackend}=require('../antigravity-backend.js');const{agyOutput}=require('../scripts/agl-skill-check.cjs');const{registerAgyHook}=require('../delivery.cjs');const{LABELS}=require('../agents.js');
test('Antigravity transcript: user requests and model replies become voice-pane items; system steps are skipped',()=>{const h={items:new Map(),views:new Map()};
 parseStep(JSON.stringify({step_index:0,source:'USER_EXPLICIT',type:'USER_INPUT',created_at:'t0',content:'<USER_REQUEST>\nReply with pong\n</USER_REQUEST>\n<ADDITIONAL_METADATA>x</ADDITIONAL_METADATA>'}),h);
 parseStep(JSON.stringify({step_index:1,source:'MODEL',type:'PLANNER_RESPONSE',created_at:'t1',content:'**pong** done <voice>Said pong.</voice>'}),h);
 parseStep(JSON.stringify({step_index:2,source:'SYSTEM',type:'SYSTEM_MESSAGE',content:'ignored'}),h);parseStep('not json',h);
 const items=[...h.items.values()];assert.equal(items.length,2);assert.deepEqual([items[0].text,items[0].you],['Reply with pong',true]);assert.equal(items[1].text,'pong done');assert.equal(items[1].speechText,'Said pong.');});
test('Antigravity rows, launch args and refusals match the other providers',async()=>{const b=new AntigravityBackend({scope:{cwd:'/w'},agy:'/x/agy'});b.liveIds=async()=>new Set(['11111111-2222-3333-4444-555555555555']);
 const rows=await b.rows([{sessionId:'11111111-2222-3333-4444-555555555555',cwd:'/w/a',title:'Live one'},{sessionId:'22222222-2222-3333-4444-555555555555',cwd:'/w/b'}]);
 assert.deepEqual(rows.map(r=>[r.provider,r.live,r.state,r.name]),[['antigravity',true,'running','Live one'],['antigravity',false,'closed','Antigravity']]);assert.match(rows[0].key,/^antigravity:/);
 assert.deepEqual(b.argv('22222222-2222-3333-4444-555555555555',true),['/x/agy','--conversation','22222222-2222-3333-4444-555555555555','--dangerously-skip-permissions']);
 await assert.rejects(b.deleteSession({sessionId:'22222222-2222-3333-4444-555555555555'}),/cannot delete/);assert.throws(()=>b.validId('session_x'),/Invalid Antigravity session ID/);assert.equal(LABELS.antigravity,'Antigravity');});
test('agy hook: a note is injected once per conversation before model calls, always at session start',()=>{const home=fs.mkdtempSync(path.join(os.tmpdir(),'agl-agy-'));try{
 const first=agyOutput('AGL: note',{conversationId:'c1',hookEventName:'PreInvocation'},home);assert.equal(first.injectSteps[0].systemMessage.systemMessage,'AGL: note');
 assert.deepEqual(agyOutput('AGL: note',{conversationId:'c1',hookEventName:'PreInvocation'},home),{});assert.ok(agyOutput('AGL: note',{conversationId:'c1',hookEventName:'SessionStart'},home).injectSteps);
 assert.ok(agyOutput('AGL: new note',{conversationId:'c1',hookEventName:'PreInvocation'},home).injectSteps);assert.deepEqual(agyOutput('',{conversationId:'c1'},home),{});}finally{fs.rmSync(home,{recursive:true,force:true});}});
test('agy hook registration: only with ~/.gemini/config, once, keeps other hooks and backs the file up',async()=>{const home=fs.mkdtempSync(path.join(os.tmpdir(),'agl-agyhook-'));try{
 assert.equal(await registerAgyHook(home,'node /x/agl-skill-check.cjs'),'no antigravity');const dir=path.join(home,'.gemini','config');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'hooks.json'),JSON.stringify({mine:{Stop:[{command:'x'}]}}));
 assert.equal(await registerAgyHook(home,'node /x/agl-skill-check.cjs'),'added');assert.equal(await registerAgyHook(home,'node /x/agl-skill-check.cjs'),'present');
 const hooks=JSON.parse(fs.readFileSync(path.join(dir,'hooks.json'),'utf8'));assert.deepEqual(hooks.mine,{Stop:[{command:'x'}]});assert.equal(hooks['agl-agent-manager'].PreInvocation[0].command,'node /x/agl-skill-check.cjs --agy');assert.ok(fs.existsSync(path.join(dir,'hooks.json.agl-backup')));}finally{fs.rmSync(home,{recursive:true,force:true});}});
