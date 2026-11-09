# Native CLI skill discovery probe; Linux, Python 3; isolated fixtures, no model service required.
import subprocess,json,tempfile,pathlib,os,select,shutil,time
root=pathlib.Path(tempfile.mkdtemp(prefix='agl-claude-native-'));folder=root/'.claude/skills/agl-probe';folder.mkdir(parents=True);(folder/'SKILL.md').write_text('---\nname: agl-probe\ndescription: Isolated native skill check\n---\nReply OK.')
def probe(on):
 r=subprocess.run([os.environ.get('AGL_NODE','node'),str(pathlib.Path(__file__).resolve().parents[1]/'skills-engine.cjs'),json.dumps({'action':'skills-agent-set','root':str(root),'provider':'claude','kind':'skill','name':'agl-probe','on':on})],env={**os.environ,'ELECTRON_RUN_AS_NODE':'1'},capture_output=True,text=True,check=True)
 env=os.environ.copy();env.pop('CLAUDECODE',None)
 p=subprocess.Popen(['claude','--input-format','stream-json','--output-format','stream-json','--verbose','--setting-sources','project,local'],cwd=root,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
 try:
  p.stdin.write(json.dumps({'type':'control_request','request_id':'probe','request':{'subtype':'initialize'}})+'\n');p.stdin.flush()
  deadline=time.time()+20
  while time.time()<deadline and select.select([p.stdout],[],[],10)[0]:
   line=p.stdout.readline()
   if not line:break
   d=json.loads(line)
   if d.get('type')=='control_response':
    commands=d.get('response',{}).get('response',{}).get('commands',[]);found=any(c.get('name')=='agl-probe' for c in commands);print(json.dumps({'requested':on,'nativeListed':found,'responseSubtype':d.get('response',{}).get('subtype')}));assert found==on;return
  raise RuntimeError('Claude initialization timed out')
 finally:p.terminate();p.wait(timeout=5)
try:
 for on in [True,False,True]:probe(on)
finally:shutil.rmtree(root)
