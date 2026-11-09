#!/usr/bin/env python3
"""Conversational Gemini Live prompt editing for Claude and Codex."""
import argparse,asyncio,base64,difflib,inspect,json,os,re,shlex,signal,struct,sys,time
ENDPOINT='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

LOG=os.environ.get('AGL_LIVE_LOG') or os.path.expanduser('~/.cache/agl-agent-manager/live.log')
def log(kind,values):
    if kind=='partial':return
    try:
        os.makedirs(os.path.dirname(LOG),exist_ok=True)
        if os.path.exists(LOG) and os.path.getsize(LOG)>2*1024*1024:os.replace(LOG,LOG+'.1')
        with open(LOG,'a') as stream:stream.write(json.dumps(dict(at=time.strftime('%Y-%m-%dT%H:%M:%S'),type=kind,**values),ensure_ascii=False)+'\n')
    except OSError:pass
def emit(kind,**values):
    log(kind,values)
    print(json.dumps(dict(type=kind,**values),ensure_ascii=False),flush=True)

def settings():
    result={key:os.environ.get(key,'') for key in ('GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_LIVE_MODEL','GEMINI_TRANSCRIBE_MODEL','GEMINI_LIVE_VOICE','GEMINI_TTS_MODEL','GEMINI_TTS_VOICE')}
    if os.environ.get('CLAUDE_AGENTS_GEMINI_KEY'):result['GEMINI_API_KEY']=os.environ['CLAUDE_AGENTS_GEMINI_KEY']
    file=os.environ.get('CLAUDE_AGENTS_KEYS',os.path.expanduser('~/.config/agentlabs/keys.env'))
    try:
        for line in open(file):
            parts=shlex.split(line,comments=True)
            if parts and parts[0]=='export':parts=parts[1:]
            if len(parts)!=1 or '=' not in parts[0]:continue
            key,value=parts[0].split('=',1)
            if key in result and not result[key]:result[key]=value
    except FileNotFoundError:pass
    if not (result['GEMINI_API_KEY'] or result['GOOGLE_API_KEY']):raise RuntimeError('No Gemini API key. Run the command AGL Agent Manager: Configure Gemini Voice (or set GEMINI_API_KEY, or add it to ~/.config/agentlabs/keys.env).')
    return result

def filler_only(text):
    value=' '.join(text.lower().strip(' .,!?:;').split())
    return value in {'right','or rather','rather','this time','sometimes','um','uh','let me think'}

def words(text):
    return re.findall(r"\w+(?:['’]\w+)*",text.casefold().replace('’',"'"))
def cleanup_only(original,candidate):
    before=words(original);after=words(candidate)
    if not after:return original
    for action,a,b,c,d in difflib.SequenceMatcher(a=before,b=after,autojunk=False).get_opcodes():
        if action=='equal':continue
        if action!='delete':return original
        removed=before[a:b];size=len(removed)
        if all(word in {'um','uh','erm','er'} for word in removed):continue
        if before[max(0,a-size):a]==removed or before[b:b+size]==removed:continue
        return original
    literals=re.finditer(r'(?:https?://|file://|(?:~|\.\.?)?/|[A-Za-z]:\\)\S+|\x60([^\x60]+)\x60',original)
    for match in literals:
        literal=match.group(1) or match.group(0)
        if literal not in candidate:return original
    for number in re.findall(r'\b\d+(?:[.,]\d+)*\b',original):
        if candidate.count(number)<original.count(number):return original
    return candidate.strip()
def append_transcript(current,delta):
    if current and delta.startswith(current):return delta
    separator=' ' if current and delta and current[-1].isalnum() and delta[0].isalnum() else ''
    return current+separator+delta

CONFIRM_WORDS={'yes','yeah','yep','ok','okay','sure','send','it','that','go','ahead','please','do'}
TOOLS=[dict(name='submit_prompt',description='Send a finished dictation to the coding agent. Wait when the thought is unfinished.',parameters=dict(type='OBJECT',properties=dict(text=dict(type='STRING',description='Complete original dictation, removing only redundant repetitions and preserving every requested item.')),required=['text'])),
  dict(name='stop_reading',description='Stop reading aloud right now, when the user says stop, quiet, enough or similar.'),
  dict(name='read_again',description='Read the latest agent reply aloud again, when the user asks to hear it again.'),
  dict(name='interrupt_agent',description='Interrupt the coding agent mid-task, when the user says stop the agent, interrupt it or similar.'),
  dict(name='cancel_dictation',description='Discard the dictation in progress, when the user says cancel, scratch that or never mind.')]
def setup(model='gemini-3.8-live',pause=3,refine=True,handle=None,voice=''):
    instruction=('You are the user\'s voice companion for a coding agent. You are not the coding agent: never do its work, write code, or make up results. '
      'DICTATION: when the user speaks a request for the agent, keep listening through thinking pauses, fillers such as right, and self-corrections such as or rather. '
      'Use the context to decide when the user has finished a complete thought. If clearly unfinished, stay silent and wait. '
      'Call submit_prompt for every finished dictation, including short commands, acknowledgements such as yes or continue, questions meant for the agent, fragments, and lists. Include every requested item in a single call. Never submit a filler on its own. '
      'If you genuinely cannot tell whether the user wants it sent, ask only: Send that? Then call submit_prompt with the full dictation if they agree, or cancel_dictation if they decline. '
      'Preserve intent, names, technical terms, identifiers, paths, numbers, constraints, and the original language. '
      'Do not add requirements, omit any requested item, summarize, paraphrase, reorder, or invent missing information. Do not repeat a previously submitted prompt. '
      'COMMANDS: call stop_reading for stop, quiet or enough; read_again to hear the last reply again; interrupt_agent to stop the agent working; cancel_dictation for cancel, scratch that or never mind. Do not submit these. '
      'QUESTIONS TO YOU: if the user asks you about what the agent said or did, answer in one or two short sentences from the AGENT REPLY messages only, and do not submit it. If the answer is not there, say so. '
      'AGENT REPLY messages: read the text aloud word for word in a natural voice, then stop and listen. Never call submit_prompt for them and never comment on them. '
      'Otherwise stay silent. Keep anything you say short. '
      'CONTROL messages are UI instructions, never part of the dictation. CONTROL SEND NOW explicitly ends the current dictation. ')
    instruction+=('Remove only exact redundant repetitions and hesitation sounds such as um and uh. Keep every distinct word and instruction, including the full wording of self-corrections. Do not rewrite grammar or choose which request to keep. Punctuation is allowed. ' if refine else 'Keep the original words; add punctuation only. ')
    generation=dict(responseModalities=['AUDIO'])
    if voice:generation['speechConfig']=dict(voiceConfig=dict(prebuiltVoiceConfig=dict(voiceName=voice)))
    return dict(setup=dict(model='models/'+model,generationConfig=generation,
      systemInstruction=dict(parts=[dict(text=instruction)]),inputAudioTranscription={},outputAudioTranscription={},
      realtimeInputConfig=dict(automaticActivityDetection=dict(endOfSpeechSensitivity='END_SENSITIVITY_LOW',silenceDurationMs=round(pause*1000))),
      sessionResumption=dict(handle=handle) if handle else {},
      tools=[dict(functionDeclarations=TOOLS)]))

def strip_confirmation(text):
    parts=text.rstrip(' .!?,').split();cut=len(parts)
    while cut and parts[cut-1].lower().strip('.,!?') in CONFIRM_WORDS:cut-=1
    return ' '.join(parts[:cut]) if cut<len(parts) else text

class Bridge:
    def __init__(self,options):
        self.options=options;self.config=settings();self.stop=asyncio.Event();self.submitted=asyncio.Event();self.recorder=None;self.socket=None
        self.last_activity=time.monotonic();self.idle_expired=False
        self.muted=False;self.external_speech=False;self.raw_text='';self.handled=set();self.force=False;self.force_at=0;self.pending_calls={};self.inflight={};self.transcript_at=0;self.last_voice=0;self.submitted_voice=-1;self.resume_handle=None;self.go_away=False;self.reconnecting=False;self.reconnects=0;self.held_text='';self.held_at=0;self.model_spoke=False;self.player=None;self.playing_until=0;self.audio_bytes=0
        self.model=options.model or self.config['GOOGLE_LIVE_MODEL'] or 'gemini-3.8-live'
    async def connect(self):
        try:import websockets
        except ImportError:raise RuntimeError('Gemini Live needs the Python package websockets. Run: python3 -m venv ~/.venvs/tts && ~/.venvs/tts/bin/pip install websockets (or set AGL Agent Manager: Voice Python to a Python that has it).') from None
        header='additional_headers' if 'additional_headers' in inspect.signature(websockets.connect).parameters else 'extra_headers'
        key=self.config['GEMINI_API_KEY'] or self.config['GOOGLE_API_KEY']
        socket=await websockets.connect(ENDPOINT,**{header:{'x-goog-api-key':key}},max_size=16*1024*1024,open_timeout=15,ping_interval=20)
        try:
            await socket.send(json.dumps(setup(self.model,self.options.pause,not self.options.verbatim,self.resume_handle,self.config.get('GEMINI_LIVE_VOICE',''))))
            while True:
                message=json.loads(await asyncio.wait_for(socket.recv(),15))
                if 'error' in message:raise RuntimeError(message['error'].get('message','Gemini Live setup failed'))
                if 'setupComplete' in message:return socket
        except BaseException:
            await socket.close();raise
    async def audio(self):
        if self.options.self_test:
            raw=open(self.options.self_test,'rb').read()
            for at in range(0,len(raw),640):
                await self.send_audio(raw[at:at+640]);await asyncio.sleep(.02)
            await self.socket.send(json.dumps(dict(realtimeInput=dict(audioStreamEnd=True))))
            return
        self.recorder=await asyncio.create_subprocess_exec('arecord','-q','-t','raw','-f','S16_LE','-r','16000','-c','1',stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
        while not self.stop.is_set():
            data=await self.recorder.stdout.read(640)
            if not data:raise RuntimeError((await self.recorder.stderr.read()).decode(errors='replace').strip() or 'The microphone stopped delivering audio.')
            if self.muted or ((self.external_speech or time.monotonic()<self.playing_until+.3) and not self.options.barge_in):data=bytes(len(data))
            await self.send_audio(data)
    async def idle_disconnect(self):
        while not self.stop.is_set():
            await asyncio.sleep(.1)
            if time.monotonic()-self.last_activity>=180:
                self.idle_expired=True;emit('status',state='disconnected',idle=True,reason='Disconnected after 3 minutes of inactivity.',draft='\n'.join([item['original'] for item in self.inflight.values()]+([self.raw_text.strip()] if self.raw_text.strip() else [])))
                self.stop.set();return
    async def send_audio(self,data):
        samples=struct.unpack('<'+'h'*(len(data)//2),data)
        if samples and sum(value*value for value in samples)/len(samples)>500**2:self.last_activity=self.last_voice=time.monotonic()
        try:await self.socket.send(json.dumps(dict(realtimeInput=dict(audio=dict(mimeType='audio/pcm;rate=16000',data=base64.b64encode(data).decode())))))
        except Exception:
            if not self.reconnecting:raise
    async def play(self,chunk):
        self.audio_bytes+=len(chunk);now=time.monotonic();self.playing_until=max(now,self.playing_until)+len(chunk)/48000
        if self.options.self_test:return
        try:
            if self.player is None or self.player.returncode is not None:self.player=await asyncio.create_subprocess_exec('aplay','-q','-t','raw','-f','S16_LE','-r','24000','-c','1',stdin=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.DEVNULL)
            self.player.stdin.write(chunk);await self.player.stdin.drain()
        except (OSError,ConnectionError):self.player=None
    def stop_playing(self):
        self.playing_until=0
        if self.player and self.player.returncode is None:
            try:self.player.kill()
            except ProcessLookupError:pass
        self.player=None
    async def respond(self,calls,accepted,reason=''):
        if calls:await self.socket.send(json.dumps(dict(toolResponse=dict(functionResponses=[dict(id=call.get('id'),name=call.get('name'),response=dict(accepted=accepted,reason=reason,instruction='Listen for the next dictation. Do not repeat submitted text.')) for call in calls]))))
    def stage(self,text,original,submission_id,forced=False):
        self.inflight[submission_id]=dict(text=text,original=original);self.submitted_voice=self.last_voice
        emit('utterance',submissionId=submission_id,text=text,original=original,refined=text!=original,forced=forced)
        self.raw_text='';self.held_text='';self.force=False;self.submitted.set();self.last_activity=time.monotonic()
    async def flush_pending(self,now=None):
        now=time.monotonic() if now is None else now
        if self.force and self.raw_text.strip() and now-self.transcript_at>=.35:
            calls=[entry['call'] for entry in self.pending_calls.values()];self.pending_calls.clear()
            original=self.raw_text.strip();text=original
            if not self.options.verbatim:
                for call in calls:text=min((text,cleanup_only(original,call.get('args',{}).get('text',''))),key=len)
            submission_id=calls[0]['id'] if calls else 'manual-'+str(time.monotonic_ns())
            self.handled.update(call['id'] for call in calls);self.stage(text,original,submission_id,True);await self.respond(calls,True);return
        if self.force and now-self.force_at>5:
            self.force=False;emit('notice',message='No dictation captured yet. Keep speaking or try Send now again.')
        if not self.pending_calls:
            # Gemini decides turns, but must not hold a finished dictation forever.
            text=self.raw_text.strip()
            if self.held_text and now-self.held_at>60:self.held_text=''
            if text and not filler_only(text) and not self.model_spoke and now-self.last_voice>=self.options.pause+1.5 and now-self.transcript_at>=self.options.pause:
                self.stage(text,text,'silence-'+str(time.monotonic_ns()))
            return
        oldest=min(entry['at'] for entry in self.pending_calls.values())
        if now-oldest<.75 or now-self.transcript_at<.4 or now-self.last_voice<self.options.pause:return
        calls=[entry['call'] for entry in self.pending_calls.values()]
        original=self.raw_text.strip()
        if self.held_text and calls:
            joined=strip_confirmation((self.held_text+' '+original).strip())
            if any(cleanup_only(joined,call['args']['text'])==call['args']['text'].strip() or joined==call['args']['text'].strip() for call in calls):original=joined
        if not original:
            if now-oldest<3:return
            text='\n'.join(call['args']['text'] for call in calls)
            self.pending_calls.clear();self.handled.update(call['id'] for call in calls)
            emit('draft',text=text,reason='Transcription was delayed. Dictation is kept as a draft for review.');await self.respond(calls,False,'Saved as a draft because the transcript is unavailable.');return
        self.pending_calls.clear();self.handled.update(call['id'] for call in calls)
        if filler_only(original):await self.respond(calls,False,'Still listening for the rest of the thought.');return
        text=original
        if not self.options.verbatim:
            for call in calls:text=min((text,cleanup_only(original,call['args']['text'])),key=len)
        self.stage(text,original,calls[0]['id']);await self.respond(calls,True)
    async def submission_loop(self):
        while not self.stop.is_set():await asyncio.sleep(.05);await self.flush_pending()
    async def handle(self,message):
        if 'error' in message:raise RuntimeError(message['error'].get('message','Gemini Live failed'))
        if message.get('voiceActivity',{}).get('type')=='ACTIVITY_START':
            self.last_voice=self.last_activity=time.monotonic()
            if self.external_speech and self.options.barge_in:emit('barge_in')
        update=message.get('sessionResumptionUpdate')
        if update and update.get('resumable') and update.get('newHandle'):self.resume_handle=update['newHandle']
        if 'goAway' in message:self.go_away=True
        content=message.get('serverContent',{})
        transcript=content.get('inputTranscription',{}).get('text','')
        if transcript:
            self.last_activity=self.transcript_at=time.monotonic()
            self.raw_text=append_transcript(self.raw_text,transcript);self.reconnects=0;emit('partial',text=self.raw_text);emit('status',state='listening')
        if content.get('interrupted'):self.stop_playing();emit('status',state='listening')
        for part in (content.get('modelTurn') or {}).get('parts',[]):
            data=(part.get('inlineData') or {}).get('data')
            if data:
                if not self.model_spoke:emit('status',state='speaking')
                self.model_spoke=True;await self.play(base64.b64decode(data))
        if content.get('outputTranscription',{}).get('text'):self.model_spoke=True
        for call in message.get('toolCall',{}).get('functionCalls',[]):
            args=call.get('args',{});text=args.get('text') if isinstance(args,dict) else None;call_id=call.get('id')
            if call_id in self.handled:await self.respond([call],False,'Already handled.');continue
            name=call.get('name')
            if name in ('stop_reading','read_again','interrupt_agent','cancel_dictation'):
                self.handled.add(call_id)
                if name=='stop_reading':self.stop_playing()
                if name=='cancel_dictation':self.raw_text='';self.held_text='';self.pending_calls.clear();emit('partial',text='')
                emit('control',action=name);await self.respond([call],True);continue
            if not self.raw_text.strip() and self.submitted_voice>=0 and self.last_voice<=self.submitted_voice:
                self.handled.add(call_id);await self.respond([call],True,'This dictation was already submitted.');continue
            if call.get('name')!='submit_prompt' or not isinstance(text,str) or not text.strip() or len(text)>32000:
                await self.respond([call],False,'Expected a complete prompt of up to 32000 characters.');continue
            self.pending_calls[call_id]=dict(call=call,at=time.monotonic())
        for call_id in message.get('toolCallCancellation',{}).get('ids',[]):self.pending_calls.pop(call_id,None)
        if content.get('turnComplete'):
            # Gemini answered or asked 'Send that?': hold the words so the silence fallback does not send them.
            if self.model_spoke and self.raw_text.strip() and not self.pending_calls:
                self.held_text=(self.held_text+' '+self.raw_text.strip()).strip();self.held_at=time.monotonic();self.raw_text='';emit('partial',text='')
            self.model_spoke=False
            emit('status',state='muted' if self.muted else 'listening')
    async def receive(self):
        while not self.stop.is_set():
            try:
                async for raw in self.socket:
                    await self.handle(json.loads(raw))
                    if self.go_away:break
            except Exception as error:
                if self.stop.is_set() or type(error).__name__ not in ('ConnectionClosed','ConnectionClosedError','ConnectionClosedOK'):raise
            if self.stop.is_set():return
            if not self.resume_handle or self.reconnects>=3:raise RuntimeError('Gemini Live connection closed. Reconnect to continue.')
            self.reconnects+=1;self.go_away=False;self.reconnecting=True;old=self.socket;emit('status',state='connecting',reason='Resuming Gemini Live session.')
            try:self.socket=await self.connect()
            finally:self.reconnecting=False
            await old.close();emit('status',state='listening');emit('notice',message='Gemini Live session resumed.')
    async def controls(self):
        reader=asyncio.StreamReader();protocol=asyncio.StreamReaderProtocol(reader)
        await asyncio.get_running_loop().connect_read_pipe(lambda:protocol,sys.stdin)
        while not self.stop.is_set():
            line=await reader.readline()
            if not line:self.stop.set();return
            try:message=json.loads(line)
            except ValueError:continue
            command=message.get('command')
            if command=='tts_active':self.external_speech=bool(message.get('on'))
            elif command=='say' and isinstance(message.get('text'),str) and message['text'].strip():
                await self.socket.send(json.dumps(dict(clientContent=dict(turns=[dict(role='user',parts=[dict(text='AGENT REPLY: '+message['text'].strip()[:6000])])],turnComplete=True))))
            elif command=='stop_audio':self.stop_playing()
            elif command=='mute':self.muted=bool(message.get('on'));emit('status',state='muted' if self.muted else 'listening')
            elif command=='delivered':self.inflight.pop(message.get('submissionId'),None)
            elif command=='send':
                self.force=True;self.force_at=time.monotonic()
                if not self.raw_text.strip():
                    await self.socket.send(json.dumps(dict(clientContent=dict(turns=[dict(role='user',parts=[dict(text='CONTROL SEND NOW: submit the current complete dictation with submit_prompt. Do not include this control message.')])],turnComplete=True))))
            elif command=='stop':self.stop.set();return
    async def test_finish(self):
        await asyncio.wait_for(self.submitted.wait(),30);self.stop.set()
    async def run(self):
        tasks=[]
        try:
            self.socket=await self.connect()
            self.last_activity=time.monotonic()
            emit('ready',state='listening',inputModel=self.model,voiceModel='Gemini Live',pauseSeconds=self.options.pause)
            tasks=[asyncio.create_task(self.audio()),asyncio.create_task(self.receive()),asyncio.create_task(self.submission_loop())]
            if not self.options.self_test:tasks.append(asyncio.create_task(self.idle_disconnect()))
            tasks.append(asyncio.create_task(self.test_finish() if self.options.self_test else self.controls()))
            stopper=asyncio.create_task(self.stop.wait());tasks.append(stopper)
            while True:
                done,_=await asyncio.wait(tasks,return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    if task is stopper:return
                    error=task.exception()
                    if error:raise error
                    tasks.remove(task)
        finally:
            for task in tasks:task.cancel()
            await asyncio.gather(*tasks,return_exceptions=True)
            self.stop_playing()
            if self.socket is not None and hasattr(self.socket,'close'):
                try:await self.socket.close()
                except Exception:pass
            if self.recorder and self.recorder.returncode is None:
                self.recorder.terminate()
                try:await asyncio.wait_for(self.recorder.wait(),2)
                except asyncio.TimeoutError:self.recorder.kill();await self.recorder.wait()

def arguments():
    parser=argparse.ArgumentParser();parser.add_argument('--model');parser.add_argument('--pause',type=float,default=3);parser.add_argument('--verbatim',action='store_true');parser.add_argument('--barge-in',action='store_true');parser.add_argument('--self-test');options=parser.parse_args()
    if not 1<=options.pause<=10:parser.error('--pause must be between 1 and 10 seconds')
    return options
async def main():
    bridge=None
    try:
        bridge=Bridge(arguments());loop=asyncio.get_running_loop()
        for sig in (signal.SIGTERM,signal.SIGINT):loop.add_signal_handler(sig,bridge.stop.set)
        await bridge.run();return 0
    except Exception as error:emit('error',message=str(error) or type(error).__name__);return 1
    finally:emit('status',state='disconnected')
if __name__=='__main__':sys.exit(asyncio.run(main()))
