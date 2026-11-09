// Native Copilot lifecycle and isolated skills probe. --chat sends one harmless model prompt.
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');const{CopilotBackend}=require('../copilot-backend');const{execute,userEnvironment}=require('../backend');
(async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'agl-copilot-native-'));const backend=new CopilotBackend({scope:{cwd:root}});let sid,attached=false;
 try{
  const prepared=await backend.start('AGL disposable integration check');sid=prepared.session.sessionId;
  if(!(await backend.sessions()).some(s=>s.sessionId===sid))throw Error('Native discovery failed');
  if((await backend.prepare({sessionId:sid})).argv[2]!==sid)throw Error('Resume changed ID');
  console.log(JSON.stringify({check:'create/list/resume',passed:true}));
  if(process.argv.includes('--chat')){
  await backend.rpc.request('session.resume',{sessionId:sid,workingDirectory:root,availableTools:[],requestPermission:true,clientName:'agl-integration-check'});attached=true;
  backend.rpc.connection.onRequest('permission.request',()=>({kind:'denied-interactively-by-user'}));
  await backend.rpc.request('session.send',{sessionId:sid,prompt:'Reply with exactly AGL_COPILOT_OK. Do not use tools, read files, or perform any action.'});
  let reply;for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,500));const response=await backend.rpc.request('session.getMessages',{sessionId:sid});reply=response.events?.find(e=>e.type==='assistant.message'&&!e.agentId&&e.data?.content?.includes('AGL_COPILOT_OK'));if(reply)break;}
  if(!reply)throw Error('No expected Copilot response within 30 seconds');
  const history=await backend.voiceData(sid);if(!history.items.some(e=>e.text.includes('AGL_COPILOT_OK')))throw Error('Readout history missed native reply');
  console.log(JSON.stringify({check:'licensed chat and readout history',passed:true}));
  await backend.rpc.request('session.abort',{sessionId:sid});await backend.rpc.request('session.detach',{sessionId:sid});attached=false;
  }
  const home=path.join(root,'isolated-home');await fs.mkdir(home);const skill=path.join(root,'.github','skills','agl-native-probe');await fs.mkdir(skill,{recursive:true});await fs.writeFile(path.join(skill,'SKILL.md'),'---\nname: agl-native-probe\ndescription: Isolated native test\n---\nReply OK.');
  const skills=new CopilotBackend({scope:{cwd:root},copilotHome:home,run:(file,args,options)=>execute(file,args,{...options,env:{...userEnvironment(),COPILOT_HOME:home}})});
  for(const on of[true,false,true]){const result=await skills.skills('skills-agent-set',{kind:'skill',name:'agl-native-probe',file:path.join(skill,'SKILL.md'),on});if(result.groups.flatMap(g=>g.skills).find(s=>s.name==='agl-native-probe')?.on!==on)throw Error('Native skill switch mismatch');}
  console.log(JSON.stringify({check:'isolated native skill enable/disable/enable',passed:true}));skills.dispose();
 }finally{try{
  if(sid){if(attached){await backend.rpc.request('session.abort',{sessionId:sid}).catch(()=>{});await backend.rpc.request('session.detach',{sessionId:sid}).catch(()=>{});}await backend.deleteSession({sessionId:sid});console.log(JSON.stringify({check:'native cleanup',passed:true}));}
 }finally{backend.dispose();await fs.rm(root,{recursive:true,force:true});}
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
