const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const{execFile}=require('node:child_process');const{KimiBackend,replyText}=require('./kimi-backend');const{findCli,pythonCommand}=require('./backend');const{hostKey}=require('./remote');
const ID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;const VOICE=/(?<!`)<voice>((?:(?!<voice>)[\s\S])*?)<\/voice>/g;
// One transcript_full.jsonl step: the user's request (inside <USER_REQUEST>) and the model's reply text.
function parseStep(line,history){let e;try{e=JSON.parse(line);}catch{return;}if(!e||typeof e.content!=='string')return;const ts=e.created_at||'',id=String(e.step_index);
 if(e.source==='USER_EXPLICIT'&&e.type==='USER_INPUT'){const text=(e.content.match(/<USER_REQUEST>\n?([\s\S]*?)\n?<\/USER_REQUEST>/)||[])[1]||'';if(text.trim())history.items.set(id+':prompt',{id:id+':prompt',ts,text,you:true});return;}
 if(e.source!=='MODEL'||e.type!=='PLANNER_RESPONSE'||!e.content.trim())return;const summaries=[...e.content.matchAll(VOICE)].map(m=>m[1].split(/\s+/).filter(Boolean).join(' ')).filter(Boolean),body=replyText(e.content);
 if(body)history.items.set(id+':reply',{id:id+':reply',ts,text:body,speechText:summaries.length?summaries.join(' '):e.content.replace(VOICE,''),turn:id,source:'early',hasVoice:!!summaries.length});}
// Antigravity CLI (agy) speaks the same ACP as Kimi: list, new, load, close (no delete). A running agy holds a flock on presence/<id>.lock.
class AntigravityBackend extends KimiBackend{
 constructor(options={}){super(options);this.kimi=options.agy&&options.agy!=='agy'?options.agy:findCli('agy');this.label='Antigravity';this.exeName='agy';this.home=options.agyHome||path.join(os.homedir(),'.gemini','antigravity-cli');}
 validId(sid){if(!ID.test(sid||''))throw new Error('Invalid Antigravity session ID.');}
 parse(line,history){parseStep(line,history);}
 async list(){try{return((await this.acp('session/list',{cwd:this.scope.cwd})).sessions||[]).filter(s=>ID.test(s?.sessionId||''));}catch(error){if(/Required program not found/.test(error.message))return[];throw error;}}
 // shortcut: flock is POSIX; on Windows no agy session shows as running, upgrade when agy reports a live field over ACP.
 liveIds(ids){if(process.platform==='win32'||!ids.length)return Promise.resolve(new Set());const[py,...pre]=pythonCommand();const code="import fcntl,os,sys\nfor i in sys.argv[2:]:\n f=os.path.join(sys.argv[1],i+'.lock')\n try:fd=os.open(f,os.O_RDONLY)\n except OSError:continue\n try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);fcntl.flock(fd,fcntl.LOCK_UN)\n except OSError:print(i)\n os.close(fd)";return new Promise(resolve=>execFile(py,[...pre,'-c',code,path.join(this.home,'presence'),...ids],{timeout:10000},(error,stdout)=>resolve(new Set(error?[]:String(stdout).split(/\s+/).filter(Boolean)))));}
 async rows(list){const live=await this.liveIds(list.map(s=>s.sessionId));return list.map(s=>{const on=live.has(s.sessionId);return{provider:'antigravity',sessionId:s.sessionId,id:s.sessionId,name:s.title||'Antigravity',cwd:s.cwd,kind:'antigravity',state:on?'running':'closed',live:on,updatedAt:s.updatedAt,key:'antigravity:'+hostKey(this.scope)+':'+s.sessionId,host:this.scope.host,remote:false};});}
 async sessions(){if(this.scope.host)return[];const root=await fs.realpath(this.scope.cwd);return this.rows((await this.list()).filter(s=>s.cwd===root));}
 async sessionsUnder(roots){if(this.scope.host||!roots.length)return[];const accepts=cwd=>roots.some(root=>cwd===root||cwd?.startsWith(root.replace(/\/$/,'')+'/'));return this.rows((await this.list()).filter(s=>accepts(s.cwd)));}
 argv(sid,yolo=false){return[this.kimi,'--conversation',sid,...(yolo?['--dangerously-skip-permissions']:[])];}
 async skillArgs(){return[];}
 async deleteSession(){throw new Error('Antigravity cannot delete conversations yet. Use Hide Session to take it off this list.');}
 async start(name,yolo=this.yolo){this.local();const cwd=await fs.realpath(this.scope.cwd);const{sessionId}=await this.acp('session/new',{cwd,mcpServers:[]});this.validId(sessionId);return{session:{provider:'antigravity',sessionId,id:sessionId,name:name||'Antigravity',cwd,kind:'antigravity',state:'running',live:true,key:'antigravity:'+hostKey(this.scope)+':'+sessionId,remote:false},argv:this.argv(sessionId,yolo)};}
 async transcript(sid){return path.join(this.home,'brain',sid,'.system_generated','logs','transcript_full.jsonl');}
}
module.exports={AntigravityBackend,parseStep};
