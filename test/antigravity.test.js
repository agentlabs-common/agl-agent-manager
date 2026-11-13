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
test('agy hook: after the inbox empties, a message worded like the last one is injected again',()=>{const home=fs.mkdtempSync(path.join(os.tmpdir(),'agl-agy2-'));try{const p={conversationId:'c9',hookEventName:'PreInvocation'};const note='AGL: 1 new message from claude/hrms-lead.';
 assert.ok(agyOutput(note,p,home).injectSteps);assert.deepEqual(agyOutput(note,p,home),{});assert.deepEqual(agyOutput('',p,home),{});assert.ok(agyOutput(note,p,home).injectSteps,'second message with the same wording');
 assert.deepEqual(agyOutput('',p,home),{});assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home,'.config','agentlabs','agl','.agy-seen.json'),'utf8')),{});}finally{fs.rmSync(home,{recursive:true,force:true});}});
test('a never-prompted Antigravity conversation linked to its seat is listed and can be opened',async()=>{const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'agl-agyseat-')));try{
 fs.writeFileSync(path.join(root,'.agl-session.json'),JSON.stringify({name:'tester',conversations:[{provider:'antigravity',sessionId:'33333333-2222-3333-4444-555555555555'},{provider:'claude',sessionId:'44444444-2222-3333-4444-555555555555'}]}));
 const b=new AntigravityBackend({scope:{cwd:root},agy:'/x/agy'});b.list=async()=>[];b.liveIds=async()=>new Set();
 const rows=await b.sessionsUnder([root]);assert.deepEqual(rows.map(r=>[r.sessionId.slice(0,8),r.cwd,r.name]),[['33333333',root,'tester']]);
 const p=await b.prepare({sessionId:'33333333-2222-3333-4444-555555555555'});assert.deepEqual(p.argv,['/x/agy','--conversation','33333333-2222-3333-4444-555555555555']);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('YOLO is remembered on the seat: a conversation started or restarted in YOLO reopens in YOLO; rebinding keeps it',async()=>{const engine=require('../workspace-engine.cjs');const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'agl-yolo-')));try{
 const seat=path.join(root,'.sessions','antigravity','t');fs.mkdirSync(seat,{recursive:true});const sid='55555555-2222-3333-4444-555555555555';
 fs.writeFileSync(path.join(seat,'.agl-session.json'),JSON.stringify({version:1,baseBranch:'main',workspaceRoot:root,sessionRoot:seat,agent:'antigravity',name:'t',folder:'t',branch:'antigravity/t',createdAt:'2026-11-13T00:00:00.000Z',repositories:[]}));
 const b=new AntigravityBackend({scope:{cwd:seat},agy:'/x/agy'});b.list=async()=>[];b.liveIds=async()=>new Set();
 await engine.dispatch({action:'bind',root,agent:'antigravity',folder:'t',provider:'antigravity',sessionId:sid});assert.deepEqual((await b.prepare({sessionId:sid})).argv,['/x/agy','--conversation',sid]);
 await b.rememberYolo(sid,seat);assert.deepEqual((await b.prepare({sessionId:sid})).argv,['/x/agy','--conversation',sid,'--dangerously-skip-permissions']);
 await engine.dispatch({action:'bind',root,agent:'antigravity',folder:'t',provider:'antigravity',sessionId:sid});assert.equal(JSON.parse(fs.readFileSync(path.join(seat,'.agl-session.json'),'utf8')).conversations[0].yolo,true,'rebinding without yolo keeps it');
 }finally{fs.rmSync(root,{recursive:true,force:true});}});
