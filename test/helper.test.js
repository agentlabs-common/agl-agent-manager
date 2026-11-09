const{test}=require('node:test');const assert=require('node:assert/strict');const{execFile}=require('node:child_process');const{promisify}=require('node:util');const path=require('node:path');const run=promisify(execFile);
test('Python helper: exact cwd, symlinks, transcript extraction, native attach and duplicate prevention',async()=>{const code=String.raw`import importlib.util,json,os,tempfile
spec=importlib.util.spec_from_file_location('agent', 'agent.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
sid='12345678-1234-1234-1234-123456789abc'
with tempfile.TemporaryDirectory() as root:
 folder=os.path.join(root,'work');os.mkdir(folder);nested=os.path.join(folder,'nested');os.mkdir(nested);link=os.path.join(root,'link');os.symlink(folder,link)
 values=[dict(sessionId=sid,id='12345678',cwd=folder,kind='background'),dict(sessionId='aaaaaaaa-1234-1234-1234-123456789abc',cwd=nested,kind='interactive'),dict(sessionId='bbbbbbbb-1234-1234-1234-123456789abc',cwd=folder+'-other',kind='interactive')]
 commands=[]
 def fake(args,cwd=None):commands.append(args);return json.dumps(values)
 a.run=fake;a.metadata=lambda sid:{}
 found=a.listing(link);assert len(found)==1 and found[0]['cwd']==folder
 assert commands[0][-2:]==['--cwd',folder]
 assert a.prepare(folder,sid)['argv']==['claude','attach','12345678']
 a.listing=lambda cwd:[dict(sessionId=sid,cwd=folder,kind='interactive',live=False)]
 assert a.prepare(folder,sid,True)['argv']==['claude','--resume',sid,'--dangerously-skip-permissions']
 assert a.prepare(folder,sid)['argv']==['claude','--resume',sid]
 import contextlib,io,sys
 for enabled in ('true','false'):
  commands.clear();sys.argv=['agent.py','new',folder,'Fast',enabled]
  with contextlib.redirect_stdout(io.StringIO()):a.main()
  assert ('--dangerously-skip-permissions' in commands[0])==(enabled=='true')
 a.listing=lambda cwd:[dict(sessionId=sid,cwd=folder,kind='interactive',live=True)]
 a.tmux_target=lambda session:None
 try:a.prepare(folder,sid);raise AssertionError('live session duplicated')
 except RuntimeError as e:assert 'duplicate' in str(e)
 file=os.path.join(root,'log.jsonl')
 entries=[{'type':'user','message':{'content':'Hello'}},{'type':'assistant','message':{'content':[{'type':'text','text':'Use the literal '+chr(96)+'<voice>'+chr(96)+' tag.\n<voice>Spoken summary</voice>\n<view>\nNotes\n</view>'}]}}]
 with open(file,'w') as stream:
  for entry in entries:stream.write(json.dumps(entry)+'\n')
 a.transcript=lambda sid:file
 data=a.voices(sid);assert data['items'][0]['you'];assert data['items'][1]['text']=='Use the literal tag.';assert data['items'][1]['speechText']=='Spoken summary';assert data['views'][0]['text']=='Notes'
print('Native helper checks passed')`;const result=await run('python3',['-c',code],{cwd:path.join(__dirname,'..')});assert.match(result.stdout,/checks passed/);});

test('incremental transcript cursor preserves partial records and exposes reply text before voice tags',async()=>{const code=String.raw`import importlib.util,json,os,tempfile
spec=importlib.util.spec_from_file_location('agent','agent.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
with tempfile.TemporaryDirectory() as root:
 f=os.path.join(root,'log.jsonl');open(f,'w').close();a.transcript=lambda sid:f
 first=a.voices('sid');assert first['reset'] and first['items']==[]
 entry={'type':'assistant','timestamp':'now','message':{'id':'turn-one','content':[{'type':'text','text':'The tests passed. More detail follows.'}]}}
 raw=(json.dumps(entry)+'\n').encode()
 with open(f,'ab') as stream:stream.write(raw[:20])
 partial=a.voices('sid',first['cursor']);assert partial['items']==[] and partial['cursor']==first['cursor']
 with open(f,'ab') as stream:stream.write(raw[20:])
 next=a.voices('sid',partial['cursor']);assert next['items'][0]['source']=='early' and next['items'][0]['text']=='The tests passed. More detail follows.'
 unchanged=a.voices('sid',next['cursor']);assert unchanged['items']==[] and unchanged['cursor']==next['cursor']
 entry['message']['content'][0]['text']='<voice>The tests passed.</voice>'
 with open(f,'a') as stream:stream.write(json.dumps(entry)+'\n')
 final=a.voices('sid',next['cursor']);assert final['items'][0]['source']=='voice' and final['items'][0]['turn']=='turn-one'
 open(f,'w').close();reset=a.voices('sid',final['cursor']);assert reset['reset']
print('Cursor checks passed')`;const r=await run('python3',['-c',code],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});

test('YOLO restart retains the session ID, waits for shutdown and rejects unsafe targets',async()=>{const r=await run('python3',['-c',"import importlib.util\nspec=importlib.util.spec_from_file_location('agent','agent.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)\nsid='12345678-1234-1234-1234-123456789abc';calls=[]\nsession=dict(sessionId=sid,id='12345678',cwd='/work',kind='background',live=True)\na.run=lambda args,cwd=None,both=False:calls.append(args) or ''\nqueries=iter([[session],[]]);a.listing=lambda cwd:next(queries)\nresult=a.restart_yolo('/work',sid)\nassert calls==[['claude','stop','12345678'],['claude','--bg','--resume',sid,'--dangerously-skip-permissions']]\nassert result['argv']==['claude','attach',sid] and result['session']['sessionId']==sid\ncalls.clear();stuck={**session,'kind':'interactive','pid':42,'procStart':1};a.listing=lambda cwd:[stuck];a.time.sleep=lambda _:None;a.process_alive=lambda s:True;a.os.kill=lambda pid,sig:None\ntry:a.restart_yolo('/work',sid);raise AssertionError('duplicate allowed')\nexcept RuntimeError as error:assert 'duplicate' in str(error)\nassert calls==[]\ncalls.clear();a.listing=lambda cwd:[]\ntry:a.restart_yolo('/other',sid);raise AssertionError('scope ignored')\nexcept RuntimeError as error:assert 'working directory' in str(error)\nassert calls==[]\ninteractive={**session,'kind':'interactive','pid':42,'procStart':1};a.listing=lambda cwd:[interactive];a.process_alive=lambda s:False\ntry:a.restart_yolo('/work',sid);raise AssertionError('unverified process killed')\nexcept RuntimeError as error:assert 'verify' in str(error)\nassert calls==[]\na.process_alive=lambda s:True;signals=[];a.os.kill=lambda pid,sig:signals.append(pid);queries=iter([[interactive],[]]);a.listing=lambda cwd:next(queries)\na.restart_yolo('/work',sid);assert signals==[42];assert calls==[['claude','--bg','--resume',sid,'--dangerously-skip-permissions']]\nprint('Restart checks passed')"],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});

test('long replies retain every sentence and code text instead of their voice summaries',async()=>{const r=await run('python3',['-c',"import agent,json,tempfile,os\nbody='First sentence. '+('All of these details must remain visible and spoken. '*40)+'Final sentence.'\nwith tempfile.TemporaryDirectory() as root:\n f=os.path.join(root,'log.jsonl');agent.transcript=lambda sid:f\n entries=[{'type':'user','message':{'content':'x'*3000}},{'type':'assistant','message':{'id':'turn','content':[{'type':'text','text':body+'\\n<voice>Short summary.</voice>'}]}}]\n with open(f,'w') as stream:\n  for entry in entries:stream.write(json.dumps(entry)+'\\n')\n result=agent.voices('sid');assert result['items'][0]['text']=='x'*3000\n reply=result['items'][1];assert reply['text']==body and reply['hasVoice'];assert 'Short summary' not in reply['text']\n assert agent.reply_text('Explanation.\\n```python\\nprint(42)\\n```\\nLast sentence.')=='Explanation. print(42) Last sentence.'\nprint('Full reply checks passed')"],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});

test('Claude string replies and mixed content do not stall transcript display',async()=>{const r=await run('python3',['-c',"import agent,tempfile,os,json\nwith tempfile.TemporaryDirectory() as root:\n p=os.path.join(root,'session.jsonl');agent.transcript=lambda sid:p\n entries=[{'type':'assistant','message':None},{'type':'assistant','message':{'id':'string-reply','content':'The complete response uses string content.'}},{'type':'assistant','message':{'id':'mixed-reply','content':[None,'ignore',{'type':'text','text':'Valid text remains visible.'}]}}]\n with open(p,'w') as stream:\n  for entry in entries:stream.write(json.dumps(entry)+'\\n')\n items=agent.voices('sid')['items'];assert len(items)==2;assert items[0]['text']=='The complete response uses string content.';assert items[1]['text']=='Valid text remains visible.'\nprint('Transcript shape checks passed')"],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});

test('closed Claude history is scoped, resumable, deduplicated and safely deletable',async()=>{const code=String.raw`import agent,json,os,tempfile
sid='dddddddd-1234-1234-1234-123456789abc';other='eeeeeeee-1234-1234-1234-123456789abc'
with tempfile.TemporaryDirectory() as home:
 os.environ['HOME']=home;root=os.path.join(home,'work');os.mkdir(root);folder=os.path.join(home,'.claude','projects',agent.re.sub(r'[^a-zA-Z0-9]','-',root));os.makedirs(folder)
 file=os.path.join(folder,sid+'.jsonl')
 def write(path,cwd):
  with open(path,'w') as stream:
   stream.write(json.dumps(dict(type='user',cwd=cwd,message=dict(content='Saved task')))+'\n')
   stream.write(json.dumps({'type':'custom-title','customTitle':'Closed conversation'})+'\n')
 write(file,root);write(os.path.join(folder,other+'.jsonl'),root+'/nested');calls=[];agent.run=lambda args,cwd=None:calls.append(args) or '[]';agent.metadata=lambda sid:{}
 rows=agent.listing(root);assert len(rows)==1 and rows[0]['name']=='Closed conversation' and not rows[0]['live']
 assert agent.prepare(root,sid)['argv']==['claude','--resume',sid]
 try:agent.delete_session(root,other);raise AssertionError('out of folder deletion allowed')
 except RuntimeError:pass
 native=dict(sessionId=sid,id=sid,kind='interactive',state='idle',cwd=root);agent.run=lambda args,cwd=None:json.dumps([native])
 assert len(agent.listing(root))==1
 try:agent.delete_session(root,sid);raise AssertionError('running session deleted')
 except RuntimeError:pass
 agent.run=lambda args,cwd=None:'[]';agent.delete_session(root,sid);assert not os.path.exists(file);assert os.path.exists(os.path.join(folder,other+'.jsonl'))
print('Saved history checks passed')`;const r=await run('python3',['-c',code],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});

test('managed Claude listing includes descendants but excludes workspace-root and sibling agents',async()=>{const code=String.raw`import agent,json,tempfile,os
with tempfile.TemporaryDirectory() as root:
 managed=os.path.join(root,'.sessions','claude','task-id');os.makedirs(managed)
 values=[dict(sessionId='11111111-2222-3333-4444-555555555555',cwd=root,kind='interactive'),dict(sessionId='22222222-2222-3333-4444-555555555555',cwd=managed,kind='interactive'),dict(sessionId='33333333-2222-3333-4444-555555555555',cwd=managed+'/repo/src',kind='interactive'),dict(sessionId='44444444-2222-3333-4444-555555555555',cwd=managed+'-other',kind='interactive')]
 calls=[];agent.run=lambda args,cwd=None:calls.append(args) or json.dumps(values);agent.metadata=lambda sid:{};agent.saved_sessions=lambda cwd,descendants=False:[]
 rows=agent.listing(root,[managed]);assert len(rows)==2;assert {row['cwd'] for row in rows}=={managed,managed+'/repo/src'};assert '--cwd' not in calls[0]
print('Managed Claude checks passed')`;const r=await run('python3',['-c',code],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});

test('Claude subprocess starts in its session directory with a matching PWD environment',async()=>{const r=await run('python3',['-c',"import agent,json,os,sys,tempfile\nwith tempfile.TemporaryDirectory() as root:\n target=os.path.join(root,'session');os.mkdir(target)\n result=json.loads(agent.run([sys.executable,'-c',\"import os,json;print(json.dumps(dict(cwd=os.getcwd(),pwd=os.environ.get('PWD'))))\"],target))\n assert result['cwd']==os.path.realpath(target) and result['pwd']==os.path.realpath(target)\nprint('Session cwd checks passed')"],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});
test('YOLO restart changes a background session in place: saved options, no flags, same id and name',async()=>{const r=await run('python3',['-c',"import importlib.util,json,os,tempfile\nspec=importlib.util.spec_from_file_location('agent','agent.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)\nhome=tempfile.mkdtemp();os.environ['HOME']=home;sid='aaaaaaaa-1234-1234-1234-123456789abc'\njob=os.path.join(home,'.claude','jobs','aaaaaaaa');os.makedirs(job)\njson.dump(dict(sessionId=sid,name='hrms-lead',respawnFlags=['--name','hrms-lead','--permission-mode','auto','--model','opus']),open(os.path.join(job,'state.json'),'w'))\ncalls=[];a.run=lambda args,cwd=None,both=False:calls.append(args) or ''\nsession=dict(sessionId=sid,id='aaaaaaaa',cwd='/work',kind='background',live=True,name='hrms-lead')\nqueries=iter([[session],[]]);a.listing=lambda cwd:next(queries)\na.restart_yolo('/work',sid)\nassert calls==[['claude','stop','aaaaaaaa'],['claude','--bg','--resume',sid]],calls\nflags=json.load(open(os.path.join(job,'state.json')))['respawnFlags'];assert flags==['--name','hrms-lead','--model','opus','--dangerously-skip-permissions'],flags\njson.dump(dict(sessionId=sid,respawnFlags=[]),open(os.path.join(job,'state.json'),'w'));queries=iter([[session],[]]);a.listing=lambda cwd:next(queries);a.restart_yolo('/work',sid)\nassert json.load(open(os.path.join(job,'state.json')))['respawnFlags']==['--dangerously-skip-permissions','--name','hrms-lead'],'name kept when the job had none'\nprint('checks passed')"],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});
test('agent list: stopped background agents are not live; older copies of one agent are marked, running rows never',async()=>{const r=await run('python3',['-c',"import importlib.util,json\nspec=importlib.util.spec_from_file_location('agent','agent.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)\nW='/w/.sessions/claude/hrms-dev-1'\nsid=lambda n:'%08d-1234-1234-1234-123456789abc'%n\nagents=[dict(sessionId=sid(1),cwd=W,kind='background',state='blocked',status=None,name='hrms-dev-1',startedAt=1000),dict(sessionId=sid(2),cwd=W,kind='background',state='working',status='busy',name='hrms-dev-1',startedAt=2000),dict(sessionId=sid(3),cwd='/w/.sessions/claude/arch',kind='background',state='done',status='idle',name='arch',startedAt=3000)]\na.run=lambda args,cwd=None,both=False:json.dumps(agents)\na.metadata=lambda s:{}\na.os.path.realpath=lambda p:p\nsaved=[dict(sessionId=sid(4),name='hrms-dev-1',cwd=W,kind='saved',state='closed',live=False,updatedAt=5),dict(sessionId=sid(5),name='arch',cwd='/w/.sessions/claude/arch',kind='saved',state='closed',live=False,updatedAt=9)]\na.saved_sessions=lambda value,descendants=False:saved\nrows={r['sessionId'][:8]:r for r in a.listing('/w',['/w/.sessions'])}\nassert rows['00000001']['live'] is False and rows['00000001']['state']=='not running'\nassert rows['00000002']['live'] is True and not rows['00000002'].get('olderCopy')\nassert rows['00000001'].get('olderCopy') and rows['00000004'].get('olderCopy'),'stopped and transcript-only copies are older'\nassert rows['00000003']['live'] is True and not rows['00000003'].get('olderCopy'),'running idle row is kept'\nassert rows['00000005'].get('olderCopy'),'saved transcript beside a running row is older'\nprint('checks passed')"],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});
test('YOLO restart waits until the stop has taken effect, never passes stdin, and reports a copy instead of hiding it',async()=>{const r=await run('python3',['-c',"import importlib.util,json,os,tempfile\nspec=importlib.util.spec_from_file_location('agent','agent.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)\nhome=tempfile.mkdtemp();os.environ['HOME']=home;sid='bbbbbbbb-1234-1234-1234-123456789abc'\njob=os.path.join(home,'.claude','jobs','bbbbbbbb');os.makedirs(job);json.dump(dict(sessionId=sid,name='auth-lead',respawnFlags=['--name','auth-lead']),open(os.path.join(job,'state.json'),'w'))\nsession=dict(sessionId=sid,id='bbbbbbbb',cwd='/w',kind='background',live=True,name='auth-lead')\nsleeps=[];a.time.sleep=lambda s:sleeps.append(s)\nqueries=iter([[session],[session],[session],[]]);a.listing=lambda cwd:next(queries)\ncalls=[];a.run=lambda args,cwd=None,both=False:calls.append(args) or ('note: session bbbbbbbb is already running in the background, so this started a copy as 3a6e08bf.' if '--resume' in args else '')\ntry:a.restart_yolo('/w',sid);raise AssertionError('copy hidden')\nexcept RuntimeError as e:assert 'copy' in str(e),e\nassert calls[0]==['claude','stop','bbbbbbbb'] and calls[1]==['claude','--bg','--resume',sid],calls\nassert sleeps.count(.5)==2,'waited for two polls until the session was no longer live'\nassert 'stdin=subprocess.DEVNULL' in open('agent.py').read()\nprint('checks passed')"],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});
