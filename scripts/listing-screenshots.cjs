// Capture the actual portal and voice renderers with public-safe demo data.
// npm install --no-save --package-lock=false playwright
// PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/listing-screenshots.cjs
const fs=require('node:fs/promises');const path=require('node:path');const vm=require('node:vm');const{createRequire}=require('node:module');
const{chromium}=require('playwright');const{createPortal}=require('../portal.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),fixture=path.join(root,'.listing-demo');
 const output=path.join(root,'media','screenshots');await fs.mkdir(output,{recursive:true});
 const now=new Date(),stamp=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')+' '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
 const states=[['demo-lead','working','Coordinating the release'],['demo-developer','working','Implementing the API changes'],['demo-reviewer','needs-you','Review the proposed rollout'],['demo-tester','done','Regression checks passed']];
 const sessions=[];
 for(const[name,state,headline]of states){
  const sessionRoot=path.join(fixture,'.sessions','claude',name),agl=path.join(sessionRoot,'.agl');await fs.mkdir(path.join(agl,'pages'),{recursive:true});
  const question=state==='needs-you'?'<section class="agl-decision"><h2>Review the rollout</h2><p class="agl-q">Which rollout should the demo team use?</p><p>A staged rollout limits the first deployment to the test environment.</p><button class="agl-btn primary" data-agl-ask="approve" data-agl-question="Q1" data-agl-choice="A" data-agl-label="Approve the staged rollout">A · Staged rollout</button> <button class="agl-btn" data-agl-ask="comment" data-agl-question="Q1">Suggest a change</button></section>':'';
  const html=`<!doctype html><html><head><title>${name} · Demo workspace</title><meta name="agl:state" content="${state}"><meta name="agl:headline" content="${headline}"><meta name="agl:updated" content="${stamp}"><meta name="agl:reports-to" content="${name==='demo-lead'?'':'demo-lead'}"></head><body class="agl-page"><p class="agl-muted">DEMO WORKSPACE · Sample data</p><h1>${headline}</h1>${question}<section class="agl-card"><h2>API release</h2><p>Deliver the API changes with tests, review and a staged rollout.</p><table class="agl-table"><thead><tr><th>Milestone</th><th>Status</th><th>Evidence</th></tr></thead><tbody><tr><td>Implement API changes</td><td>Done</td><td>Reviewed change set</td></tr><tr><td>Run regression checks</td><td>Done</td><td>Test suite passed</td></tr><tr><td>Approve rollout</td><td>Needs review</td><td>Decision above</td></tr></tbody></table></section><section class="agl-card"><h2>Recent delivery</h2><p>API error handling and request validation are ready for review.</p><p class="agl-muted">This screenshot uses sample agents and sample work.</p></section></body></html>`;
  await fs.writeFile(path.join(agl,'STATUS.html'),html);
  await fs.writeFile(path.join(agl,'pages','responsibility.md'),'# Responsibility\nsummary: Demo release team member\nupdated: 2026-11-09\nwork: API release\n\nDemonstration workspace with sample data.');
  await fs.writeFile(path.join(agl,'FACTS.md'),'## Decisions\n- Use a staged rollout for this demonstration.');
  sessions.push({agent:'claude',folder:name,name,sessionRoot});
 }
 const portal=createPortal({listSessions:async()=>sessions,version:'0.14.16',commsDir:path.join(fixture,'comms'),wake:false});
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||chromium.executablePath(),headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:500},deviceScaleFactor:1});
  await page.goto(await portal.url());await page.getByText('demo-reviewer',{exact:false}).first().waitFor();await page.screenshot({path:path.join(output,'agent-portal.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1080});await page.goto(await portal.url('s','claude','demo-reviewer'));await page.locator('#agl-frame').waitFor();
  await page.frameLocator('#agl-frame').getByText('Which rollout should the demo team use?').waitFor();
  await page.waitForFunction(()=>document.querySelector('#agl-frame').getBoundingClientRect().width>800);
  await page.frameLocator('#agl-frame').locator('table').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'review-and-status.png'),fullPage:true});
  // Voice screenshot uses the exact extension HTML/CSS/JS with a sample message bridge.
  const voiceFile=path.join(root,'voice-panel.js'),module={exports:{}};const localRequire=createRequire(voiceFile);
  vm.runInNewContext(await fs.readFile(voiceFile,'utf8'),{module,require:n=>n==='vscode'?{}:localRequire(n),setInterval,clearInterval,Buffer});
  const voicePage=await browser.newPage({viewport:{width:1040,height:880},deviceScaleFactor:1});
  await voicePage.addInitScript(()=>{window.acquireVsCodeApi=()=>({postMessage:m=>{if(m.type==='ready')queueMicrotask(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'voices',name:'Demo developer · Sample conversation',agent:'Claude',session:'demo',speech:'idle',early:true,auto:false,items:[{id:'p1',you:true,ts:'2026-11-09T10:10:00Z',text:'Prepare the API change and explain how you checked it.'},{id:'r1',ts:'2026-11-09T10:12:00Z',text:'The API change is ready for review.\n\nRequest validation and error handling are covered by regression tests. The existing behavior is preserved for valid requests.\n\nNext step: review the staged rollout in the agent portal.'},{id:'p2',you:true,ts:'2026-11-09T10:14:00Z',text:'Keep the rollout staged. Show the test results before proceeding.'},{id:'r2',ts:'2026-11-09T10:15:00Z',text:'The test suite passed. The rollout remains staged and awaits your review.\n\nThis is a sample conversation for the product screenshot.'}],views:[]}})));}});});
  await voicePage.route('https://listing.invalid/**',async route=>{const file=new URL(route.request().url()).pathname;
   if(file==='/voice.css')return route.fulfill({contentType:'text/css',body:await fs.readFile(path.join(root,'media','voice.css'),'utf8')});
   if(file==='/voice.js')return route.fulfill({contentType:'application/javascript',body:await fs.readFile(path.join(root,'media','voice.js'),'utf8')});
   return route.fulfill({contentType:'text/html',body:module.exports.html('https://listing.invalid','demo-nonce','https://listing.invalid/voice.css','https://listing.invalid/voice.js')});});
  await voicePage.goto('https://listing.invalid/voice');await voicePage.getByText('Demo developer · Sample conversation').waitFor();await voicePage.screenshot({path:path.join(output,'voice-and-replies.png'),fullPage:true});
  console.log('Captured three actual product views with clearly labelled sample data.');
 }finally{await browser?.close();await portal.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
