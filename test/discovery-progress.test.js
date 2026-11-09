const {test}=require('node:test');const assert=require('node:assert/strict');
const {SessionBackend}=require('../sessions');
test('Claude agents become available before a slow Codex provider completes',async()=>{
 const backend=new SessionBackend({scope:{cwd:process.cwd()},providers:['claude','codex']});
 let finish;backend.claudeBackend.sessionsUnder=async()=>[{sessionId:'claude-seat'}];
 backend.codexBackend.sessionsUnder=()=>new Promise(resolve=>{finish=resolve;});
 const updates=[];const pending=backend.sessionsUnder(['/workspace'],[],u=>updates.push(u));
 await new Promise(setImmediate);
 assert.equal(updates.length,1);assert.equal(updates[0].rows[0].sessionId,'claude-seat');
 finish([{sessionId:'codex-seat'}]);const rows=await pending;
 assert.deepEqual(rows.map(r=>r.provider),['claude','codex']);backend.dispose();
});
test('failure of one provider preserves successful discovery with a warning',async()=>{
 const backend=new SessionBackend({scope:{cwd:process.cwd()},providers:['claude','codex']});
 backend.claudeBackend.sessionsUnder=async()=>[{sessionId:'seat'}];backend.codexBackend.sessionsUnder=async()=>{throw Error('daemon unavailable');};
 const rows=await backend.sessionsUnder(['/workspace']);assert.equal(rows.length,1);
 assert.match(backend.warnings[0],/Codex: daemon unavailable/);backend.dispose();
});
