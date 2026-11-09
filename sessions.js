const{Backend}=require('./backend');const{CodexBackend}=require('./codex-backend');const{KimiBackend}=require('./kimi-backend');const{CopilotBackend}=require('./copilot-backend');const LABELS={claude:'Claude',codex:'Codex',kimi:'Kimi',copilot:'Copilot'};
class SessionBackend extends Backend{
 constructor(options={}){super(options);this.providers=options.providers||['claude','codex','kimi','copilot'];this.claudeBackend=new Backend(options);this.codexBackend=new CodexBackend(options);this.kimiBackend=new KimiBackend(options);this.copilotBackend=new CopilotBackend(options);this.warnings=[];}
 forSession(session){if(!session.provider||session.provider==='claude')return this.claudeBackend;if(session.provider==='codex')return this.codexBackend;if(session.provider==='kimi')return this.kimiBackend;if(session.provider==='copilot')return this.copilotBackend;throw new Error('Unsupported agent provider.');}
 async sessionsUnder(roots,links=[],onUpdate){return this.collect('sessionsUnder',roots,links,onUpdate);}
 async sessions(){return this.collect('sessions');}
 async collect(method,...args){
  const onUpdate=typeof args.at(-1)==='function'?args.pop():undefined;
  if(args.at(-1)===undefined)args.pop();
  const providers=this.providers.filter(p=>Object.hasOwn(LABELS,p));
  const completed=new Map();this.warnings=[];
  const results=await Promise.allSettled(providers.map(async provider=>{
   try{
    const rows=(await this.forSession({provider})[method](...args)).map(row=>({...row,provider}));
    completed.set(provider,rows);
    onUpdate?.({rows:providers.flatMap(p=>completed.get(p)||[]),warnings:[...this.warnings]});
    return rows;
   }catch(error){this.warnings.push(LABELS[provider]+': '+error.message+(provider==='codex'&&/socket|daemon|not found|ENOENT/i.test(error.message)?' Check that Codex is installed on this host and its daemon is running.':''));throw error;}
  }));
  if(results.every(result=>result.status==='rejected')&&this.warnings.length)throw new Error(this.warnings.join(' · '));
  return providers.flatMap(provider=>completed.get(provider)||[]);
 }
 prepare(session){return this.forSession(session).prepare(session);}
 stopSession(session){return this.forSession(session).stopSession(session);}
 deleteSession(session){return this.forSession(session).deleteSession(session);}
 restartYolo(session){return this.forSession(session).restartYolo(session);}
 async start(name,yolo=this.yolo,provider='claude'){const prepared=await this.forSession({provider}).start(name,yolo);return{...prepared,session:{...prepared.session,provider}};}
 dispose(){this.codexBackend.dispose();this.copilotBackend.dispose();}
}
module.exports={SessionBackend};
