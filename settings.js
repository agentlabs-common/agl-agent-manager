const{Backend}=require('./backend');
const KEY='geminiApiKey';
const VOICES=['Aoede','Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Callirrhoe','Autonoe','Enceladus','Iapetus','Umbriel','Algieba','Despina','Erinome','Algenib','Rasalgethi','Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird','Zubenelgenubi','Vindemiatrix','Sadachbia','Sadaltager','Sulafat'];
async function voiceOptions(vscode,context){
 const config=vscode.workspace.getConfiguration('claudeFolderAgents');
 return{apiKey:await context.secrets?.get(KEY),ttsModel:config.get('ttsModel',''),ttsVoice:config.get('ttsVoice',''),ttsStyle:config.get('ttsStyle',''),voicePython:config.get('voicePython','')};
}
async function chooseCatalogVoice(vscode,context,filter,backend){
 const args=[];for(const [key,value] of Object.entries(filter))if(value)args.push('--'+key,value);
 const result=JSON.parse(await backend.voice('voices',...args));
 const rows=(result.voices||[]).filter(voice=>voice.id).map(voice=>({label:voice.display_name||voice.id,description:[voice.language_code,voice.accent,voice.gender,voice.pitch].filter(Boolean).join(' · '),detail:voice.description||voice.persona||voice.id,value:voice.id}));
 if(!rows.length){await vscode.window.showInformationMessage('No Gemini voices match these filters for your API key. Try another language or the built-in voices.');return;}
 while(true){
  const voice=await vscode.window.showQuickPick(rows,{title:'Gemini voice catalog · '+(filter.language||'All languages'),placeHolder:'Search voices by name, accent or description',matchOnDescription:true,matchOnDetail:true});if(!voice){await backend.voice('stop');return;}
  while(true){
   const action=await vscode.window.showQuickPick([{label:'Use this voice',id:'use'},{label:'Preview voice',id:'preview'},{label:'Stop preview',id:'stop'},{label:'Back to voice list',id:'back'}],{title:voice.label,placeHolder:voice.description});if(!action){await backend.voice('stop');return;}
   if(action.id==='back'){await backend.voice('stop');break;}
   if(action.id==='use'){await backend.voice('stop');return voice.value;}
   if(action.id==='stop'){await backend.voice('stop');}
   if(action.id==='preview'){await backend.voice('preview',voice.value,'Hello! I am ready to help you with your Claude sessions. You can choose this voice for reading your messages aloud.');}
  }
 }
}
async function configureGemini(vscode,context,voiceBackend){
 const config=vscode.workspace.getConfiguration('claudeFolderAgents');
 const stored=!!(await context.secrets.get(KEY));
 const chosen=await vscode.window.showQuickPick([
  {label:'TTS model',description:config.get('ttsModel')||'Default / environment',id:'ttsModel'},
  {label:'TTS voice',description:config.get('ttsVoice')||'Default / environment',id:'ttsVoice'},
  {label:'Speaking style',description:config.get('ttsStyle')||'Natural delivery',id:'ttsStyle'},
  {label:'Set Gemini API key',description:stored?'Secure key is saved':'Uses environment or keys.env when no secure key is saved',id:'key'},
  ...(stored?[{label:'Remove saved API key',description:'Return to environment or keys.env',id:'removeKey'}]:[]),
  {label:'Gemini Live model',description:config.get('liveModel')||'gemini-3.8-live',id:'liveModel'},
  {label:'Pause before sending',description:String(config.get('livePauseSeconds',3))+' seconds',id:'livePauseSeconds'},
  {label:'Polish spoken prompts',description:config.get('refineSpokenPrompts',true)?'On':'Off',id:'refineSpokenPrompts'},
  {label:'Microphone during readout',description:config.get('liveBargeIn',false)?'On (headset)':'Off (prevents speaker echo)',id:'liveBargeIn'},
  {label:'Voice Python executable',description:config.get('voicePython')||'Automatic',id:'voicePython'},
  {label:'All extension settings',id:'all'}
 ],{title:'Gemini voice settings',placeHolder:'Choose what to configure'});
 if(!chosen)return;
 if(chosen.id==='all')return vscode.commands.executeCommand('workbench.action.openSettings','@ext:local-tools.claude-folder-agents');
 if(chosen.id==='removeKey'){await context.secrets.delete(KEY);return vscode.window.showInformationMessage('Saved Gemini API key removed. Reconnect Live to use the fallback key.');}
 if(chosen.id==='key'){
  const value=await vscode.window.showInputBox({title:'Gemini API key',prompt:'Stored in VS Code secure storage on this computer. Reconnect Live after changing it.',password:true,ignoreFocusOut:true,validateInput:value=>value.trim()&&!/\s/.test(value.trim())?undefined:'Enter a non-empty API key without whitespace.'});
  if(value===undefined)return;
  await context.secrets.store(KEY,value.trim());return vscode.window.showInformationMessage('Gemini API key saved securely. TTS uses it on the next playback; reconnect Live to use it there.');
 }
 let value;
 if(chosen.id==='ttsModel'||chosen.id==='ttsVoice'){
  const options=chosen.id==='ttsModel'?['gemini-3.8-flash-tts','gemini-3.8-flash-lite-tts']:VOICES;
  const pick=await vscode.window.showQuickPick([{label:'Default / environment',value:''},...(chosen.id==='ttsVoice'?[{label:'Indian English · Female',catalog:{language:'en-IN',gender:'female'}},{label:'Hindi · Female',catalog:{language:'hi-IN',gender:'female'}},{label:'Browse voice catalog…',browse:true}]:[]),...options.map(label=>({label,value:label})),{label:'Custom…',custom:true}],{title:chosen.label,placeHolder:'Current: '+(config.get(chosen.id)||'Default / environment')});
  if(!pick)return;
  if(pick.catalog||pick.browse){
   let filter=pick.catalog;
   if(pick.browse){
    const language=await vscode.window.showQuickPick([{label:'Indian English',value:'en-IN'},{label:'Hindi',value:'hi-IN'},{label:'Marathi',value:'mr-IN'},{label:'Tamil',value:'ta-IN'},{label:'Telugu',value:'te-IN'},{label:'Kannada',value:'kn-IN'},{label:'Malayalam',value:'ml-IN'},{label:'Bengali',value:'bn-IN'},{label:'Gujarati',value:'gu-IN'},{label:'Punjabi',value:'pa-IN'},{label:'All languages',value:''}],{title:'Voice language'});if(!language)return;
    const gender=await vscode.window.showQuickPick([{label:'Female',value:'female'},{label:'Male',value:'male'},{label:'All voices',value:''}],{title:'Voice gender'});if(!gender)return;filter={language:language.value,gender:gender.value};
   }
   const backend=voiceBackend||new Backend({getVoiceOptions:()=>voiceOptions(vscode,context)});
   value=await chooseCatalogVoice(vscode,context,filter,backend);
  }else value=pick.custom?await vscode.window.showInputBox({title:'Custom '+chosen.label,value:config.get(chosen.id)||'',prompt:'Enter the model or voice ID available to your Gemini account.'}):pick.value;
 }else if(chosen.id==='livePauseSeconds'){
  const pick=await vscode.window.showQuickPick([{label:'3 seconds',value:3},{label:'5 seconds',value:5},{label:'Custom…',custom:true}],{title:'Pause before considering your turn complete'});if(!pick)return;value=pick.custom?Number(await vscode.window.showInputBox({title:'Pause in seconds',value:String(config.get('livePauseSeconds',3)),validateInput:v=>Number(v)>=1&&Number(v)<=10?undefined:'Choose 1 to 10 seconds.'})):pick.value;if(!Number.isFinite(value)||value<1||value>10)return;
 }else if(chosen.id==='refineSpokenPrompts'){
  const pick=await vscode.window.showQuickPick([{label:'On — polish grammar and self-corrections',value:true},{label:'Off — keep original wording',value:false}],{title:chosen.label});if(!pick)return;value=pick.value;
 }else if(chosen.id==='liveBargeIn'){
  const pick=await vscode.window.showQuickPick([{label:'Off — prevent speaker echo',value:false},{label:'On — use a headset',value:true}],{title:chosen.label});if(!pick)return;value=pick.value;
 }else value=await vscode.window.showInputBox({title:chosen.label,value:config.get(chosen.id)||'',prompt:chosen.id==='ttsStyle'?'For example: warm, calm, and conversational. Leave empty for natural delivery.':'Leave empty to use the default.'});
 if(value===undefined)return;
 if(typeof value==='string')value=value.trim();
 await config.update(chosen.id,value,vscode.ConfigurationTarget.Global);
 await vscode.window.showInformationMessage(['liveModel','livePauseSeconds','refineSpokenPrompts','voicePython','liveBargeIn'].includes(chosen.id)?'Saved. Reconnect Gemini Live to apply the change.':'Saved. The next readout uses the updated settings.');
}
module.exports={configureGemini,voiceOptions,chooseCatalogVoice,VOICES};
