#!/usr/bin/env python3
"""Native Claude session discovery, also executable over SSH via stdin."""
import glob,json,os,re,signal,subprocess,sys,time
UUID=re.compile(r'^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$',re.I)
VOICE=re.compile(r'(?<!`)<voice>((?:(?!<voice>).)*?)</voice>',re.S)
VIEW=re.compile(r'^<view>[ \t]*\n(.*?)\n</view>[ \t]*$',re.S|re.M)
def run(args,cwd=None):
    env=dict(os.environ)
    for key in ('CLAUDECODE','HC_TERMINAL_ID','HC_SCOPE'):env.pop(key,None)
    env['PATH']=os.path.expanduser('~/.local/bin')+os.pathsep+env.get('PATH','')
    p=subprocess.run(args,cwd=cwd,env=env,capture_output=True,text=True)
    if p.returncode:raise RuntimeError(p.stderr.strip() or p.stdout.strip() or 'Command failed')
    return p.stdout.strip()
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
def listing(cwd):
    root=os.path.realpath(cwd)
    rows=json.loads(run([os.environ.get('CLAUDE_AGENTS_CLI','claude'),'agents','--json','--all','--cwd',root],root))
    out=[]
    for item in rows:
        if os.path.realpath(item.get('cwd',''))!=root:continue
        sid=item.get('sessionId','')
        if not UUID.fullmatch(sid):continue
        meta=metadata(sid)
        item.update(pid=meta.get('pid'),procStart=meta.get('procStart'),tmux=meta.get('tmux'),cwd=root)
        item['live']=item.get('kind')=='interactive' or item.get('state') not in ('failed','stopped','completed','exited')
        out.append(item)
    return out
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
        if bodies:items.append(dict(ts=ts,text=' '.join(bodies),speechText='\n'.join(speech_bodies),turn=turn,source='early',hasVoice=bool(summaries),id=str(turn)+':reply'))
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
def process_alive(session):
    try:
        stat=open('/proc/%s/stat'%int(session['pid'])).read().rsplit(')',1)[1].split()
        return stat[0]!='Z' and stat[19]==str(session['procStart'])
    except (OSError,KeyError,ValueError,TypeError):return False
def restart_yolo(cwd,sid):
    session=next((row for row in listing(cwd) if row['sessionId']==sid),None)
    if not session:raise RuntimeError('This session is not in the current working directory. Refresh the list.')
    cli=os.environ.get('CLAUDE_AGENTS_CLI','claude')
    if session.get('live'):
        if session.get('kind')=='background':run([cli,'stop',session['id']],cwd)
        else:
            if not process_alive(session):raise RuntimeError('Cannot verify the running Claude process. Refresh before restarting.')
            os.kill(int(session['pid']),signal.SIGTERM)
        for _ in range(80):
            remaining=next((row for row in listing(cwd) if row['sessionId']==sid and row.get('live')),None)
            if not remaining:break
            time.sleep(.1)
        else:raise RuntimeError('Claude has not stopped yet. Wait for it to exit before restarting; a duplicate session was prevented.')
    run([cli,'--bg','--resume',sid,'--dangerously-skip-permissions'],cwd)
    return dict(session={**session,'kind':'background','live':True,'state':'running'},argv=[cli,'attach',sid])
def main():
    action=sys.argv[1];cwd=sys.argv[2]
    if action=='list':result=listing(cwd)
    elif action=='voices':result=voices(sys.argv[3],json.loads(sys.argv[4]) if len(sys.argv)>4 else None)
    elif action=='prepare':result=prepare(cwd,sys.argv[3],len(sys.argv)>4 and sys.argv[4]=='true')
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
