const KEY='geminiApiKey';
const VOICES=['Aoede','Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Callirrhoe','Autonoe','Enceladus','Iapetus','Umbriel','Algieba','Despina','Erinome','Algenib','Rasalgethi','Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird','Zubenelgenubi','Vindemiatrix','Sadachbia','Sadaltager','Sulafat'];
async function voiceOptions(vscode,context){
 const config=vscode.workspace.getConfiguration('claudeFolderAgents');
 return{apiKey:await context.secrets?.get(KEY),ttsModel:config.get('ttsModel',''),ttsVoice:config.get('ttsVoice',''),ttsStyle:config.get('ttsStyle',''),voicePython:config.get('voicePython','')};
}
async function configureGemini(vscode,context){
 const config=vscode.workspace.getConfiguration('claudeFolderAgents');
 const stored=!!(await context.secrets.get(KEY));
 const chosen=await vscode.window.showQuickPick([
  {label:'TTS model',description:config.get('ttsModel')||'Default / environment',id:'ttsModel'},
  {label:'TTS voice',description:config.get('ttsVoice')||'Default / environment',id:'ttsVoice'},
  {label:'Speaking style',description:config.get('ttsStyle')||'Natural delivery',id:'ttsStyle'},
  {label:'Set Gemini API key',description:stored?'Secure key is saved':'Uses environment or keys.env when no secure key is saved',id:'key'},
  ...(stored?[{label:'Remove saved API key',description:'Return to environment or keys.env',id:'removeKey'}]:[]),
  {label:'Transcription model',description:config.get('transcriptionModel')||'Default / environment',id:'transcriptionModel'},
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
  const pick=await vscode.window.showQuickPick([{label:'Default / environment',value:''},...options.map(label=>({label,value:label})),{label:'Custom…',custom:true}],{title:chosen.label,placeHolder:'Current: '+(config.get(chosen.id)||'Default / environment')});
  if(!pick)return;
  value=pick.custom?await vscode.window.showInputBox({title:'Custom '+chosen.label,value:config.get(chosen.id)||'',prompt:'Enter the model or voice ID available to your Gemini account.'}):pick.value;
 }else if(chosen.id==='liveBargeIn'){
  const pick=await vscode.window.showQuickPick([{label:'Off — prevent speaker echo',value:false},{label:'On — use a headset',value:true}],{title:chosen.label});if(!pick)return;value=pick.value;
 }else value=await vscode.window.showInputBox({title:chosen.label,value:config.get(chosen.id)||'',prompt:chosen.id==='ttsStyle'?'For example: warm, calm, and conversational. Leave empty for natural delivery.':'Leave empty to use the default.'});
 if(value===undefined)return;
 if(typeof value==='string')value=value.trim();
 await config.update(chosen.id,value,vscode.ConfigurationTarget.Global);
 await vscode.window.showInformationMessage(chosen.id==='transcriptionModel'||chosen.id==='voicePython'||chosen.id==='liveBargeIn'?'Saved. Reconnect Gemini Live to apply the change.':'Saved. The next readout uses the updated settings.');
}
module.exports={configureGemini,voiceOptions,VOICES};
