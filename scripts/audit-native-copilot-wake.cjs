// Isolated wake smoke test; uses the configured Copilot subscription for one prompt.
if(!process.argv.includes('--chat')){console.error('Pass --chat to run this native model check.');process.exit(2);}
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');const{CopilotBackend}=require('../copilot-backend');const comms=require('../scripts/comms.cjs'),waker=require('../scripts/waker.cjs');
(async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'agl-copilot-wake-native-')),store=path.join(root,'isolated-comms'),backend=new CopilotBackend({scope:{cwd:root}});let sid;
 try{
  sid=(await backend.start('AGL disposable wake check')).session.sessionId;const lead='claude/isolated-wake-sender',seat='copilot/isolated-wake-seat';comms.request(store,lead,seat,'Isolated native test');comms.decide(store,lead,seat,'allowed');comms.send(store,lead,seat,'AGL_WAKE_DELIVERY_PROBE');
  const sessions=[{agent:'copilot',name:'isolated-wake-seat',sessionRoot:root,conversations:[{provider:'copilot',sessionId:sid}]}];
  const result=await waker.tick({sessions,dir:store,providers:{copilot:{running:s=>backend.wakeRunningFolders(s),start:values=>backend.wake({...values,prompt:'This is an isolated delivery test. Acknowledge the message data in one sentence. Do not use any tools or send any messages.'})}}});
  if(result.length!==1||!result[0].ok)throw Error('Native wake did not start: '+JSON.stringify(result));
  for(let i=0;i<60&&comms.unread(store,seat).length;i++)await new Promise(r=>setTimeout(r,500));
  if(comms.unread(store,seat).length)throw Error('Native wake did not acknowledge receipt');
  const history=await backend.voiceData(sid);if(!history.items.some(m=>m.you&&m.text.includes('AGL_WAKE_DELIVERY_PROBE')))throw Error('Wake used another conversation or missed the message');if(!history.items.some(m=>!m.you))throw Error('No Copilot acknowledgement');
  console.log(JSON.stringify({check:'allowed message wakes native Copilot in same conversation',passed:true,readMarked:true,realOtherAgentsMessaged:false}));
  if((await waker.tick({sessions,dir:store,providers:{copilot:{running:s=>backend.wakeRunningFolders(s),start:()=>{throw Error('Duplicate wake');}}}})).length)throw Error('Duplicate wake');
 }finally{try{if(sid)await backend.deleteSession({sessionId:sid});await fs.rm(root,{recursive:true,force:true});}finally{backend.dispose();}}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
