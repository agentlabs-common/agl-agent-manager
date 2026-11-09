# Native CLI skill discovery probe; Linux, Python 3; isolated fixtures, no model service required.
import subprocess,json,tempfile,pathlib,os,shutil,threading,http.server
root=pathlib.Path(tempfile.mkdtemp(prefix='agl-kimi-prompt-'));home=root/'home';seat=root/'seat';home.mkdir();seat.mkdir();folder=seat/'.kimi-code/skills/probe';folder.mkdir(parents=True);(folder/'SKILL.md').write_text('---\nname: agl-probe\ndescription: Isolated native skill check\n---\nReply OK.')
bodies=[]
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));bodies.append(body)
  self.send_response(200);self.send_header('Content-Type','text/event-stream' if body.get('stream') else 'application/json');self.end_headers()
  if body.get('stream'):
   for choice in [{'delta':{'role':'assistant','content':'OK'},'finish_reason':None},{'delta':{},'finish_reason':'stop'}]:self.wfile.write(('data: '+json.dumps({'id':'probe','object':'chat.completion.chunk','created':0,'model':'probe','choices':[{'index':0,**choice}]})+'\n\n').encode())
   self.wfile.write(b'data: [DONE]\n\n')
  else:self.wfile.write(json.dumps({'id':'probe','object':'chat.completion','created':0,'model':'probe','choices':[{'index':0,'message':{'role':'assistant','content':'OK'},'finish_reason':'stop'}],'usage':{'prompt_tokens':1,'completion_tokens':1,'total_tokens':2}}).encode())
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
kimiHome=home/'.kimi-code';kimiHome.mkdir();(kimiHome/'config.toml').write_text(f'default_model = "probe"\n[providers.probe]\ntype = "openai"\nbase_url = "http://127.0.0.1:{server.server_port}/v1"\napi_key = "isolated-test"\n[models.probe]\nprovider = "probe"\nmodel = "probe"\nmax_context_size = 32000\n')
env={**os.environ,'HOME':str(home),'KIMI_CODE_HOME':str(kimiHome),'ELECTRON_RUN_AS_NODE':'1'}
def engine(action,**values):
 result=subprocess.run([os.environ.get('AGL_NODE','node'),str(pathlib.Path(__file__).resolve().parents[1]/'skills-engine.cjs'),json.dumps({'action':action,'root':str(seat),'provider':'kimi',**values})],env=env,capture_output=True,text=True,check=True);return json.loads(result.stdout)
try:
 for on in [True,False,True]:
  engine('skills-agent-set',kind='skill',name='agl-probe',file=str(folder/'SKILL.md'),on=on);args=engine('skills-kimi-prepare')['args'];bodies.clear()
  result=subprocess.run([os.environ.get('AGL_KIMI','kimi'),*args,'-p','Reply OK without using any tools.'],cwd=seat,env=env,capture_output=True,text=True,timeout=25)
  if result.returncode:print(result.stderr[-800:]);raise RuntimeError('Kimi exited '+str(result.returncode))
  listed=any('agl-probe' in json.dumps(body.get('messages',[])) for body in bodies);print(json.dumps({'requested':on,'nativePromptListed':listed,'requests':len(bodies)}),flush=True);assert listed==on
finally:server.shutdown();shutil.rmtree(root)
