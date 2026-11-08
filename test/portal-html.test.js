const{test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const notes=require('../notes.cjs');const{createPortal}=require('../portal.cjs');const{withKit}=require('../kit.cjs');

test('agent HTML pages are indexed, served sandboxed with the kit, and can only ask',async()=>{
 const base=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'agl-html-')));
 try{
  const root=path.join(base,'.sessions','claude','one');await fs.mkdir(path.join(root,'.agl','pages'),{recursive:true});
  await fs.writeFile(path.join(root,'.agl','STATUS.md'),'---\nstate: needs-you\nheadline: Answer Q2\n---\n## Needs you\nQ2');
  const page='<!doctype html><html><head><title>Questions &amp; answers</title><meta name="description" content="every question"><meta name="agl:kind" content="questions"><meta name="agl:updated" content="2026-11-08"></head><body><button data-agl-ask="approve" data-agl-question="Q2" data-agl-choice="A">Approve A</button></body></html>';
  await fs.writeFile(path.join(root,'.agl','pages','questions.html'),page);
  await fs.writeFile(path.join(root,'.agl','pages','questions.md'),'# Old markdown twin\n');
  await fs.writeFile(path.join(root,'.agl','pages','notes.md'),'# Notes\nsummary: md still works\n');

  const n=await notes.readNotes(root);
  assert.deepEqual(n.pages.map(p=>[p.slug,p.format,p.title]),[['notes','md','Notes'],['questions','html','Questions & answers']],'html wins over its md twin');
  assert.equal(n.pages[1].kind,'questions');assert.equal(n.pages[1].summary,'every question');
  await assert.rejects(notes.readHtml(root,'../x'),/Invalid page/);

  const kitted=withKit(page);assert.ok(kitted.indexOf('window.AGL')>kitted.indexOf('<head>'),'kit goes inside head');assert.ok(kitted.indexOf('window.AGL')<kitted.indexOf('<title>'),'kit comes before page styles');

  const portal=createPortal({listSessions:async()=>[{agent:'claude',folder:'one',name:'one',sessionRoot:root}]});
  try{
   const view=await fetch(await portal.url('s','claude','one')+'?p=questions');const html=await view.text();
   assert.match(view.headers.get('content-security-policy'),/frame-src 'self'/);
   assert.match(html,/<iframe class="frame" id="agl-frame" sandbox="allow-scripts" /);assert.doesNotMatch(html,/allow-same-origin/);
   assert.match(html,/<dialog id="agl-ask">/);assert.match(html,/e\.source!==f\.contentWindow/,'only messages from the page frame count');

   const src=html.match(/src="([^"]+)"/)[1];const served=await fetch(new URL(src,await portal.url()));
   const csp=served.headers.get('content-security-policy');
   for(const rule of ['sandbox allow-scripts',"connect-src 'none'","form-action 'none'","frame-ancestors 'self'"])assert.ok(csp.includes(rule),rule);
   assert.doesNotMatch(csp,/allow-same-origin|allow-top-navigation|allow-popups|allow-forms/);
   const body=await served.text();assert.match(body,/window\.AGL/);assert.match(body,/data-agl-ask="approve"/);
   assert.equal((await fetch(await portal.url('h','claude','one','missing'))).status,404);

   assert.equal((await notes.readReviews(root)).length,0,'serving a page records nothing');
   const post=await fetch(await portal.url('s','claude','one','review'),{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({op:'add',page:'questions',kind:'yes',text:'Q2: A — Approve A'})});
   assert.equal(post.status,303);const saved=await notes.readReviews(root);assert.equal(saved[0].page,'questions');assert.equal(saved[0].kind,'yes');assert.equal(saved[0].text,'Q2: A — Approve A');
  }finally{await portal.close();}
 }finally{await fs.rm(base,{recursive:true,force:true});}
});

test('STATUS.html replaces STATUS.md: its index card feeds the list and it is served sandboxed',async()=>{
 const base=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'agl-status-')));
 try{
  const root=path.join(base,'s');await fs.mkdir(path.join(root,'.agl'),{recursive:true});
  await fs.writeFile(path.join(root,'.agl','STATUS.md'),'---\nstate: idle\nheadline: old\n---\n');
  await fs.writeFile(path.join(root,'.agl','STATUS.html'),'<html><head><title>Status</title><meta name="agl:state" content="working"><meta name="agl:headline" content="Agent portal: status page in HTML"><meta name="agl:updated" content="2026-11-08 12:20"></head><body>hi</body></html>');
  const n=await notes.readNotes(root);assert.equal(n.state,'working');assert.equal(n.headline,'Agent portal: status page in HTML');assert.equal(n.statusFormat,'html');assert.equal(n.status,undefined);
  const portal=createPortal({listSessions:async()=>[{agent:'claude',folder:'s',name:'s',sessionRoot:root}]});
  try{
   assert.match(await (await fetch(await portal.url())).text(),/Agent portal: status page in HTML/);
   const view=await (await fetch(await portal.url('s','claude','s'))).text();assert.match(view,/sandbox="allow-scripts" [^>]*src="[^"]*\/h\/claude\/s\/STATUS"/);
   const served=await fetch(await portal.url('h','claude','s','STATUS'));assert.match(served.headers.get('content-security-policy'),/sandbox allow-scripts/);assert.match(await served.text(),/window\.AGL/);
  }finally{await portal.close();}
 }finally{await fs.rm(base,{recursive:true,force:true});}
});

test('a page can ask to read a question aloud; the portal speaks it, and an empty ask stops it',async()=>{
 const said=[];const portal=createPortal({listSessions:async()=>[],speak:text=>{said.push(text);return text?'speaking':'stopped';}});
 try{
  const url=await portal.url('speak');const send=text=>fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({text})});
  assert.equal(await (await send('Q7: is the guide right?')).text(),'speaking');assert.equal(await (await send('')).text(),'stopped');
  assert.deepEqual(said,['Q7: is the guide right?','']);
  assert.equal((await fetch(new URL(url).origin+'/wrong/speak',{method:'POST'})).status,404,'needs the token');
  assert.match(withKit('<head></head>'),/Read this question aloud/,'kit adds a Listen button to each question');
 }finally{await portal.close();}
});

test('answers already given reach the page, so answered questions stop asking',async()=>{
 const base=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'agl-ans-')));
 try{
  const root=path.join(base,'s');await fs.mkdir(path.join(root,'.agl','pages'),{recursive:true});
  await fs.writeFile(path.join(root,'.agl','STATUS.html'),'<html><head><title>Status</title><meta name="agl:state" content="needs-you"></head><body></body></html>');
  await notes.addReview(root,{page:'questions',kind:'yes',text:'Q8: A — Try OpenUI'});await notes.addReview(root,{page:'STATUS',kind:'comment',text:'Q2: option B with guidelines'});await notes.addReview(root,{page:'STATUS',kind:'comment',text:'general remark </script>'});
  const portal=createPortal({listSessions:async()=>[{agent:'claude',folder:'s',name:'s',sessionRoot:root}]});
  try{
   const view=await (await fetch(await portal.url('s','claude','s'))).text();const a=JSON.parse(view.match(/const A=(\[.*?\]);/)[1]);
   assert.deepEqual(a.map(x=>[x.question,x.choice,x.kind,x.status]),[['Q8','A','yes','submitted'],['Q2','B','comment','submitted']],'answers from every page, not only this one');
   assert.doesNotMatch(view.match(/const A=.*?;/)[0],/<\/script>/);
  }finally{await portal.close();}
 }finally{await fs.rm(base,{recursive:true,force:true});}
});

test('every session page has one Stop audio button, outside the page, that stops all speech',async()=>{
 const base=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'agl-stop-')));
 try{
  const root=path.join(base,'s');await fs.mkdir(path.join(root,'.agl'),{recursive:true});await fs.writeFile(path.join(root,'.agl','STATUS.md'),'---\nstate: idle\nheadline: x\n---\n');
  const said=[];const portal=createPortal({listSessions:async()=>[{agent:'claude',folder:'s',name:'s',sessionRoot:root}],speak:t=>{said.push(t);return t?'speaking':'stopped';}});
  try{const view=await (await fetch(await portal.url('s','claude','s'))).text();assert.equal(view.match(/id="agl-stop"/g).length,1);assert.match(view,/body:"text="/,'stop sends empty text');}finally{await portal.close();}
 }finally{await fs.rm(base,{recursive:true,force:true});}
});

test('STATUS.openui is the status page; its root Status(...) line is the index card',async()=>{
 const base=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'agl-oui-')));
 try{
  const root=path.join(base,'s');await fs.mkdir(path.join(root,'.agl'),{recursive:true});
  await fs.writeFile(path.join(root,'.agl','STATUS.html'),'<html><head><meta name="agl:state" content="idle"></head></html>');
  await fs.writeFile(path.join(root,'.agl','STATUS.openui'),'root = Status("needs-you", "Agent portal: say \\"yes\\" to Q9", "2026-11-08 12:40", [], [], [], [])\n');
  const n=await notes.readNotes(root);assert.equal(n.statusFormat,'openui');assert.equal(n.state,'needs-you');assert.equal(n.headline,'Agent portal: say "yes" to Q9');assert.equal(n.updated,'2026-11-08 12:40');
  const html=await notes.readHtml(root,'STATUS');assert.match(html,/<textarea id="openui-program" hidden>root = Status\(&quot;|<textarea id="openui-program" hidden>root = Status\("/);assert.doesNotMatch(html.slice(0,html.indexOf('<script>')),/<\/textarea>.*<\/textarea>/s);
 }finally{await fs.rm(base,{recursive:true,force:true});}
});

test('sidebar groups pages under their work item; archived work moves to Archive',async()=>{
 const base=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'agl-side-')));
 try{
  const root=path.join(base,'s');await fs.mkdir(path.join(root,'.agl','pages'),{recursive:true});
  await fs.writeFile(path.join(root,'.agl','STATUS.openui'),'root = Status("working", "x", "2026-11-08 13:00", [], [a, b], [], [])\na = WorkItem("Agent portal", "working", "g", [], [], "n")\nb = WorkItem("Old thing", "done", "g", [], [], "n", true)\n');
  await fs.writeFile(path.join(root,'.agl','pages','design-x.md'),'# Design X\nsummary: s\nupdated: 2026-11-08\nwork: Agent portal\n');
  await fs.writeFile(path.join(root,'.agl','pages','notes-y.md'),'# Old notes\nsummary: s\nupdated: 2026-11-08\nwork: Old thing\n');
  await fs.writeFile(path.join(root,'.agl','pages','responsibility.md'),'# Responsibility\nsummary: s\n');
  const portal=createPortal({listSessions:async()=>[{agent:'claude',folder:'s',name:'s',sessionRoot:root}]});
  try{
   const view=await (await fetch(await portal.url('s','claude','s'))).text();const side=view.match(/<aside class="side"[\s\S]*?<\/aside>/)[0];
   assert.ok(side.indexOf('Responsibility')<side.indexOf('Facts'),'responsibility pinned near the top');
   assert.match(side,/<details class="work working"><summary>[\s\S]*?Agent portal[\s\S]*?<\/summary><a class="sub" href="[^"]*&w=Agent%20portal">Overview<\/a><a class="sub" href="[^"]*\?p=design-x">Design X<\/a><\/details>/,'work folds, with its pages inside');assert.doesNotMatch(side,/Old notes|Old thing/);assert.match(side,/Archive \(1\)/);
   const arch=await (await fetch(await portal.url('s','claude','s')+'?p=ARCHIVE')).text();assert.match(arch,/Old thing[\s\S]*Old notes/);
  }finally{await portal.close();}
 }finally{await fs.rm(base,{recursive:true,force:true});}
});

// Needs OpenUI's build packages (npm ci in openui/); skipped on a fresh checkout without them.
const haveOpenui=require('node:fs').existsSync(path.join(__dirname,'..','openui','node_modules','@openuidev','react-lang'));
test('migrate turns a Markdown page into an OpenUI page that parses cleanly',{skip:!haveOpenui&&'run npm ci in openui/ first'},async()=>{
 const{migrate}=require('../scripts/agl-migrate.cjs');
 const md='# Design: "X"\nsummary: the plan\nupdated: 2026-11-08\nwork: Agent portal\n\nIntro with **bold**.\n\n## Part one\n\n- a\n- b\n  more b\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n### Sub\n\n```\ncode here\n```\n\n> note\n\n<svg viewBox="0 0 10 10">\n<rect/>\n</svg>\n';
 const program=migrate(md,'design-x');
 assert.match(program,/^root = Page\("Design: \\"X\\"", "the plan", "design", "Agent portal", "2026-11-08", \[t\d+, s\d+\]\)/);
 const{defineComponent,createLibrary,createParser}=require('../openui/node_modules/@openuidev/react-lang');const{z}=require('../openui/node_modules/zod');
 const any=n=>defineComponent({name:n,description:n,props:z.object({}).passthrough(),component:()=>null});
 const names=['Page','Section','Text','Bullets','Table','Code','Callout','Figure'];const lib=createLibrary({root:'Page',components:names.map(any)});
 const r=createParser(lib.toJSONSchema(),lib.root).parse(program);assert.deepEqual(r.meta.unresolved||[],[]);assert.equal(r.root.typeName||r.root.type||'Page',r.root.typeName||r.root.type||'Page');
 for(const n of ['Bullets(["a", "b more b"])','Table(["A", "B"], [["1", "2"]])','Code("code here")','Callout("idle", "note")','Figure("<svg viewBox=\\"0 0 10 10\\">\\n<rect/>\\n</svg>", "")',', 3)'])assert.ok(program.includes(n),n);
});

test('session list groups by team, and the read API returns cards and a seat\'s program',async()=>{
 const base=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'agl-team-')));
 try{
  const mk=async(name,status)=>{const r=path.join(base,name);await fs.mkdir(path.join(r,'.agl'),{recursive:true});await fs.writeFile(path.join(r,'.agl','STATUS.openui'),status);return{agent:'claude',folder:name,name,sessionRoot:r};};
  const lead=await mk('hrms-lead','root = Status("working", "Lead", "2026-11-08 13:00", [], [], [], [])\n');
  const dev=await mk('hrms-dev','root = Status("needs-you", "Pick", "2026-11-08 13:00", [q], [], [], [], "hrms-lead")\nq = Question("Q1", "W", "t", "Deploy?", [], "A", "x")\n');
  const idle=await mk('hrms-tester','root = Status("idle", "Waiting", "2026-11-08 13:00", [], [], [], [])\n');
  const solo=await mk('solo','root = Status("working", "Other", "2026-11-08 13:00", [], [], [], [])\n');
  assert.equal((await notes.readNotes(dev.sessionRoot)).reportsTo,'hrms-lead');
  const portal=createPortal({listSessions:async()=>[lead,dev,idle,solo]});
  try{
   const home=await (await fetch(await portal.url())).text();const main=home.slice(home.indexOf('<main>'));
   assert.ok(main.indexOf('Needs you (1)')<main.indexOf('>hrms<'),'needs-you first');assert.match(main,/<details class="rest"><summary>1 idle<\/summary>/);assert.match(main,/Other sessions/);assert.equal((main.match(/class="dot /g)||[]).length,2,'lead shows a dot per seat');
   const api=await portal.url('api','session');const seat=await (await fetch(api+'?name=hrms-dev')).json();assert.equal(seat.state,'needs-you');assert.match(seat.program,/Question\("Q1"/);
   assert.equal(await (await fetch(api+'?name=nobody')).json(),null);
   const all=await (await fetch(await portal.url('api','sessions'))).json();assert.equal(all.length,4);assert.equal(all.find(s=>s.name==='hrms-dev').reportsTo,'hrms-lead');assert.equal(all[0].program,undefined,'list carries no page content');
  }finally{await portal.close();}
 }finally{await fs.rm(base,{recursive:true,force:true});}
});

test('open questions from every session are listed; a page changed after approval is flagged',async()=>{
 const base=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'agl-q-')));
 try{
  const root=path.join(base,'a');await fs.mkdir(path.join(root,'.agl','pages'),{recursive:true});
  await fs.writeFile(path.join(root,'.agl','STATUS.openui'),'root = Status("needs-you", "x", "2026-11-08 13:00", [q], [], [], [])\nq = Question("Q7", "Agent portal", "today", "Is it right?", [], "A", "x")\n');
  const page=path.join(root,'.agl','pages','design-a.openui');await fs.writeFile(page,'root = Page("A", "s", "design", "W", "x", [])\n');
  const s={agent:'claude',folder:'a',name:'a',sessionRoot:root};const portal=createPortal({listSessions:async()=>[s]});
  try{
   const q=await (await fetch(await portal.url('questions'))).text();assert.match(q,/Open questions \(1\)/);assert.match(q,/Is it right\?/);assert.match(q,/Agent portal/);
   await notes.addReview(root,{page:'STATUS',kind:'yes',text:'Q7: A — yes'});assert.match(await (await fetch(await portal.url('questions'))).text(),/Sent, waiting for agent/);
   const item=await notes.addReview(root,{page:'design-a',kind:'yes',text:'Approved'});assert.ok(item.hash,'approval keeps a fingerprint');
   const view=async()=>(await fetch(await portal.url('s','claude','a')+'?p=design-a')).text();assert.doesNotMatch(await view(),/changed after you approved/);
   await fs.writeFile(page,'root = Page("A changed", "s", "design", "W", "x", [])\n');assert.match(await view(),/changed after you approved/);
   assert.ok(require('../scripts/keeper.cjs').check(root).some(c=>c.code==='approved-changed'));
  }finally{await portal.close();}
 }finally{await fs.rm(base,{recursive:true,force:true});}
});

test('a container row carries its canonical address from the agl.host label', () => {
  const { parseContainer } = require('../portal.cjs');
  const row = parseContainer('c1\trunning\tUp 2 hours (healthy)\t127.0.0.1:10110->8080/tcp\tauth.dev-1.desk.localhost');
  assert.equal(row.address, 'auth.dev-1.desk.localhost:10110'); assert.equal(row.health, 'running');
  assert.equal(parseContainer('c2\trunning\tUp 1 hour\t\t').address, '', 'no label: no address');
  assert.equal(parseContainer('c3\trunning\tUp 1 hour (unhealthy)\t\tdb.dev.desk.localhost').address, 'db.dev.desk.localhost', 'a name without a published port'); assert.equal(parseContainer('c3\trunning\tUp 1 hour (unhealthy)\t\tx').health, 'degraded');
});

test('Ignore sets a question aside: it stops counting as asked, and the keeper leaves it alone', async () => {
  const base = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'agl-ign-')));
  try {
    const root = path.join(base, 'a'); await fs.mkdir(path.join(root, '.agl', 'pages'), { recursive: true }); const now = new Date(); const p2 = (n) => String(n).padStart(2, '0'); const ts = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`;
    await fs.writeFile(path.join(root, '.agl', 'STATUS.openui'), `root = Status("needs-you", "x", "${ts}", [q], [], [], [])\nq = Question("Q7", "W", "today", "Is it right?", [], "A", "x")\n`); await fs.writeFile(path.join(root, '.agl', 'pages', 'responsibility.openui'), 'root = Page("R", "s", "responsibility", "", "x", [])\n');
    assert.equal((await notes.readNotes(root)).needsYou, true);
    assert.equal((await notes.addReview(root, { page: 'STATUS', kind: 'ignore', text: 'Q7: set aside' })).kind, 'ignore');
    const n = await notes.readNotes(root); assert.equal(n.questions.length, 0, 'not asked any more'); assert.equal(n.needsYou, false, 'no orange dot'); assert.equal(n.state, 'needs-you', 'the agent still updates its own state');
    assert.deepEqual(require('../scripts/keeper.cjs').check(root).filter((c) => ['needs-without-question', 'question-hidden'].includes(c.code)), []);
    const s = { agent: 'claude', folder: 'a', name: 'a', sessionRoot: root }; const portal = createPortal({ listSessions: async () => [s] });
    try {
      assert.match(await (await fetch(await portal.url('questions'))).text(), /Open questions \(0\)/);
      const view = await (await fetch(await portal.url('s', 'claude', 'a'))).text(); const a = JSON.parse(view.match(/const A=(\[.*?\]);/)[1]); assert.deepEqual(a.map((x) => [x.question, x.kind]), [['Q7', 'ignore']]); assert.match(view, /m\.kind!=="ignore"/);
    } finally { await portal.close(); }
  } finally { await fs.rm(base, { recursive: true, force: true }); }
});
