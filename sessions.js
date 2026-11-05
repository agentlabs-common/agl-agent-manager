const{Backend}=require('./backend');const{CodexBackend}=require('./codex-backend');
class SessionBackend extends Backend{
 constructor(options={}){super(options);this.providers=options.providers||['claude','codex'];this.claudeBackend=new Backend(options);this.codexBackend=new CodexBackend(options);this.warnings=[];}
 forSession(session){if(!session.provider||session.provider==='claude')return this.claudeBackend;if(session.provider==='codex')return this.codexBackend;throw new Error('Unsupported agent provider.');}
 async sessionsUnder(roots,links=[]){return this.collect('sessionsUnder',roots,links);}
 async sessions(){return this.collect('sessions');}
 async collect(method,...args){const providers=this.providers.filter(p=>['claude','codex'].includes(p));const results=await Promise.allSettled(providers.map(provider=>this.forSession({provider})[method](...args)));const rows=[];this.warnings=[];let success=0;for(const[index,result]of results.entries()){if(result.status==='fulfilled'){success++;rows.push(...result.value.map(row=>({...row,provider:providers[index]})));}else this.warnings.push((providers[index]==='codex'?'Codex':'Claude')+': '+result.reason.message+(providers[index]==='codex'&&/socket|daemon|not found|ENOENT/i.test(result.reason.message)?' Check that Codex is installed on this host and its daemon is running.':''));}if(!success&&this.warnings.length)throw new Error(this.warnings.join(' · '));return rows;}
 prepare(session){return this.forSession(session).prepare(session);}
 deleteSession(session){return this.forSession(session).deleteSession(session);}
 restartYolo(session){return this.forSession(session).restartYolo(session);}
 async start(name,yolo=this.yolo,provider='claude'){const prepared=await this.forSession({provider}).start(name,yolo);return{...prepared,session:{...prepared.session,provider}};}
 dispose(){this.codexBackend.dispose();}
}
module.exports={SessionBackend};
