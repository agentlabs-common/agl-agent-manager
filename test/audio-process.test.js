const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn,execFile}=require('node:child_process');const {promisify}=require('node:util');const {once}=require('node:events');const run=promisify(execFile);
test('Linux pause, resume and stop control only the disposable playback process group',{skip:process.platform!=='linux',timeout:10000},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'agl-audio-audit-'));const child=spawn('sleep',['30'],{detached:true,stdio:'ignore'});
 try{
  await once(child,'spawn');await fs.writeFile(path.join(dir,'player.pid'),String(child.pid));await fs.writeFile(path.join(dir,'speech.state'),'playing');
  const control=async action=>(await run('bash',[path.join(__dirname,'../voice.sh'),action,dir])).stdout.trim();
  await control('pause');assert.equal(await control('state'),'paused');
  const stat=await fs.readFile('/proc/'+child.pid+'/stat','utf8');assert.equal(stat.slice(stat.lastIndexOf(')')+2).split(' ')[0],'T');
  await control('resume');assert.equal(await control('state'),'playing');
  const resumed=await fs.readFile('/proc/'+child.pid+'/stat','utf8');assert.notEqual(resumed.slice(resumed.lastIndexOf(')')+2).split(' ')[0],'T');
  await control('stop');if(child.exitCode===null&&child.signalCode===null)await once(child,'exit');assert.equal(await control('state'),'idle');
 }finally{
  if(child.pid&&child.exitCode===null&&child.signalCode===null)try{process.kill(-child.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')throw e;}
  await fs.rm(dir,{recursive:true,force:true});
 }
});
