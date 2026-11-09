const{spawn}=require('node:child_process');const{EventEmitter}=require('node:events');
const{createMessageConnection,StreamMessageReader,StreamMessageWriter}=require('vscode-jsonrpc/node');
const{userEnvironment}=require('./backend');
// Use Copilot's documented SDK transport; no model prompts or tool permissions are handled here.
class CopilotRpc extends EventEmitter{
 constructor({copilot='copilot',spawn:spawnProcess=spawn,env={}}={}){super();this.copilot=copilot;this.spawn=spawnProcess;this.env=env;}
 async connect(){if(!this.connecting)this.connecting=this.open().catch(error=>{this.close();throw error;});return this.connecting;}
 async open(){
  const child=this.spawn(this.copilot,['--headless','--stdio','--no-auto-update'],{env:{...userEnvironment(),...this.env},stdio:['pipe','pipe','pipe'],shell:process.platform==='win32'&&/\.(cmd|bat)$/i.test(this.copilot)});this.child=child;let stderr='';
  child.stderr.setEncoding('utf8');child.stderr.on('data',text=>{stderr=(stderr+text).slice(-2000);});child.stdin.on('error',()=>{});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',error=>reject(new Error(error.code==='ENOENT'?'Required program not found: '+this.copilot:error.message)));});
  const connection=createMessageConnection(new StreamMessageReader(child.stdout),new StreamMessageWriter(child.stdin));this.connection=connection;connection.onNotification((method,params)=>this.emit('notification',{method,params}));connection.onClose(()=>{if(this.connection===connection){this.connection=undefined;this.connecting=undefined;this.emit('disconnected');}});connection.listen();
  const pong=await this.request('ping');if(pong.protocolVersion!==3)throw new Error('This Copilot CLI uses an unsupported SDK protocol. Update Copilot CLI (expected protocol 3).');
  child.once('exit',()=>{if(this.connection===connection){connection.dispose();this.connection=undefined;this.connecting=undefined;this.emit('disconnected',stderr);}});
 }
 async request(method,params={}){if(!this.connection)throw new Error('Copilot is not connected.');let timer;try{return await Promise.race([this.connection.sendRequest(method,params),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Copilot request timed out: '+method)),20000);})]);}finally{clearTimeout(timer);}}
 close(){const child=this.child,connection=this.connection;this.child=undefined;this.connection=undefined;this.connecting=undefined;connection?.dispose();if(child){child.stdin.end();child.kill();}}
}
module.exports={CopilotRpc};
