const{test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const engine=require('../skills-engine.cjs');
async function skill(dir,name,description='Does '+name+'.'){await fs.mkdir(path.join(dir,name),{recursive:true});await fs.writeFile(path.join(dir,name,'SKILL.md'),'---\nname: '+name+'\ndescription: '+description+'\n---\nBody');}
test('per-agent skill switches list layered sources and write only the agent settings.local.json',async()=>{const base=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'agl-agent-skills-')));try{
 const home=path.join(base,'home'),workspace=path.join(base,'ws'),agent=path.join(workspace,'.sessions','claude','one'),other=path.join(workspace,'.sessions','claude','two');
 await skill(path.join(agent,'.claude','skills'),'local-one');await skill(path.join(workspace,'.claude','skills'),'shared-ws');await skill(path.join(home,'.claude','skills'),'personal-one');await fs.mkdir(other,{recursive:true});
 const install=path.join(home,'plugin-cache','demo');await skill(path.join(install,'skills'),'plug-skill');await fs.mkdir(path.join(home,'.claude','plugins'),{recursive:true});
 await fs.writeFile(path.join(home,'.claude','plugins','installed_plugins.json'),JSON.stringify({version:2,plugins:{'demo@market':[{scope:'user',installPath:install}],'elsewhere@market':[{scope:'project',projectPath:path.join(base,'unrelated'),installPath:install}]}}));
 await fs.writeFile(path.join(home,'.claude','settings.json'),JSON.stringify({enabledPlugins:{'demo@market':true},skillOverrides:{'personal-one':'off'}}));
 await fs.mkdir(path.join(agent,'.claude'),{recursive:true});await fs.writeFile(path.join(agent,'.claude','settings.local.json'),JSON.stringify({permissions:{allow:['Bash(ls)']}}));
 const call=(root,values)=>engine.dispatch({root,...values},home);
 let result=await call(agent,{action:'skills-agent-list'});
 assert.deepEqual(result.groups.map(g=>g.label),['This agent','Inherited · ws','Personal','Plugin · demo@market']);
 const find=(r,name)=>r.groups.flatMap(g=>g.skills).find(s=>s.name===name);
 assert.equal(find(result,'personal-one').on,false);assert.equal(find(result,'shared-ws').on,true);assert.equal(result.groups.at(-1).on,true);
 result=await call(agent,{action:'skills-agent-set',kind:'skill',name:'shared-ws',on:false});assert.equal(find(result,'shared-ws').on,false);
 result=await call(agent,{action:'skills-agent-set',kind:'skill',name:'personal-one',on:true});assert.equal(find(result,'personal-one').on,true);
 result=await call(agent,{action:'skills-agent-set',kind:'plugin',name:'demo@market',on:false});assert.equal(result.groups.at(-1).on,false);
 const saved=JSON.parse(await fs.readFile(path.join(agent,'.claude','settings.local.json'),'utf8'));
 assert.deepEqual(saved,{permissions:{allow:['Bash(ls)']},skillOverrides:{'shared-ws':'off','personal-one':'on'},enabledPlugins:{'demo@market':false}});
 const sibling=await call(other,{action:'skills-agent-list'});assert.equal(find(sibling,'shared-ws').on,true);assert.equal(sibling.groups.at(-1).on,true);
 await call(agent,{action:'skills-agent-set',kind:'skill',name:'shared-ws',on:true});await call(agent,{action:'skills-agent-set',kind:'skill',name:'personal-one',on:false});await call(agent,{action:'skills-agent-set',kind:'plugin',name:'demo@market',on:true});
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(agent,'.claude','settings.local.json'),'utf8')),{permissions:{allow:['Bash(ls)']}});
 await assert.rejects(call(agent,{action:'skills-agent-set',kind:'skill',name:'../x',on:false}),/Invalid skill name/);
 await fs.writeFile(path.join(agent,'.claude','settings.local.json'),'{broken');await assert.rejects(call(agent,{action:'skills-agent-set',kind:'skill',name:'shared-ws',on:false}),/Cannot read/);
 assert.equal(await fs.readFile(path.join(agent,'.claude','settings.local.json'),'utf8'),'{broken');
}finally{await fs.rm(base,{recursive:true,force:true});}});
test('voice panel Skills tab lists and switches skills for its own agent folder only',async()=>{const vm=require('node:vm');const runs=[];const module={exports:{}};class WorkspaceService{constructor(backend){this.backend=backend;}async run(action,values){runs.push({action,...values});return{groups:[{kind:'skills',label:'Personal',skills:[{name:'a',on:true}]}]};}}
 vm.runInNewContext(require('node:fs').readFileSync(path.join(__dirname,'../voice-panel.js'),'utf8'),{module,require:name=>name==='vscode'?{workspace:{isTrusted:true}}:name==='./live-client'?{LiveClient:class{}}:name==='./workspace-service'?{WorkspaceService}:require(name),setInterval,clearInterval,setTimeout,Set});
 const panel=Object.create(module.exports.VoicePanel.prototype);const posts=[];panel.post=async m=>posts.push(m);panel.backend={};panel.session={provider:'claude',cwd:'/ws/.sessions/claude/one',sessionId:'sid'};
 await panel.handle({type:'skills'});assert.equal(runs[0].action,'skills-agent-list');assert.equal(runs[0].root,'/ws/.sessions/claude/one');assert.equal(posts.at(-1).changed,false);
 await panel.handle({type:'skillSet',kind:'skill',name:'a',on:false,root:'/elsewhere'});assert.deepEqual(runs[1],{action:'skills-agent-set',root:'/ws/.sessions/claude/one',kind:'skill',name:'a',file:undefined,on:false,provider:'claude'});assert.equal(posts.at(-1).changed,true);
 await panel.handle({type:'skillSet',kind:'bogus',name:'a',on:false});assert.equal(runs.length,2);
 panel.backend.codexBackend={skills:async(action,values)=>({provider:'codex',groups:[],notice:'Restart Codex'})};panel.session={provider:'codex',cwd:'/x'};await panel.handle({type:'skills'});assert.equal(posts.at(-1).provider,'codex');assert.equal(runs.length,2);panel.session={provider:'kimi',cwd:'/kimi'};await panel.handle({type:'skills'});assert.equal(runs.at(-1).provider,'kimi');});
test('Skills tab renders groups and sends a switch change',()=>{const vm=require('node:vm');const elements=new Map(),messages=[];let receive;
 const make=tag=>({tag,children:[],hidden:false,dataset:{},addEventListener(type,fn){this[type]=fn;},append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},classList:{toggle(){}},setAttribute(name,value){this.attributes??={};this.attributes[name]=value;}});
 const el=id=>{if(!elements.has(id))elements.set(id,make('div'));return elements.get(id);};
 vm.runInNewContext(require('node:fs').readFileSync(path.join(__dirname,'../media/voice.js'),'utf8'),{acquireVsCodeApi:()=>({postMessage:m=>messages.push(m)}),document:{getElementById:el,createElement:make,querySelectorAll:()=>[]},window:{addEventListener:(type,fn)=>{receive=fn;}},Date});
 receive({data:{type:'skills',changed:false,groups:[{kind:'skills',label:'Personal',skills:[{name:'alpha',on:true,description:'A.'}]},{kind:'plugin',id:'demo@m',label:'Plugin · demo@m',on:false,skills:[{name:'p1'},{name:'p2'}]}]}});
 const [note,personal,plugin]=el('skills').children;assert.match(note.textContent,/this agent folder only/);
 const box=personal.children[1].children[0];assert.equal(box.checked,true);box.checked=false;box.change();assert.deepEqual({...messages.at(-1)},{type:'skillSet',kind:'skill',name:'alpha',file:undefined,on:false});
 assert.equal(plugin.children[1].textContent,'p1, p2');const pbox=plugin.children[0].children[0];pbox.checked=true;pbox.change();assert.deepEqual({...messages.at(-1)},{type:'skillSet',kind:'plugin',name:'demo@m',on:true});
 receive({data:{type:'skills',unsupported:true}});assert.match(el('skills').children[0].textContent,/Claude sessions only/);});

test('Codex folder overrides become native session arguments without changing global settings',async()=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'agl-codex-skills-'));try{
 const home=path.join(base,'home'),root=path.join(base,'seat'),other=path.join(base,'other');await fs.mkdir(root);await fs.mkdir(other);await fs.mkdir(home);
 const file=path.join(root,process.platform==='win32'?"a 'quoted' skill":'a "quoted" skill','SKILL.md');await fs.mkdir(path.dirname(file));await fs.writeFile(file,'test');
 const call=(action,extra={})=>engine.dispatch({action,root,...extra},home);
 await call('skills-codex-set',{kind:'skill',name:'probe',file,on:false});
 let prepared=await call('skills-codex-prepare');const toml=require('smol-toml');assert.deepEqual(JSON.parse(JSON.stringify(toml.parse(prepared.args[1]).skills.config)),[{path:file,enabled:false}]);
 assert.deepEqual((await engine.dispatch({action:'skills-codex-prepare',root:other},home)).args,[]);
 await call('skills-codex-set',{kind:'skill',name:'probe',file,on:true});assert.deepEqual(JSON.parse(JSON.stringify(toml.parse((await call('skills-codex-prepare')).args[1]).skills.config)),[{path:file,enabled:true}]);
 await assert.rejects(fs.stat(path.join(home,'.codex','config.toml')),/ENOENT/);
 await fs.writeFile(path.join(root,'.agl','codex-skills.json'),'{broken');await assert.rejects(call('skills-codex-prepare'),/Cannot read/);
 }finally{await fs.rm(base,{recursive:true,force:true});}
});

test('Kimi folder switches filter a launch catalog, keep resources and leave other agents and sources unchanged',async()=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'agl-kimi-skills-'));try{
 const home=path.join(base,'home'),root=path.join(base,'seat'),other=path.join(base,'other');await fs.mkdir(root);await fs.mkdir(other);await fs.mkdir(home);
 await skill(path.join(root,'.kimi-code','skills'),'probe');await skill(path.join(root,'.agents','skills'),'shared');await skill(path.join(home,'.agents','skills'),'personal');
 await fs.writeFile(path.join(root,'.kimi-code','skills','probe','resource.txt'),'Resource');
 const call=(action,extra={})=>engine.dispatch({action,provider:'kimi',root,...extra},home);
 let listed=await call('skills-agent-list');const target=listed.groups.flatMap(g=>g.skills).find(s=>s.name==='probe');
 await call('skills-agent-set',{kind:'skill',name:target.name,file:target.file,on:false});
 let prepared=await call('skills-kimi-prepare');let folders=await fs.readdir(prepared.args[1]);assert.equal(folders.length,2);
 for(const folder of folders)assert.doesNotMatch(await fs.readFile(path.join(prepared.args[1],folder,'SKILL.md'),'utf8'),/name: probe/);
 assert.deepEqual((await engine.dispatch({action:'skills-kimi-prepare',root:other},home)).args,[]);
 await call('skills-agent-set',{kind:'skill',name:target.name,file:target.file,on:true});prepared=await call('skills-kimi-prepare');folders=await fs.readdir(prepared.args[1]);assert.equal(folders.length,3);
 const restored=[];for(const folder of folders)if((await fs.readFile(path.join(prepared.args[1],folder,'SKILL.md'),'utf8')).includes('name: probe'))restored.push(folder);
 assert.equal(await fs.readFile(path.join(prepared.args[1],restored[0],'resource.txt'),'utf8'),'Resource');assert.equal(await fs.readFile(path.join(path.dirname(target.file),'resource.txt'),'utf8'),'Resource');
 await assert.rejects(call('skills-agent-set',{kind:'skill',name:'probe',file:'/somewhere/else',on:false}),/cannot be switched/);
 }finally{await fs.rm(base,{recursive:true,force:true});}
});

test('Skills uses the actual attached provider backend after terminal attachment unwraps SessionBackend',async()=>{
 const vm=require('node:vm'),module={exports:{}},calls=[];vm.runInNewContext(require('node:fs').readFileSync(path.join(__dirname,'../voice-panel.js'),'utf8'),{module,require:name=>name==='vscode'?{workspace:{isTrusted:true}}:name==='./live-client'?{LiveClient:class{}}:require(name),setInterval,clearInterval,setTimeout,Set});
 for(const provider of ['codex','copilot']){const panel=Object.create(module.exports.VoicePanel.prototype);panel.session={provider,cwd:'/agent'};panel.backend={skills:async(action,values)=>{calls.push({provider,action,values});return{provider,groups:[]};}};panel.post=async()=>{};await panel.handle({type:'skills'});await panel.handle({type:'skillSet',kind:'skill',name:'probe',file:'/skill/SKILL.md',on:false});}
 assert.equal(calls.length,4);assert.equal(calls[3].provider,'copilot');assert.equal(calls[1].values.on,false);
});
