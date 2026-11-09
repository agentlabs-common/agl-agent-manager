#!/usr/bin/env python3
"""Native Claude session discovery, also executable over SSH via stdin."""
import glob,json,os,re,shutil,signal,subprocess,sys,time
UUID=re.compile(r'^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$',re.I)
VOICE=re.compile(r'(?<!`)<voice>((?:(?!<voice>).)*?)</voice>',re.S)
VIEW=re.compile(r'^<view>[ \t]*\n(.*?)\n</view>[ \t]*$',re.S|re.M)
def run(args,cwd=None,both=False):
    env=dict(os.environ)
    if cwd is not None:env['PWD']=os.path.realpath(cwd)
    for key in ('CLAUDECODE','HC_TERMINAL_ID','HC_SCOPE'):env.pop(key,None)
    env['PATH']=os.path.expanduser('~/.local/bin')+os.pathsep+env.get('PATH','')
    # stdin is never passed on: a claude that starts a session would read it as a prompt (seen when called inside a `while read` loop).
    p=subprocess.run(args,cwd=cwd,env=env,capture_output=True,text=True,stdin=subprocess.DEVNULL)
    if p.returncode:raise RuntimeError(p.stderr.strip() or p.stdout.strip() or 'Command failed')
    return (p.stdout+'\n'+p.stderr).strip() if both else p.stdout.strip()
def metadata(sid):
    matches=[]
    for file in glob.glob(os.path.expanduser('~/.claude/sessions/*.json')):
        try:
            value=json.load(open(file))
            if value.get('sessionId')==sid:matches.append(value)
        except (OSError,ValueError):pass
    for value in sorted(matches,key=lambda x:x.get('updatedAt',0),reverse=True):
        try:
            stat=open('/proc/%s/stat'%value['pid']).read().rsplit(')',1)[1].split()
            if stat[19]==str(value.get('procStart')):return value
        except (OSError,KeyError):pass
    return matches[0] if matches else {}
def saved_sessions(cwd,descendants=False):
    root=os.path.realpath(cwd);projects=os.path.expanduser('~/.claude/projects');files=set();indexed={}
    for value in {root,cwd}:
        folder=os.path.join(projects,re.sub(r'[^a-zA-Z0-9]','-',value))
        files.update(glob.glob(os.path.join(folder+('*' if descendants else ''),'*.jsonl')))
    for index in glob.glob(os.path.join(projects,'*','sessions-index.json')):
        try:
            for item in json.load(open(index)).get('entries',[]):
                if os.path.realpath(item.get('projectPath') or item.get('cwd') or '')!=root:continue
                sid=item.get('sessionId','');file=os.path.join(os.path.dirname(index),sid+'.jsonl')
                if UUID.fullmatch(sid):files.add(file);indexed[sid]=item
        except (OSError,ValueError,TypeError):pass
    out=[]
    for file in files:
        sid=os.path.basename(file)[:-6]
        if not UUID.fullmatch(sid) or os.path.islink(file):continue
        try:
            stat=os.stat(file)
            with open(file,'rb') as stream:
                head=stream.read(1024*1024);stream.seek(max(len(head),stat.st_size-128*1024));tail=stream.read()
            info=indexed.get(sid,{})
            actual=info.get('projectPath') or info.get('cwd');name=info.get('customTitle') or info.get('summary') or info.get('firstPrompt') or ''
            for line in (head+b'\n'+tail).splitlines():
                try:entry=json.loads(line)
                except (ValueError,UnicodeDecodeError):continue
                if not isinstance(entry,dict):continue
                actual=actual or entry.get('cwd')
                if entry.get('type')=='custom-title':name=entry.get('customTitle') or name
                if not name and entry.get('type')=='user' and not entry.get('isMeta'):
                    content=(entry.get('message') or {}).get('content','')
                    if isinstance(content,str) and not content.lstrip().startswith('<'):name=content
            if not actual or (os.path.commonpath([os.path.realpath(actual),root])!=root if descendants else os.path.realpath(actual)!=root):continue
            out.append(dict(sessionId=sid,id=sid,name=' '.join(name.split())[:100] or 'Claude · '+sid[:8],cwd=os.path.realpath(actual),kind='saved',state='closed',live=False,updatedAt=stat.st_mtime,transcript=file))
        except (OSError,ValueError,TypeError,AttributeError):continue
    return out

def listing(cwd,managed_roots=None):
    root=os.path.realpath(cwd)
    rows=json.loads(run([os.environ.get('CLAUDE_AGENTS_CLI','claude'),'agents','--json','--all']+([] if managed_roots is not None else ['--cwd',root]),root))
    allowed=[os.path.realpath(value) for value in managed_roots] if managed_roots is not None else None
    out=[]
    for item in rows:
        actual=os.path.realpath(item.get('cwd',''))
        if (not any(os.path.commonpath([actual,value])==value for value in allowed)) if allowed is not None else actual!=root:continue
        sid=item.get('sessionId','')
        if not UUID.fullmatch(sid):continue
        meta=metadata(sid)
        item.update(pid=meta.get('pid'),procStart=meta.get('procStart'),tmux=meta.get('tmux'),cwd=actual)
        # A background session is running only while Claude Code reports a status (busy, idle or waiting); a stopped one keeps
        # its last state ('blocked', 'done') with no status and no process.
        item['live']=(process_alive(meta) if meta.get('pid') else True) if item.get('kind')=='interactive' else bool(item.get('status')) and item.get('state') not in ('failed','stopped','completed','exited')
        if not item['live']:item['state']='closed' if item.get('kind')=='interactive' else 'not running'
        out.append(item)
    known={item['sessionId'] for item in out}
    for value in (allowed if allowed is not None else [cwd]):
        for item in saved_sessions(value,descendants=allowed is not None):
            if item['sessionId'] not in known:out.append(item);known.add(item['sessionId'])
    mark_older_copies(out)
    return out

# Copies of one agent (same name, same folder, e.g. left by the old YOLO restart or kept as a transcript after `claude rm`)
# show once: the running row, else the newest. The others are marked older and hidden; a running row is never marked.
def mark_older_copies(rows):
    groups={}
    for row in rows:
        name=' '.join(str(row.get('name') or '').split()).lower()
        if name:groups.setdefault((row.get('cwd'),name),[]).append(row)
    for group in groups.values():
        if len(group)<2:continue
        stamp=lambda row:float(row.get('updatedAt') or (row.get('startedAt') or 0)/1000 or 0)
        keep=max(group,key=lambda row:(bool(row.get('live')),stamp(row)))
        for row in group:
            if row is not keep and not row.get('live'):row['olderCopy']=True

def transcript(sid):
    if not UUID.fullmatch(sid):raise ValueError('Invalid Claude session ID')
    hits=glob.glob(os.path.expanduser('~/.claude/projects/*/'+sid+'.jsonl'))
    return max(hits,key=os.path.getmtime) if hits else None
def reply_text(text):
    text=re.sub(r'<view>.*?</view>','',text,flags=re.S)
    text=VOICE.sub('',text)
    text=re.sub(r'^\s*\x60\x60\x60[^\n]*$','',text,flags=re.M)
    text=re.sub(r'\[([^\]]+)\]\([^)]+\)',r'\1',text)
    text=re.sub(r'</?(?:voice|view)>','',text)
    text=re.sub(r'^#{1,6}\s+','',text,flags=re.M)
    text=text.replace('**','').replace('\x60','')
    return ' '.join(text.split())

def voices(sid,cursor=None):
    file=transcript(sid);items=[];views=[]
    if not file:return dict(session=sid,transcript=None,items=[],views=[],reset=True,cursor=None)
    stat=os.stat(file)
    reset=not isinstance(cursor,dict) or cursor.get('inode')!=stat.st_ino or not isinstance(cursor.get('offset'),int) or not 0<=cursor['offset']<=stat.st_size
    offset=max(0,stat.st_size-4*1024*1024) if reset else cursor['offset']
    with open(file,'rb') as stream:
        stream.seek(offset)
        if reset and offset:stream.readline();offset=stream.tell()
        raw=stream.read(8*1024*1024)
    last=raw.rfind(b'\n')
    complete=raw[:last+1] if last>=0 else b''
    next_cursor=dict(inode=stat.st_ino,offset=offset+len(complete))
    for line in complete.splitlines():
        try:e=json.loads(line)
        except (ValueError,UnicodeDecodeError):continue
        if not isinstance(e,dict):continue
        message=e.get('message') or {}
        if not isinstance(message,dict):continue
        content=message.get('content',[]);ts=e.get('timestamp','')
        turn=message.get('id') or e.get('requestId') or e.get('uuid') or ts
        if e.get('type')=='user' and not e.get('isMeta') and isinstance(content,str) and content.strip() and not content.lstrip().startswith('<'):
            items.append(dict(ts=ts,text=content,you=True,id=str(turn)+':prompt'))
        if e.get('type')=='assistant' and isinstance(content,str):content=[dict(type='text',text=content)]
        if e.get('type')!='assistant' or not isinstance(content,list):continue
        bodies=[];speech_bodies=[];summaries=[]
        for index,block in enumerate(content):
            if not isinstance(block,dict) or block.get('type')!='text':continue
            text=block.get('text','');spoken=VOICE.findall(text);body=reply_text(text)
            if body:
                bodies.append(body);speech_bodies.append(re.sub(r'<view>.*?</view>','',VOICE.sub('',text),flags=re.S))
            summaries.extend(' '.join(value.split()) for value in spoken if value.strip())
            for value in VIEW.findall(text):
                if value.strip():views.append(dict(ts=ts,text=value.strip(),id=str(turn)+':view:'+str(index)))
        if bodies:items.append(dict(ts=ts,text=' '.join(bodies),speechText=' '.join(summaries) if summaries else '\n'.join(speech_bodies),turn=turn,source='early',hasVoice=bool(summaries),id=str(turn)+':reply'))
        elif summaries:items.append(dict(ts=ts,text=' '.join(summaries),turn=turn,source='voice',id=str(turn)+':voice'))
    return dict(session=sid,transcript=file,items=items[-200:],views=views[-30:],reset=reset,cursor=next_cursor)

def tmux_target(session):
    pid=session.get('pid')
    if not pid:return None
    try:rows=run(['tmux','list-panes','-a','-F','#{pane_id}\t#{pane_pid}\t#{session_id}\t#{window_id}']).splitlines()
    except RuntimeError:return None
    ancestors=set()
    for _ in range(80):
        if not pid or pid in ancestors:break
        ancestors.add(pid)
        try:pid=int(open('/proc/%s/stat'%pid).read().rsplit(')',1)[1].split()[1])
        except (OSError,ValueError):break
    for row in rows:
        parts=row.split('\t')
        if len(parts)==4 and int(parts[1]) in ancestors:return parts
    return None
def prepare(cwd,sid,yolo=False):
    session=next((row for row in listing(cwd) if row['sessionId']==sid),None)
    if not session:raise RuntimeError('This session is not in the current working directory. Refresh the list.')
    cli=os.environ.get('CLAUDE_AGENTS_CLI','claude')
    if session.get('kind')=='background':return dict(session=session,argv=[cli,'attach',session['id']])
    if session.get('live'):
        target=tmux_target(session)
        if not target:raise RuntimeError('This session is already running in another terminal and cannot be attached. Open its original terminal; a duplicate session was prevented.')
        pane,_,source,window=target;group='claude-vscode-'+sid[:8]
        try:run(['tmux','has-session','-t',group])
        except RuntimeError:run(['tmux','new-session','-d','-s',group,'-t',source])
        run(['tmux','select-window','-t',group+':'+window])
        return dict(session=session,argv=['tmux','attach-session','-t',group],pane=pane)
    return dict(session=session,argv=[cli,'--resume',sid]+(['--dangerously-skip-permissions'] if yolo else []))
def delete_session(cwd,sid):
    if not UUID.fullmatch(sid):raise ValueError('Invalid Claude session ID')
    session=next((row for row in listing(cwd) if row['sessionId']==sid),None)
    if not session:raise RuntimeError('This session is not in the current working directory.')
    if session.get('live') or process_alive(metadata(sid)):raise RuntimeError('Stop this running Claude session before deleting it.')
    if session.get('kind')=='background':run([os.environ.get('CLAUDE_AGENTS_CLI','claude'),'rm',session['id']],cwd)
    for item in saved_sessions(cwd):
        if item['sessionId']!=sid:continue
        file=item['transcript'];os.unlink(file)
        directory=os.path.join(os.path.dirname(file),sid)
        if os.path.isdir(directory) and not os.path.islink(directory):shutil.rmtree(directory)
    return dict(deleted=True)

def process_alive(session):
    try:
        stat=open('/proc/%s/stat'%int(session['pid'])).read().rsplit(')',1)[1].split()
        return stat[0]!='Z' and stat[19]==str(session['procStart'])
    except (OSError,KeyError,ValueError,TypeError):return False
# A background session keeps its own saved options; resuming it with new flags starts a copy (new id, no name).
# So the mode goes into its saved options and it is resumed without flags: same session, id and name.
def saved_job(sid,home=None):
    jobs=os.path.join(home or os.path.expanduser('~'),'.claude','jobs');found=[]
    for job in (os.listdir(jobs) if os.path.isdir(jobs) else []):
        path=os.path.join(jobs,job,'state.json')
        try:
            with open(path) as stream:state=json.load(stream)
        except (OSError,ValueError):continue
        if isinstance(state,dict) and state.get('sessionId')==sid:found.append((os.path.getmtime(path),path,state))
    return max(found,key=lambda item:item[0])[1:] if found else (None,None)
def save_yolo(path,state,name=''):
    flags=list(state.get('respawnFlags') or []);out=[];skip=False
    for index,flag in enumerate(flags):
        if skip:skip=False;continue
        if flag=='--permission-mode':skip=True;continue
        if flag.startswith('--permission-mode='):continue
        out.append(flag)
    if '--dangerously-skip-permissions' not in out:out.append('--dangerously-skip-permissions')
    name=state.get('name') or name
    if name and '--name' not in out:out+=['--name',name]
    state['respawnFlags']=out;temp=path+'.agl-tmp'
    with open(temp,'w') as stream:json.dump(state,stream)
    os.replace(temp,path)
    return out
def restart_yolo(cwd,sid):
    session=next((row for row in listing(cwd) if row['sessionId']==sid),None)
    if not session:raise RuntimeError('This session is not in the current working directory. Refresh the list.')
    cli=os.environ.get('CLAUDE_AGENTS_CLI','claude')
    if session.get('live') and session.get('kind')=='background':
        # `claude stop` can return before the session has fully stopped; resuming it then starts a copy with a new id, an auto
        # name and no saved options (auth-lead, 2026-11-09: the copy appeared 0.8 s after the stop). Wait until Claude Code
        # no longer reports a status for it.
        run([cli,'stop',session['id']],cwd)
        for _ in range(120):
            if not any(row['sessionId']==sid and row.get('live') for row in listing(cwd)):break
            time.sleep(.5)
        else:raise RuntimeError('Claude has not stopped yet. Wait for it to stop before restarting; a copy was prevented.')
        time.sleep(1)
    elif session.get('live'):
        if not process_alive(session):raise RuntimeError('Cannot verify the running Claude process. Refresh before restarting.')
        os.kill(int(session['pid']),signal.SIGTERM)
        for _ in range(80):
            remaining=next((row for row in listing(cwd) if row['sessionId']==sid and row.get('live')),None)
            if not remaining:break
            time.sleep(.1)
        else:raise RuntimeError('Claude has not stopped yet. Wait for it to exit before restarting; a duplicate session was prevented.')
    path,state=saved_job(sid)
    if path:
        save_yolo(path,state,session.get('name') or '')
        said=run([cli,'--bg','--resume',sid],cwd,both=True)
        if 'copy' in said.lower():raise RuntimeError('Claude Code started a copy instead of resuming this session: '+said[:300])
    else:run([cli,'--bg','--resume',sid,'--dangerously-skip-permissions'],cwd)
    return dict(session={**session,'kind':'background','live':True,'state':'running'},argv=[cli,'attach',sid])
def main():
    action=sys.argv[1];cwd=sys.argv[2]
    if action=='list':result=listing(cwd)
    elif action=='managed-list':result=listing(cwd,json.loads(sys.argv[3]))
    elif action=='voices':result=voices(sys.argv[3],json.loads(sys.argv[4]) if len(sys.argv)>4 else None)
    elif action=='prepare':result=prepare(cwd,sys.argv[3],len(sys.argv)>4 and sys.argv[4]=='true')
    elif action=='delete':result=delete_session(cwd,sys.argv[3])
    elif action=='restart-yolo':result=restart_yolo(cwd,sys.argv[3])
    elif action=='new':
        import uuid
        sid=str(uuid.uuid4());name=sys.argv[3]
        run([os.environ.get('CLAUDE_AGENTS_CLI','claude'),'--bg','--session-id',sid]+(['--dangerously-skip-permissions'] if len(sys.argv)>4 and sys.argv[4]=='true' else [])+(['--name',name] if name else []),cwd)
        result=dict(session=dict(sessionId=sid,id=sid[:8],name=name,cwd=cwd,kind='background',live=True),argv=[os.environ.get('CLAUDE_AGENTS_CLI','claude'),'attach',sid[:8]])
    else:raise ValueError('Unknown session action')
    print(json.dumps(result))
if __name__=='__main__':
    try:main()
    except Exception as error:print(str(error),file=sys.stderr);sys.exit(1)
