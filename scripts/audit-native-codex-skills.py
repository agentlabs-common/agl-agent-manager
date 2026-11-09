# Native CLI skill discovery probe; Linux, Python 3; isolated fixtures, no model service required.
import subprocess,json,tempfile,pathlib,os,select,shutil
root=pathlib.Path(tempfile.mkdtemp(prefix='agl-skill-native-'));home=root/'home';seat=root/'seat';home.mkdir();seat.mkdir();(seat/'.agents/skills/probe').mkdir(parents=True);(seat/'.agents/skills/probe/SKILL.md').write_text('---\nname: probe\ndescription: Isolated skill probe\n---\nReply OK.')
subprocess.run(['git','init','-q',str(seat)],check=True)
(home/'config.toml').write_text('[projects.'+json.dumps(str(seat))+']\ntrust_level = "trusted"\n')
p=subprocess.Popen(['codex','app-server','--stdio'],cwd=seat,env={**os.environ,'CODEX_HOME':str(home)},stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
def call(i,m,params):
 p.stdin.write(json.dumps({'id':i,'method':m,'params':params})+'\n');p.stdin.flush()
 while select.select([p.stdout],[],[],15)[0]:
  line=p.stdout.readline()
  if not line:break
  v=json.loads(line)
  if v.get('id')==i:return v
 raise Exception('timeout '+m)
try:
 call(1,'initialize',{'clientInfo':{'name':'agl-skill-probe','version':'1'},'capabilities':{'experimentalApi':True}})
 def state(i):
  response=call(i,'skills/list',{'cwds':[str(seat)],'forceReload':True})
  return next(x['enabled'] for x in response['result']['data'][0]['skills'] if x['name']=='probe')
 print('enabled-before',state(2))
 for i,on in [(3,False),(4,True)]:
  request={'action':'skills-codex-set','root':str(seat),'kind':'skill','name':'probe','file':str(seat/'.agents/skills/probe/SKILL.md'),'on':on}
  subprocess.run([os.environ.get('AGL_NODE','node'),str(pathlib.Path(__file__).resolve().parents[1]/'skills-engine.cjs'),json.dumps(request)],env={**os.environ,'ELECTRON_RUN_AS_NODE':'1'},check=True,stdout=subprocess.DEVNULL)
  r=subprocess.run([os.environ.get('AGL_NODE','node'),str(pathlib.Path(__file__).resolve().parents[1]/'skills-engine.cjs'),json.dumps({'action':'skills-codex-prepare','root':str(seat)})],env={**os.environ,'ELECTRON_RUN_AS_NODE':'1'},check=True,capture_output=True,text=True)
  args=json.loads(r.stdout)['args']
  p.terminate();p.wait(timeout=5)
  p=subprocess.Popen(['codex',*args,'app-server','--stdio'],cwd=seat,env={**os.environ,'CODEX_HOME':str(home)},stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
  call(1,'initialize',{'clientInfo':{'name':'agl-skill-probe','version':'1'},'capabilities':{'experimentalApi':True}})
  actual=state(i);print('requested',on,'native-enabled',actual);assert actual==on

finally:p.terminate();p.wait(timeout=5);shutil.rmtree(root)
