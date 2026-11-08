// Status-page kit: house style and helpers injected into every agent-written HTML page.
// Pages run sandboxed with no network; the only way out is postMessage to the portal, which asks the user itself.
const KIT_CSS=`:root{--agl-ink:#111827;--agl-ink-2:#374151;--agl-muted:#4B5563;--agl-line:#E5E7EB;--agl-ground:#F6F7F9;--agl-card:#FFFFFF;--agl-blue:#1D4ED8;--agl-blue-bg:#DBEAFE;--agl-green:#15803D;--agl-green-bg:#DCFCE7;--agl-orange:#C2410C;--agl-orange-bg:#FFEDD5;--agl-amber:#A16207;--agl-amber-bg:#FEF9C3;--agl-grey-bg:#F3F4F6}
*{box-sizing:border-box}body{margin:0;background:var(--agl-ground);color:var(--agl-ink);font:15px/1.55 Inter,system-ui,sans-serif}
.agl-page{max-width:1100px;margin:0 auto;padding:4px 0 24px;display:flex;flex-direction:column;gap:16px}
.agl-page h1{font-size:26px;line-height:1.25;margin:0}.agl-page h2{font-size:18px;margin:0 0 8px}.agl-page h3{font-size:15px;margin:0 0 4px}
a{color:var(--agl-blue)}a:hover{color:#1E3A8A}
.agl-muted{color:var(--agl-muted);font-size:13px}
.agl-card{background:var(--agl-card);border:1px solid var(--agl-line);border-radius:12px;padding:18px 22px}
.agl-card.attention{border:2px solid #FDBA74}
.agl-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.agl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.agl-chip{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:var(--agl-grey-bg);color:var(--agl-ink-2);white-space:nowrap}
.agl-chip.needs-you{background:var(--agl-orange-bg);color:#9A3412}.agl-chip.working{background:var(--agl-blue-bg);color:#1E40AF}.agl-chip.done{background:var(--agl-green-bg);color:#14532D}.agl-chip.blocked{background:var(--agl-amber-bg);color:#713F12}.agl-chip.idle{background:var(--agl-grey-bg);color:var(--agl-ink-2)}
.agl-decision{display:flex;flex-direction:column;gap:8px;padding:14px 0;border-top:1px solid var(--agl-line)}.agl-decision:first-of-type{border-top:0}
.agl-decision .agl-q{font-weight:600}.agl-decision .agl-from{font-size:13px;color:var(--agl-muted)}
.agl-btn{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #D1D5DB;background:#fff;color:var(--agl-ink);cursor:pointer;min-height:40px}
.agl-btn.primary{background:var(--agl-blue);border-color:var(--agl-blue);color:#fff}.agl-btn:focus-visible{outline:3px solid #93C5FD;outline-offset:2px}
.agl-table{width:100%;border-collapse:collapse;font-size:14px}.agl-table th{text-align:left;color:var(--agl-muted);font-weight:600;padding:8px}.agl-table td{padding:8px;border-top:1px solid var(--agl-line);vertical-align:top}
.agl-timeline{list-style:none;margin:0;padding:0}.agl-timeline li{display:flex;gap:12px;padding:8px 0;border-top:1px solid var(--agl-line)}.agl-timeline li:first-child{border-top:0}.agl-timeline time{font-family:ui-monospace,monospace;font-size:13px;color:var(--agl-muted);min-width:96px}
.agl-figure{margin:0;background:#F9FAFB;border:1px solid var(--agl-line);border-radius:10px;padding:12px;overflow-x:auto}.agl-figure figcaption{font-size:13px;color:var(--agl-muted);margin-top:8px}.agl-figure svg{max-width:100%;height:auto}
.agl-scroll{overflow-x:auto}`;
const KIT_JS=`(()=>{const post=m=>parent.postMessage(Object.assign({agl:1},m),'*');
const size=()=>post({type:'height',height:document.documentElement.scrollHeight});
addEventListener('load',size);new ResizeObserver(size).observe(document.documentElement);
const ask=o=>post({type:'ask',kind:String(o.kind||''),question:String(o.question||''),choice:String(o.choice||''),label:String(o.label||'')});
document.addEventListener('click',e=>{const b=e.target.closest('[data-agl-ask]');if(!b)return;e.preventDefault();ask({kind:b.dataset.aglAsk,question:b.dataset.aglQuestion,choice:b.dataset.aglChoice,label:b.dataset.aglLabel||b.textContent.trim()});});
window.AGL={ask};})();`;
// Insert the kit at the top of <head>, so the page's own styles win.
function withKit(html){const kit='<meta charset="utf-8"><style>'+KIT_CSS+'</style><script>'+KIT_JS+'</script>';const text=String(html||'');const m=text.match(/<head[^>]*>/i);return m?text.slice(0,m.index+m[0].length)+kit+text.slice(m.index+m[0].length):kit+text;}
module.exports={KIT_CSS,KIT_JS,withKit};
