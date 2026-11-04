const{Backend}=require('./backend');const{CodexBackend}=require('./codex-backend');
class SessionBackend extends Backend{
 constructor(options={}){super(options);this.providers=options.providers||['claude','codex'];this.claudeBackend=new Backend(options);this.codexBackend=new CodexBackend(options);this.warnings=[];}
 forSession(session){if(!session.provider||session.provider==='claude')return this.claudeBackend;if(session.provider==='codex')return this.codexBackend;throw new Error('Unsupported agent provider.');}
 async sessions(){const providers=this.providers.filter(p=>['claude','codex'].includes(p));const results=await Promise.allSettled(providers.map(provider=>this.forSession({provider}).sessions()));const rows=[];this.warnings=[];let success=0;for(const[index,result]of results.entries()){if(result.status==='fulfilled'){success++;rows.push(...result.value.map(row=>({...row,provider:providers[index]})));}else this.warnings.push((providers[index]==='codex'?'Codex':'Claude')+': '+result.reason.message);}if(!success&&this.warnings.length)throw new Error(this.warnings.join(' · '));return rows;}
 prepare(session){return this.forSession(session).prepare(session);}
 restartYolo(session){return this.forSession(session).restartYolo(session);}
 async start(name,yolo=this.yolo,provider='claude'){const prepared=await this.forSession({provider}).start(name,yolo);return{...prepared,session:{...prepared.session,provider}};}
 dispose(){this.codexBackend.dispose();}
}
module.exports={SessionBackend};
