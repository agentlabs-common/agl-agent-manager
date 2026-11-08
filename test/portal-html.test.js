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
