const{test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
test('Gemini badge stays visible outside live tab, status updates, disconnects, and new content scrolls down',()=>{
 const elements=new Map(),messages=[];let receive;
 const make=()=>({children:[],hidden:false,dataset:{},scrollHeight:900,scrollTop:0,clientHeight:200,addEventListener(type,fn){this[type]=fn;},append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},querySelector(){return null;},classList:{toggle(){}},setAttribute(){}});
 const el=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../media/voice.js'),'utf8'),{acquireVsCodeApi:()=>({postMessage:m=>messages.push(m)}),document:{getElementById:el,createElement:make,querySelectorAll:()=>[]},window:{addEventListener:(type,fn)=>{receive=fn;}},Date});
 assert.equal(el('gemini-status').textContent,'Gemini · Disconnected');el('settings').click();assert.equal(messages.at(-1).type,'configureGemini');
 receive({data:{type:'live',state:'listening',lines:[{role:'you',text:'Hello'}]}});
 assert.equal(el('gemini-status').textContent,'Gemini · Connected · Listening');assert.equal(el('gemini-disconnect').hidden,false);assert.equal(el('captions').scrollTop,900);el('captions').children[0].children[1].click();assert.equal(messages.at(-1).type,'speakLive');assert.equal(messages.at(-1).index,0);
 receive({data:{type:'voices',items:[{text:'Reply'}],views:[]}});assert.equal(el('voices').scrollTop,900);
 receive({data:{type:'live',state:'error',error:'Network failed'}});assert.equal(el('gemini-status').dataset.state,'error');assert.equal(el('gemini-status').title,'Network failed');
 el('gemini-disconnect').click();assert.equal(messages.at(-1).type,'liveStop');assert.equal(el('gemini-status').textContent,'Gemini · Disconnected');
});
