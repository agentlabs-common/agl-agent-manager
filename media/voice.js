/* global acquireVsCodeApi */
const api=acquireVsCodeApi();
const el=id=>document.getElementById(id);
let data={items:[],views:[]};let live={state:'disconnected',muted:false};let recording=false;let sending=false;let signature='';
const send=(type,extra={})=>api.postMessage({type,...extra});
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function time(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function error(message){el('error').textContent=message;el('error').hidden=!message;}
function setRecording(state){recording=state==='listening';el('dictate').hidden=recording;for(const id of ['review','dictation-send','cancel'])el(id).hidden=!recording;el('dictation').hidden=!recording;el('dictate').disabled=false;}
function render(){
  el('name').textContent=data.name||'Claude';
  el('connection').textContent=(data.address?.includes('/')?'Remote · ':'')+(data.address||'')+' · '+(data.speech||'idle');
  el('early').checked=data.early!==false;el('auto').checked=!!data.auto;el('auto').disabled=!data.session;
  const next=JSON.stringify({items:data.items,views:data.views});if(signature===next)return;signature=next;
  const container=el('voices');container.replaceChildren();
  if(!data.items?.length)container.append(node('p','empty','Spoken replies appear here when the agent writes a voice summary.'));
  data.items?.forEach((item,index)=>{
    const row=node('article',item.you?'voice-row prompt-row':'voice-row');
    row.append(node('div','row-meta',(item.you?'YOU':item.source==='early'?'CLAUDE · EARLY REPLY':'CLAUDE')+' · '+time(item.ts)));
    const text=node(item.you?'p':'button',item.you?'prompt-text':'voice-text',item.text);
    if(!item.you){text.title='Read aloud with Gemini TTS';text.addEventListener('click',()=>send('speak',{index}));}
    row.append(text);container.append(row);
  });
  container.scrollTop=container.scrollHeight;
  el('views').replaceChildren();
  if(!data.views?.length)el('views').append(node('p','empty','Notes appear here when the agent writes a view block.'));
  for(const view of data.views||[]){const section=node('article','note');section.append(node('div','row-meta',time(view.ts)),node('pre','',view.text||''));el('views').append(section);}
}
function renderLive(){const labels={disconnected:'Disconnected',connecting:'Connecting…',listening:'Connected · Listening',speaking:'Connected · Speaking',muted:'Connected · Mic muted',paused:'Connected · Audio paused',error:'Connection error'};const badge=el('gemini-status');badge.textContent='Gemini · '+(labels[live.state]||live.state||'Disconnected');badge.dataset.state=live.state||'disconnected';badge.title=live.error||live.models||'';const connected=!['disconnected','error'].includes(live.state);el('gemini-disconnect').hidden=!connected;el('connect').hidden=connected;for(const id of ['disconnect','mute','live-send'])el(id).hidden=!connected;el('mute').textContent=live.muted?'Unmute mic':'Mute mic';el('live-status').textContent=(labels[live.state]||live.state||'Disconnected')+(live.error?' · '+live.error:'')+(live.latency!==undefined?' · first audio '+live.latency+' ms':'')+(live.sentMs!==undefined?' · prompt sent in '+live.sentMs+' ms':'');el('live-partial').textContent=live.partial||'';const container=el('captions');container.replaceChildren();for(const [index,item] of (live.lines||[]).entries()){const row=node('article','voice-row'+(item.role==='you'?' prompt-row':''));const text=node('button','voice-text',item.text);text.title='Read aloud with Gemini TTS';text.addEventListener('click',()=>send('speakLive',{index}));row.append(node('div','row-meta',item.role.toUpperCase()+' · '+time(item.ts)),text);container.append(row);}container.scrollTop=container.scrollHeight;}
el('connect').addEventListener('click',()=>{error('');live={state:'connecting',lines:[]};renderLive();send('liveStart');});
function disconnect(){live={...live,state:'disconnected',partial:''};renderLive();send('liveStop');}
el('disconnect').addEventListener('click',disconnect);el('gemini-disconnect').addEventListener('click',disconnect);
el('mute').addEventListener('click',()=>send('liveMute',{on:!live.muted}));
el('live-send').addEventListener('click',()=>send('liveSend'));
el('settings').addEventListener('click',()=>send('configureGemini'));
el('refresh').addEventListener('click',()=>{error('');send('refresh');});
for(const action of ['pause','resume','stop'])el(action).addEventListener('click',()=>send('speech',{action}));
el('early').addEventListener('change',event=>send('early',{on:event.target.checked}));
el('auto').addEventListener('change',event=>send('auto',{on:event.target.checked}));
function submit(){const text=el('prompt').value;if(!text.trim()||sending)return;sending=true;el('send').disabled=true;send('send',{text});}
el('send').addEventListener('click',submit);
el('prompt').addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();submit();}});
el('interrupt').addEventListener('click',()=>send('interrupt'));
el('dictate').addEventListener('click',()=>{error('');el('dictate').disabled=true;send('dictate');});
el('review').addEventListener('click',()=>send('finishDictation',{send:false}));
el('dictation-send').addEventListener('click',()=>send('finishDictation',{send:true}));
el('cancel').addEventListener('click',()=>send('cancelDictation'));
for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',()=>{
  for(const candidate of document.querySelectorAll('[data-tab]')){candidate.classList.toggle('active',candidate===tab);candidate.setAttribute('aria-pressed',String(candidate===tab));}
  for(const id of ['voices','views','live'])el(id).hidden=tab.dataset.tab!==id;
  const target=el(tab.dataset.tab==='live'?'captions':tab.dataset.tab);target.scrollTop=target.scrollHeight;
});
window.addEventListener('message',event=>{
  const message=event.data;
  if(message.type==='voices'){data=message;render();}
  else if(message.type==='live'){live=message;renderLive();}
  else if(message.type==='dictation'){setRecording(message.state);el('dictation').textContent=message.text||'Listening…';}
  else if(message.type==='draft'){el('prompt').value=message.text;el('prompt').focus();}
  else if(message.type==='sent'){el('prompt').value='';sending=false;el('send').disabled=false;error('');}
  else if(message.type==='error'){error(message.message);sending=false;el('send').disabled=false;el('dictate').disabled=false;}
});
renderLive();send('ready');
