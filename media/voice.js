/* global acquireVsCodeApi */
const api=acquireVsCodeApi();
const el=id=>document.getElementById(id);
let data={items:[],views:[]};let live={state:'disconnected',muted:false};let sending=false;let signature='';
const send=(type,extra={})=>api.postMessage({type,...extra});
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function time(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function error(message){el('error').textContent=message;el('error').hidden=!message;}

function render(){
  el('name').textContent=data.name||data.agent||'Agent';
  el('connection').textContent='Readout: '+(data.speech||'idle');
  const paused=data.speech==='paused';el('pause').hidden=paused;el('resume').hidden=!paused;el('pause').disabled=!['playing','speaking'].includes(data.speech);
  el('early').checked=data.early!==false;el('auto').checked=!!data.auto;el('auto').disabled=!data.session;
  const next=JSON.stringify({items:data.items,views:data.views});if(signature===next)return;signature=next;
  const container=el('voices');container.replaceChildren();
  if(!data.items?.length)container.append(node('p','empty','Agent replies appear here as they are published.'));
  data.items?.forEach((item,index)=>{
    const row=node('article',item.you?'voice-row prompt-row':'voice-row');
    row.append(node('div','row-meta',(item.you?'YOU':item.source==='early'&&!item.hasVoice?(data.agent||'Claude').toUpperCase()+' · EARLY REPLY':(data.agent||'Claude').toUpperCase())+' · '+time(item.ts)));
    const text=node(item.you?'p':'button',item.you?'prompt-text':'voice-text',item.text);
    if(!item.you){text.title='Read aloud with Gemini TTS';text.addEventListener('click',()=>send('speak',{index}));}
    row.append(text);container.append(row);
  });
  container.scrollTop=container.scrollHeight;
  el('views').replaceChildren();
  if(!data.views?.length)el('views').append(node('p','empty','Notes appear here when the agent writes a view block.'));
  for(const view of data.views||[]){const section=node('article','note');section.append(node('div','row-meta',time(view.ts)),node('pre','',view.text||''));el('views').append(section);}
}
function renderLive(){const labels={disconnected:'Disconnected',connecting:'Connecting…',listening:'Connected · Listening',speaking:'Connected · Speaking',muted:'Connected · Mic muted',paused:'Connected · Audio paused',refining:'Connected · Removing redundancy…',error:'Connection error'};const badge=el('gemini-status');badge.textContent='Gemini · '+(labels[live.state]||live.state||'Disconnected');badge.dataset.state=live.state||'disconnected';badge.title=live.error||live.models||'';const connecting=live.state==='connecting';const connected=!['disconnected','error','connecting'].includes(live.state);const connectionButton=el('connect');connectionButton.hidden=false;connectionButton.disabled=connecting;connectionButton.dataset.state=connecting?'connecting':connected?'connected':'disconnected';connectionButton.title=connecting?'Connecting Gemini Live…':connected?'Disconnect Gemini Live':'Connect Gemini Live';connectionButton.setAttribute('aria-label',connectionButton.title);connectionButton.setAttribute('aria-pressed',String(connected));el('dictate').disabled=live.state==='connecting';el('dictate').hidden=connected;el('live-mode').value=live.mode||'auto';el('live-send').title=live.mode==='review'?'Finish dictation into draft':'Send captured dictation now';el('live-send').setAttribute('aria-label',el('live-send').title);for(const id of ['mute','live-send'])el(id).hidden=!connected;el('mute').title=live.muted?'Unmute microphone':'Mute microphone';el('mute').setAttribute('aria-label',el('mute').title);el('mute').setAttribute('aria-pressed',String(!!live.muted));el('live-status').textContent=(connected?'Natural turns · '+(live.pauseSeconds||3)+'s pause · '+(live.refine===false?'Original wording':'Redundancy cleanup')+(live.mode==='review'?' · Review: press Send to submit':'')+(live.notice?' · '+live.notice:''):(live.notice||'Connect Gemini Live, or Dictate to review before sending.'))+(live.error?' · '+live.error:'')+(live.latency!==undefined?' · first audio '+live.latency+' ms':'')+(live.sentMs!==undefined?' · prompt sent in '+live.sentMs+' ms':'');const latestPrompt=(live.lines||[]).filter(item=>item.role==='you'&&item.delivery).at(-1);const transcript=live.partial||live.transcript||latestPrompt?.text||'';el('transcription').hidden=!transcript;el('transcription-label').textContent=live.partial?'HEARING…':latestPrompt?.delivery==='not-sent'?'NOT SENT · SAVED AS DRAFT':latestPrompt?.delivery==='draft'?'DICTATION · DRAFT':latestPrompt?.delivery==='sending'?'SENDING…':'LAST SPOKEN PROMPT';el('live-partial').textContent=transcript;el('live-partial').scrollTop=el('live-partial').scrollHeight;const container=el('captions');container.replaceChildren();for(const [index,item] of (live.lines||[]).entries()){const row=node('article','voice-row'+(item.role==='you'?' prompt-row':''));const text=node('button','voice-text',item.text);text.title='Read aloud with Gemini TTS';text.addEventListener('click',()=>send('speakLive',{index}));row.append(node('div','row-meta',item.role.toUpperCase()+(item.delivery?' · '+({sending:'SENDING',sent:'SENT',draft:'DRAFT',"not-sent":'NOT SENT'}[item.delivery]||item.delivery):'')+' · '+time(item.ts)),text);container.append(row);}container.scrollTop=container.scrollHeight;}
function toggle(label,on,title,change){const row=node('label','skill-switch');const box=node('input');box.type='checkbox';box.checked=on;box.setAttribute('aria-label',title);box.addEventListener('change',()=>{box.disabled=true;change(box.checked);});row.append(box,node('span','',label));return row;}
function renderSkills(message){const container=el('skills');container.replaceChildren();if(message.unsupported){container.append(node('p','empty','Per-agent skill switches are available for Claude sessions only.'));return;}
  const intro=node('p','skills-note',message.changed?'Saved. Restart this agent to apply the change.':'Switches apply to this agent only and are saved in its .claude/settings.local.json.');container.append(intro);
  if(!message.groups?.length)container.append(node('p','empty','No skills found for this agent.'));
  for(const group of message.groups||[]){const section=node('article','voice-row skill-group');const meta=node('div','row-meta',group.label.toUpperCase());meta.title=group.folder||group.id||'';
    if(group.kind==='plugin'){section.append(toggle(group.label,group.on,'Plugin '+group.id,on=>send('skillSet',{kind:'plugin',name:group.id,on})));const names=node('p','skill-desc',group.skills.map(s=>s.name).join(', ')||'No skills in this plugin.');section.append(names);}
    else{section.append(meta);for(const skill of group.skills){const row=toggle(skill.name,skill.on,'Skill '+skill.name,on=>send('skillSet',{kind:'skill',name:skill.name,on}));row.title=skill.file;section.append(row);if(skill.description)section.append(node('p','skill-desc',skill.description));}}
    container.append(section);}
}
el('connect').addEventListener('click',()=>{if(!['disconnected','error'].includes(live.state)){if(live.state!=='connecting')disconnect();return;}error('');live={...live,state:'connecting'};renderLive();send('liveStart');});
function disconnect(){live={...live,state:'disconnected',partial:''};renderLive();send('liveStop');}
el('live-mode').addEventListener('change',event=>send('liveMode',{mode:event.target.value}));
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
el('dictate').addEventListener('click',()=>{error('');send('dictate');});
for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',()=>{
  for(const candidate of document.querySelectorAll('[data-tab]')){candidate.classList.toggle('active',candidate===tab);candidate.setAttribute('aria-pressed',String(candidate===tab));}
  for(const id of ['voices','views','live','skills'])el(id).hidden=tab.dataset.tab!==id;
  if(tab.dataset.tab==='skills')send('skills');
  const target=el(tab.dataset.tab==='live'?'captions':tab.dataset.tab);target.scrollTop=target.scrollHeight;
});
window.addEventListener('message',event=>{
  const message=event.data;
  if(message.type==='voices'){data=message;render();}
  else if(message.type==='live'){live=message;renderLive();}
  else if(message.type==='skills')renderSkills(message);
  else if(message.type==='draft'){el('prompt').value=message.text;el('prompt').focus();}
  else if(message.type==='sent'){el('prompt').value='';sending=false;el('send').disabled=false;error('');}
  else if(message.type==='error'){error(message.message);sending=false;el('send').disabled=false;el('dictate').disabled=false;}
});
renderLive();send('ready');
