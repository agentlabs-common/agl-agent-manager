// Status-page kit: house style and helpers injected into every agent-written HTML page.
// Pages run sandboxed with no network; the only way out is postMessage to the portal, which asks the user itself.
const{TOKENS,STATE_CSS}=require('./theme.cjs');
const KIT_CSS=TOKENS+STATE_CSS+`*{box-sizing:border-box}html,body{margin:0;background:var(--agl-ground);color:var(--agl-ink);font:15px/22px var(--agl-font);font-variant-numeric:tabular-nums}
a{color:var(--agl-ink-2);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}a:hover{color:var(--agl-ink)}
:focus-visible{outline:2px solid var(--agl-focus);outline-offset:2px}
code,.agl-mono{font-family:var(--agl-mono);font-size:13px}
.agl-page{max-width:1100px;margin:0 auto;padding:0 0 32px;display:flex;flex-direction:column;gap:24px}
.agl-page h1{font-size:22px;line-height:28px;font-weight:600;margin:0}.agl-page h2{font-size:18px;line-height:24px;font-weight:600;margin:0 0 8px}.agl-page h3{font-size:15px;line-height:22px;font-weight:600;margin:12px 0 4px}
.agl-page p{margin:0 0 8px;max-width:72ch}
.agl-muted,.agl-meta{color:var(--agl-ink-3);font-size:13px;line-height:18px}
.agl-card{background:var(--agl-surface);border:1px solid var(--agl-line);border-radius:8px;padding:16px 20px}
.agl-card.agl-rail,.agl-card.attention{box-shadow:inset 4px 0 0 var(--rail,var(--agl-line-strong));padding-left:24px}
.agl-card.attention{--rail:var(--agl-needs-you-rail)}
.agl-row{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.agl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.agl-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:3px;font-size:12px;line-height:16px;font-weight:600;background:var(--bg,var(--agl-idle-bg));color:var(--fg,var(--agl-idle));white-space:nowrap}
.agl-chip.needs-you{--fg:var(--agl-needs-you);--bg:var(--agl-needs-you-bg)}.agl-chip.blocked{--fg:var(--agl-blocked);--bg:var(--agl-blocked-bg)}.agl-chip.working{--fg:var(--agl-working);--bg:var(--agl-working-bg)}.agl-chip.done{--fg:var(--agl-done);--bg:var(--agl-done-bg)}.agl-chip.idle{--fg:var(--agl-idle);--bg:var(--agl-idle-bg)}
.agl-dot{width:8px;height:8px;border-radius:50%;background:var(--rail,var(--agl-idle-rail));display:inline-block;flex:none}
.agl-btn{font:inherit;font-weight:600;min-height:40px;padding:8px 14px;border-radius:6px;border:1px solid var(--agl-line-strong);background:var(--agl-surface);color:var(--agl-ink);cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.agl-btn:hover{background:var(--agl-surface-2)}.agl-btn.primary{background:var(--agl-primary);border-color:var(--agl-primary);color:var(--agl-on-primary)}
.agl-btn.quiet{border-color:transparent;background:transparent;color:var(--agl-ink-2)}.agl-btn.quiet:hover{background:var(--agl-surface-2)}
.agl-decision{display:flex;flex-direction:column;gap:12px;padding:16px 0;border-top:1px solid var(--agl-line)}.agl-decision:first-of-type{border-top:0;padding-top:4px}
.agl-decision .agl-from{display:flex;flex-wrap:wrap;gap:4px 16px;color:var(--agl-ink-3);font-size:13px;line-height:18px}
.agl-decision .agl-q{font-size:17px;line-height:24px;font-weight:600}
.agl-options{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;border:0}
.agl-option{display:flex;gap:12px;align-items:flex-start;min-height:44px;padding:10px 12px;border:1px solid var(--agl-line);border-radius:6px;background:var(--agl-surface);cursor:pointer}
.agl-option:hover{background:var(--agl-surface-2)}.agl-option[aria-checked=true]{border-color:var(--agl-ink);box-shadow:inset 0 0 0 1px var(--agl-ink)}
.agl-letter{flex:none;width:24px;height:24px;border-radius:3px;border:1px solid var(--agl-line-strong);display:grid;place-items:center;font-size:12px;font-weight:600;color:var(--agl-ink-2)}
.agl-option[aria-checked=true] .agl-letter{background:var(--agl-ink);border-color:var(--agl-ink);color:var(--agl-surface)}
.agl-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.agl-actions .agl-listen{margin-left:auto}.agl-stop{color:var(--agl-ink-2)}
.agl-answered{display:flex;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--agl-line);color:var(--agl-ink-3)}
.agl-table{width:100%;border-collapse:collapse;font-size:14px}.agl-table th{text-align:left;color:var(--agl-ink-3);font-weight:600;font-size:13px;padding:8px 12px;background:var(--agl-surface-2);border-bottom:1px solid var(--agl-line)}.agl-table td{padding:10px 12px;border-bottom:1px solid var(--agl-line);vertical-align:top}
.agl-timeline{list-style:none;margin:0;padding:0;position:relative}
.agl-timeline li{position:relative;display:grid;grid-template-columns:56px 1fr;gap:12px;padding:6px 0 6px 20px}
.agl-timeline li::before{content:"";position:absolute;left:3px;top:0;bottom:0;width:2px;background:var(--agl-line-strong)}
.agl-timeline li::after{content:"";position:absolute;left:0;top:13px;width:8px;height:8px;border-radius:50%;background:var(--agl-done-rail);box-shadow:0 0 0 2px var(--agl-surface)}
.agl-timeline li.took::after{background:var(--agl-surface);box-shadow:inset 0 0 0 2px var(--agl-ink-2),0 0 0 2px var(--agl-surface)}.agl-timeline li.dropped::after{background:var(--agl-idle-rail)}
.agl-timeline time{color:var(--agl-ink-3);font-size:13px}.agl-timeline .agl-ev{display:block;color:var(--agl-ink-3);font-size:13px;line-height:18px}
.agl-day{font-size:13px;font-weight:600;color:var(--agl-ink-3);margin:12px 0 4px}.agl-timeline li.agl-day{display:block;padding:8px 0 4px}.agl-timeline li.agl-day::before,.agl-timeline li.agl-day::after{content:none}.agl-table td:first-child,.agl-table td:last-child{white-space:nowrap}
.agl-next{background:var(--agl-working-bg);color:var(--agl-ink);border-radius:6px;padding:10px 12px;font-weight:600;margin:12px 0}
.agl-figure{margin:12px 0;overflow-x:auto}.agl-figure svg{width:100%;max-width:760px;height:auto;display:block}.agl-figure figcaption{font-size:13px;line-height:18px;color:var(--agl-ink-3);margin-top:8px;max-width:72ch}
.agl-scroll{overflow-x:auto}.agl-list{margin:0 0 8px;padding-left:22px;max-width:76ch}.agl-list li{margin:4px 0}.agl-code{background:var(--agl-surface-2);border:1px solid var(--agl-line);border-radius:6px;padding:12px;overflow-x:auto;font:13px/20px var(--agl-mono)}.agl-callout{border-radius:6px;padding:12px 16px;margin:12px 0;background:var(--bg);box-shadow:inset 4px 0 0 var(--rail)}.agl-callout p:last-child{margin:0}.agl-sub{margin-top:16px}.agl-pull{padding:12px 0;border-top:1px solid var(--agl-line)}.agl-pull:first-of-type{border-top:0;padding-top:0}.agl-pull .agl-card{border:0;padding:8px 0;box-shadow:none}.agl-card>.agl-card{border:0;padding:0}
.d-box{fill:var(--agl-surface);stroke:var(--agl-line-strong);stroke-width:1.5}.d-hi{fill:var(--agl-working-bg);stroke:var(--agl-working-rail);stroke-width:1.5}.d-line{stroke:var(--agl-ink-2);stroke-width:1.5;fill:none;stroke-linecap:round;stroke-linejoin:round}
.d-label{fill:var(--agl-ink);font-size:13px}.d-title{fill:var(--agl-ink);font-size:15px;font-weight:600}.d-meta{fill:var(--agl-ink-3);font-size:12px}
@media (max-width:640px){.agl-card{border-left:0;border-right:0;border-radius:0;padding:16px}.agl-actions .agl-btn{flex:1 1 100%;justify-content:center}.agl-actions .agl-listen{margin-left:0}.agl-timeline li{grid-template-columns:1fr;gap:0}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`;
const KIT_JS=`(()=>{const post=m=>parent.postMessage(Object.assign({agl:1},m),'*');
const size=()=>post({type:'height',height:document.documentElement.scrollHeight});
addEventListener('load',size);new ResizeObserver(size).observe(document.documentElement);
const ask=o=>post({type:'ask',kind:String(o.kind||''),question:String(o.question||''),choice:String(o.choice||''),label:String(o.label||'')});
document.addEventListener('click',e=>{const b=e.target.closest('[data-agl-ask]');if(!b)return;e.preventDefault();ask({kind:b.dataset.aglAsk,question:b.dataset.aglQuestion,choice:b.dataset.aglChoice,label:b.dataset.aglLabel||b.textContent.trim()});});
const SPK='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.agl-decision').forEach(d=>{if(d.querySelector('[data-agl-ask="speak"]'))return;const c=d.cloneNode(true);c.querySelectorAll('button').forEach(b=>b.remove());const b=document.createElement('button');b.className='agl-btn agl-listen';b.dataset.aglAsk='speak';b.dataset.aglLabel=c.innerText.replace(/\\s+/g,' ').trim();b.innerHTML=SPK+'<span>Listen</span>';b.setAttribute('aria-label','Read this question aloud');const st=document.createElement('button');st.className='agl-btn agl-stop';st.dataset.aglAsk='stop';st.textContent='Stop audio';const row=d.querySelector('.agl-row')||d;row.prepend(st);row.prepend(b);}));
addEventListener('DOMContentLoaded',()=>post({type:'ready'}));
addEventListener('message',e=>{const m=e.data;if(e.source!==parent||!m||m.agl!==1||m.type!=='answers')return;const by={};(m.items||[]).forEach(a=>{if(a&&a.question)by[String(a.question).toUpperCase()]=a;});window.AGL.answers=by;if(m.me)window.AGL.me=m.me;dispatchEvent(new CustomEvent('agl-answers'));
document.querySelectorAll('.agl-decision:not([data-agl-managed])').forEach(d=>{const el=d.querySelector('[data-agl-question]');const a=el&&by[String(el.dataset.aglQuestion).toUpperCase()];if(!a||d.classList.contains('agl-answered'))return;d.classList.add('agl-answered');d.querySelectorAll('[data-agl-ask="approve"],[data-agl-ask="comment"]').forEach(b=>b.remove());
const n=document.createElement('span');const done=a.status!=='submitted';n.className='agl-chip '+(done?'done':'blocked');n.textContent=(a.kind==='comment'?'You commented':a.kind==='no'?'You said no':'You chose '+(a.choice||'yes'))+' at '+a.at+(done?' · the agent has acted':' · waiting for the agent');d.prepend(n);});});
addEventListener('message',e=>{const m=e.data;if(e.source!==parent||!m||m.agl!==1||m.type!=='focus')return;const go=()=>{const el=[...document.querySelectorAll('[data-agl-work]')].find(x=>x.dataset.aglWork===m.work);if(el){el.scrollIntoView({block:'start'});el.focus&&el.focus({preventScroll:true});}return!!el;};if(!go())setTimeout(go,300);});
const waits={};let seq=0;addEventListener('message',e=>{const m=e.data;if(e.source!==parent||!m||m.agl!==1||m.type!=='got')return;if(waits[m.id]){waits[m.id](m.data);delete waits[m.id];}});
window.AGL={ask,go:p=>post({type:'go',page:String(p)}),open:(agent,folder,page)=>post({type:'go',agent,folder,page:page||'STATUS'}),get:(what,arg)=>new Promise(r=>{const id=++seq;let n=0;const send=()=>post({type:'get',id,what,arg});const t=setInterval(()=>{if(++n>4){clearInterval(t);delete waits[id];r(null);}else send();},2000);waits[id]=d=>{clearInterval(t);r(d);};send();})};})();`;
// Insert the kit at the top of <head>, so the page's own styles win.
// Shared libraries a page asks for by name in <meta name="agl:libs" content="chart">; only these names load.
const LIBS={chart:'lib-chart.js'};
function libText(name){if(!Object.hasOwn(LIBS,name))return'';try{return require('node:fs').readFileSync(require('node:path').join(__dirname,'openui','dist',LIBS[name]),'utf8');}catch{return'';}}
function withKit(html){const wanted=(String(html||'').match(/<meta\s+name=["']agl:libs["']\s+content=["']([^"']*)/i)||[])[1]||'';const libs=wanted.split(',').map(x=>libText(x.trim())).filter(Boolean).map(t=>'<script>'+t.replace(/<\/script/gi,'<\\/script')+'</script>').join('');const kit='<meta charset="utf-8"><style>'+KIT_CSS+'</style><script>'+KIT_JS+'</script>'+libs;const text=String(html||'');const m=text.match(/<head[^>]*>/i);return m?text.slice(0,m.index+m[0].length)+kit+text.slice(m.index+m[0].length):kit+text;}
module.exports={KIT_CSS,KIT_JS,withKit,libText};
