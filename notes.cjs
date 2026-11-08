// Session notes: .agl/STATUS.md, .agl/FACTS.md, .agl/pages/*.md and the review log .agl/reviews.json.
const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');
const STATES=['needs-you','blocked','working','done','idle'];
const SLUG=/^[a-z0-9][a-z0-9-]{0,80}$/;
const STALE_MS=30*60*1000;

async function read(file){try{return await fs.readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')return undefined;throw e;}}
function frontMatter(text=''){const match=text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);const fields={};for(const line of (match?.[1]||'').split(/\r?\n/)){const m=line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);if(m)fields[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}return{fields,body:match?text.slice(match[0].length):text};}
// Page header: "# Title", "summary: …", "updated: …" in the first lines.
function pageHeader(text,slug){const lines=text.split(/\r?\n/).slice(0,6);return{title:lines.find(l=>l.startsWith('# '))?.slice(2).trim()||slug,summary:lines.find(l=>l.startsWith('summary:'))?.slice(8).trim()||'',updated:lines.find(l=>l.startsWith('updated:'))?.slice(8).trim()||'',work:lines.find(l=>l.startsWith('work:'))?.slice(5).trim()||''};}
// HTML page index card: <title>, <meta name="description">, <meta name="agl:updated">, <meta name="agl:kind">.
const unent=v=>String(v||'').replace(/&(amp|lt|gt|quot|#39);/g,(m,e)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[e]));
function htmlHeader(text,slug){const meta=name=>unent(text.match(new RegExp('<meta\\s+name=["\']'+name+'["\']\\s+content=["\']([^"\']*)["\']','i'))?.[1]).trim();return{title:unent(text.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]).trim()||slug,summary:meta('description'),updated:meta('agl:updated'),kind:meta('agl:kind'),state:meta('agl:state'),headline:meta('agl:headline'),work:meta('agl:work')};}

async function readNotes(sessionRoot,now=Date.now()){const dir=path.join(sessionRoot,'.agl');const factsText=await read(path.join(dir,'FACTS.md'));
 // STATUS.html (agent-written, index card in <meta name="agl:state|agl:headline|agl:updated">) wins over STATUS.md.
 // STATUS.openui wins, then STATUS.html, then STATUS.md. An OpenUI status's index card is its root = Status("state", "headline", "updated", ...) line.
 let statusFile='STATUS.openui',statusText=await read(path.join(dir,statusFile)),statusFormat='openui';if(statusText===undefined){statusFile='STATUS.html';statusFormat='html';statusText=await read(path.join(dir,statusFile));}if(statusText===undefined){statusFile='STATUS.md';statusFormat='md';statusText=await read(path.join(dir,statusFile));}
 const{fields,body}=statusFormat==='md'?frontMatter(statusText):{fields:statusFormat==='html'?htmlHeader(statusText,'STATUS'):openuiHeader(statusText),body:undefined};const stat=statusText===undefined?undefined:await fs.stat(path.join(dir,statusFile));const statusHtml=statusFormat==='md'?undefined:statusText;
 const state=STATES.includes(fields.state)?fields.state:statusText===undefined?'none':'unknown';
 const pages=[];for(const entry of await fs.readdir(path.join(dir,'pages'),{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return[];throw e;})){const m=entry.name.match(/^(.*)\.(md|html|openui)$/);if(!entry.isFile()||!m||!SLUG.test(m[1]))continue;const text=await read(path.join(dir,'pages',entry.name))||'';const page={slug:m[1],format:m[2],modified:(await fs.stat(path.join(dir,'pages',entry.name))).mtimeMs,...(m[2]==='html'?htmlHeader(text,m[1]):m[2]==='openui'?openuiPageHeader(text,m[1]):pageHeader(text,m[1]))};const twin=pages.findIndex(p=>p.slug===page.slug);if(twin<0)pages.push(page);else if(page.format!=='md')pages[twin]=page;}
 const reviews=await readReviews(sessionRoot);
 return{state,headline:fields.headline||'',updated:fields.updated||'',modified:stat?.mtimeMs,stale:!!stat&&state!=='done'&&state!=='idle'&&now-stat.mtimeMs>STALE_MS,needsYou:state==='needs-you',status:body,statusFormat,work:statusFormat==='openui'?openuiWork(statusText):[],facts:factsText,pages:pages.sort((a,b)=>a.slug.localeCompare(b.slug)),reviews,open:reviews.filter(r=>r.status!=='confirmed').length};}

// An agent-written HTML page (served sandboxed by the portal); undefined when missing.
// Trial: a page written in OpenUI Lang is wrapped into HTML with the renderer bundle (openui/dist).
// Work items for the sidebar: one per WorkItem("name", "state", ...) statement; a trailing true marks it archived.
function openuiWork(text){const out=[];for(const line of String(text||'').split(/\r?\n/)){const m=line.match(/^\s*[A-Za-z_]\w*\s*=\s*WorkItem\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*"([a-z-]+)"/);if(m)out.push({name:m[1].replace(/\\(.)/g,'$1'),state:m[2],archived:/,\s*true\s*\)\s*$/.test(line)});}return out;}
// An OpenUI page's index card is its root = Page("title", "summary", "kind", "work", "updated", ...) line.
function openuiPageHeader(text,slug){const q='"((?:[^"\\\\]|\\\\.)*)"';const m=String(text||'').match(new RegExp('^\\s*root\\s*=\\s*Page\\(\\s*'+[q,q,q,q,q].join('\\s*,\\s*'),'m'));const un=v=>String(v||'').replace(/\\(.)/g,'$1');return m?{title:un(m[1])||slug,summary:un(m[2]),kind:un(m[3]),work:un(m[4]),updated:un(m[5])}:{title:slug,summary:'',kind:'openui',work:'',updated:''};}
function openuiHeader(text){const m=String(text||'').match(/^\s*root\s*=\s*Status\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"/m);const un=v=>String(v||'').replace(/\\(.)/g,'$1');return{title:'Status',state:m?un(m[1]):'',headline:m?un(m[2]):'',updated:m?un(m[3]):''};}
const escHtml=v=>String(v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
async function readHtml(sessionRoot,page){const base=page==='STATUS'?path.join(sessionRoot,'.agl','STATUS'):SLUG.test(page||'')?path.join(sessionRoot,'.agl','pages',page):undefined;if(!base)throw new Error('Invalid page.');
 const program=await read(base+'.openui');if(program===undefined)return read(base+'.html');const bundle=(await read(path.join(__dirname,'openui','dist','openui-renderer.js'))||'document.body.textContent="OpenUI renderer not built."').replace(/<\/script/gi,'<\\/script');
 return '<!doctype html><html lang="en"><head><title>'+escHtml(page)+'</title></head><body><div id="openui-root"></div><textarea id="openui-program" hidden>'+escHtml(program)+'</textarea><script>'+bundle+'</script></body></html>';}
async function readPage(sessionRoot,page){if(page==='STATUS'||page==='FACTS')return read(path.join(sessionRoot,'.agl',page+'.md'));if(!SLUG.test(page))throw new Error('Invalid page.');return read(path.join(sessionRoot,'.agl','pages',page+'.md'));}

async function readReviews(sessionRoot){const text=await read(path.join(sessionRoot,'.agl','reviews.json'));if(text===undefined)return[];const value=JSON.parse(text);return Array.isArray(value?.items)?value.items:[];}
// shortcut: whole-file rewrite under a mkdir lock; the agent edits the same file by hand only after the user says so, so collisions are rare. Upgrade to an append log if they are not.
async function updateReviews(sessionRoot,change){const dir=path.join(sessionRoot,'.agl');await fs.mkdir(dir,{recursive:true});const lock=path.join(dir,'.reviews-lock');try{await fs.mkdir(lock);}catch(e){if(e.code==='EEXIST')throw new Error('Another review update is in progress. Try again.');throw e;}
 try{const items=await readReviews(sessionRoot);const result=change(items);const file=path.join(dir,'reviews.json');const staging=file+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';await fs.writeFile(staging,JSON.stringify({items},null,2)+'\n');await fs.rename(staging,file);return result;}finally{await fs.rmdir(lock);}}

async function addReview(sessionRoot,{page,kind,text},now=new Date()){if(!['comment','yes','no'].includes(kind))throw new Error('Invalid review kind.');if(page!=='STATUS'&&page!=='FACTS'&&!SLUG.test(page||''))throw new Error('Invalid page.');text=String(text||'').trim();if(kind==='comment'&&!text)throw new Error('Write a comment first.');if(text.length>8000)throw new Error('Keep a comment under 8,000 characters.');
 const item={id:crypto.randomBytes(4).toString('hex'),page,kind,text,status:'submitted',submittedAt:now.toISOString()};await updateReviews(sessionRoot,items=>items.push(item));return item;}
async function confirmReview(sessionRoot,id,now=new Date()){return updateReviews(sessionRoot,items=>{const item=items.find(r=>r.id===id);if(!item)throw new Error('Review not found.');if(item.status!=='answered')throw new Error('Only answered reviews can be confirmed.');item.status='confirmed';item.confirmedAt=now.toISOString();return item;});}

module.exports={readNotes,readPage,readHtml,htmlHeader,readReviews,addReview,confirmReview,frontMatter,STATES,SLUG,STALE_MS};

// Installs the bundled agl-notes skill for Claude (~/.claude/skills) and Codex (~/.agents/skills). Never overwrites a skill of the same name that this extension did not install.
const MARK='Installed by AGL Agent Manager';
async function installSkill(home,source){const text=await fs.readFile(source,'utf8');const done=[];for(const parent of [path.join(home,'.claude','skills'),path.join(home,'.agents','skills')]){const file=path.join(parent,'agl-notes','SKILL.md');const current=await read(file);if(current===text)continue;if(current!==undefined&&!current.includes(MARK))continue;await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',text);await fs.rename(file+'.tmp',file);done.push(file);}return done;}
// Session folder = nearest ancestor holding .agl-session.json (agents may run inside a worktree).
async function findSessionRoot(cwd){let dir=path.resolve(cwd);for(let i=0;i<6;i++){if(await read(path.join(dir,'.agl-session.json'))!==undefined)return dir;const parent=path.dirname(dir);if(parent===dir)break;dir=parent;}return undefined;}
module.exports.installSkill=installSkill;module.exports.findSessionRoot=findSessionRoot;
