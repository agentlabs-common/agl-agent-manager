const{WorkspaceService}=require('./workspace-service');
function normalize(value){return(value||'').replaceAll('\\','/').replace(/^\/([A-Za-z]:\/)/,'$1').replace(/\/$/,'');}
function within(cwd,root){cwd=normalize(cwd);root=normalize(root);return cwd===root||cwd.startsWith(root+'/');}
class ManagedAgents{
 constructor({backend,options=()=>({})}){this.backend=backend;this.options=options;}
 async workspace(scope){return new WorkspaceService(this.backend(scope),this.options(scope)).run('list');}
 async sessionFor(scope){const data=await this.workspace(scope);return data.sessions.find(item=>within(scope.cwd,item.sessionRoot));}
 async teams(scope,op,values){return new WorkspaceService(this.backend(scope),this.options(scope)).run('teams',{...values,op});}
 async list(scope,onUpdate){
  const data=await this.workspace(scope);
  if(!data.sessions.length)return{...data,agents:[],warnings:[]};
  const backend=this.backend({...scope,cwd:data.root});
  const project=(rows,warnings=[])=>{
   const agents=[];
   for(const row of rows){
    const workspace=data.sessions.find(item=>within(row.cwd,item.sessionRoot));
    if(!workspace)continue;
    const teamId=(data.teams||[]).find(t=>t.members.includes(row.sessionId))?.id;
    // Explicit team membership takes precedence over duplicate transcript suppression.
    agents.push({...row,teamId,olderCopy:teamId?false:row.olderCopy,workspaceName:workspace.name,workspaceRoot:data.root,workspaceSession:workspace.sessionRoot,scope:{...scope,cwd:row.cwd}});
   }
   return{...data,agents,warnings};
  };
  const rows=await backend.sessionsUnder(data.sessions.map(item=>item.sessionRoot),data.sessions.flatMap(item=>item.conversations||[]),
   onUpdate?update=>onUpdate(project(update.rows,update.warnings)):undefined);
  return project(rows,backend.warnings||[]);
 }
}
module.exports={ManagedAgents,within};
