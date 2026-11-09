const{WorkspaceService}=require('./workspace-service');
function normalize(value){return(value||'').replaceAll('\\','/').replace(/^\/([A-Za-z]:\/)/,'$1').replace(/\/$/,'');}
function within(cwd,root){cwd=normalize(cwd);root=normalize(root);return cwd===root||cwd.startsWith(root+'/');}
class ManagedAgents{
 constructor({backend,options=()=>({})}){this.backend=backend;this.options=options;}
 async workspace(scope){return new WorkspaceService(this.backend(scope),this.options(scope)).run('list');}
 async sessionFor(scope){const data=await this.workspace(scope);return data.sessions.find(item=>within(scope.cwd,item.sessionRoot));}
 async setTeam(row,member){return new WorkspaceService(this.backend({...row.scope,cwd:row.workspaceRoot}),this.options(row.scope)).run('team',{agent:row.workspaceAgent,folder:row.workspaceFolder,sessionId:row.sessionId,member});}
 async list(scope){const data=await this.workspace(scope);if(!data.sessions.length)return{...data,agents:[],warnings:[]};const backend=this.backend({...scope,cwd:data.root});const rows=await backend.sessionsUnder(data.sessions.map(item=>item.sessionRoot),data.sessions.flatMap(item=>item.conversations||[]));const agents=[];for(const row of rows){const workspace=data.sessions.find(item=>within(row.cwd,item.sessionRoot));if(workspace)agents.push({...row,team:(workspace.team||[]).includes(row.sessionId),workspaceAgent:workspace.agent,workspaceFolder:workspace.folder,workspaceName:workspace.name,workspaceRoot:data.root,workspaceSession:workspace.sessionRoot,scope:{...scope,cwd:row.cwd}});}return{...data,agents,warnings:backend.warnings||[]};}
}
module.exports={ManagedAgents,within};
