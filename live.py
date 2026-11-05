#!/usr/bin/env python3
"""Conversational Gemini Live prompt editing for Claude and Codex."""
import argparse,asyncio,base64,inspect,json,os,shlex,signal,struct,sys,time
from contextlib import AsyncExitStack
ENDPOINT='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

def emit(kind,**values):
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
    if not (result['GEMINI_API_KEY'] or result['GOOGLE_API_KEY']):raise RuntimeError('Set GEMINI_API_KEY or add it to ~/.config/agentlabs/keys.env.')
    return result

def filler_only(text):
    value=' '.join(text.lower().strip(' .,!?:;').split())
    return value in {'right','or rather','rather','this time','sometimes','um','uh','let me think'}

def setup(model='gemini-3.8-live',pause=3,refine=True):
    instruction=('You are a voice prompt editor for a coding agent, not the coding agent. Listen to the user naturally. '
      'Do not answer requests or perform tasks. Do not acknowledge, explain, or speak back. '
      'Keep listening through thinking pauses, fillers such as right, and self-corrections such as or rather. '
      'Use the context to decide when the user has finished a complete thought. If clearly unfinished, stay silent and wait. '
      'Only then call submit_prompt with the complete current prompt. Never submit a filler on its own. '
      'Preserve intent, names, technical terms, identifiers, paths, numbers, constraints, and the original language. '
      'Do not add requirements or invent missing information. Do not repeat a previously submitted prompt. '
      'CONTROL messages are UI instructions, never part of the dictation. CONTROL SEND NOW explicitly ends the current dictation. ')
    instruction+=('Lightly polish punctuation and grammar, remove false starts, and incorporate the latest self-correction. ' if refine else 'Keep the original words; add punctuation only. ')
    return dict(setup=dict(model='models/'+model,generationConfig=dict(responseModalities=['AUDIO']),
      systemInstruction=dict(parts=[dict(text=instruction)]),inputAudioTranscription={},outputAudioTranscription={},
      realtimeInputConfig=dict(automaticActivityDetection=dict(endOfSpeechSensitivity='END_SENSITIVITY_LOW',silenceDurationMs=round(pause*1000))),
      tools=[dict(functionDeclarations=[dict(name='submit_prompt',description='Submit a complete user dictation to the coding agent. Wait when the thought is unfinished.',parameters=dict(type='OBJECT',properties=dict(text=dict(type='STRING',description='Complete prompt, preserving user meaning and technical details.')),required=['text']))])]))

class Bridge:
    def __init__(self,options):
        self.options=options;self.config=settings();self.stop=asyncio.Event();self.submitted=asyncio.Event();self.recorder=None;self.socket=None
        self.last_activity=time.monotonic();self.idle_expired=False
        self.muted=False;self.external_speech=False;self.raw_text='';self.handled=set();self.force=False
        self.model=options.model or self.config['GOOGLE_LIVE_MODEL'] or 'gemini-3.8-live'
    async def connect(self,stack):
        import websockets
        header='additional_headers' if 'additional_headers' in inspect.signature(websockets.connect).parameters else 'extra_headers'
        key=self.config['GEMINI_API_KEY'] or self.config['GOOGLE_API_KEY']
        socket=await stack.enter_async_context(websockets.connect(ENDPOINT,**{header:{'x-goog-api-key':key}},max_size=16*1024*1024,open_timeout=15,ping_interval=20))
        await socket.send(json.dumps(setup(self.model,self.options.pause,not self.options.verbatim)))
        while True:
            message=json.loads(await asyncio.wait_for(socket.recv(),15))
            if 'error' in message:raise RuntimeError(message['error'].get('message','Gemini Live setup failed'))
            if 'setupComplete' in message:return socket
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
            if self.muted or (self.external_speech and not self.options.barge_in):data=bytes(len(data))
            await self.send_audio(data)
    async def idle_disconnect(self):
        while not self.stop.is_set():
            await asyncio.sleep(.1)
            if time.monotonic()-self.last_activity>=180:
                self.idle_expired=True;emit('status',state='disconnected',idle=True,reason='Disconnected after 3 minutes of inactivity.',draft=self.raw_text.strip())
                self.stop.set();return
    async def send_audio(self,data):
        samples=struct.unpack('<'+'h'*(len(data)//2),data)
        if samples and sum(value*value for value in samples)/len(samples)>500**2:self.last_activity=time.monotonic()
        await self.socket.send(json.dumps(dict(realtimeInput=dict(audio=dict(mimeType='audio/pcm;rate=16000',data=base64.b64encode(data).decode())))))
    async def handle(self,message):
        if 'error' in message:raise RuntimeError(message['error'].get('message','Gemini Live failed'))
        content=message.get('serverContent',{})
        transcript=content.get('inputTranscription',{}).get('text','')
        if transcript:
            self.last_activity=time.monotonic()
            self.raw_text+=transcript;emit('partial',text=self.raw_text);emit('status',state='listening')
        if content.get('modelTurn') or content.get('outputTranscription'):emit('status',state='refining')
        responses=[]
        for call in message.get('toolCall',{}).get('functionCalls',[]):
            call_id=call.get('id');args=call.get('args',{});text=args.get('text') if isinstance(args,dict) else None
            accepted=False
            if call.get('name')=='submit_prompt' and call_id not in self.handled and isinstance(text,str) and text.strip() and len(text)<=32000 and self.raw_text.strip() and (self.force or not filler_only(self.raw_text)):
                self.handled.add(call_id);emit('utterance',text=text.strip(),original=self.raw_text.strip(),refined=not self.options.verbatim,forced=self.force)
                self.raw_text='';self.force=False;self.submitted.set();accepted=True;self.last_activity=time.monotonic()
            responses.append(dict(id=call_id,name=call.get('name'),response=dict(accepted=accepted,instruction='Listen silently for the next dictation. Do not repeat submitted text.')))
        if responses:await self.socket.send(json.dumps(dict(toolResponse=dict(functionResponses=responses))))
        if content.get('turnComplete'):emit('status',state='muted' if self.muted else 'listening')
    async def receive(self):
        async for raw in self.socket:await self.handle(json.loads(raw))
        if not self.stop.is_set():raise RuntimeError('Gemini Live connection closed. Reconnect to continue.')
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
            elif command=='mute':self.muted=bool(message.get('on'));emit('status',state='muted' if self.muted else 'listening')
            elif command=='send':
                self.force=True
                await self.socket.send(json.dumps(dict(clientContent=dict(turns=[dict(role='user',parts=[dict(text='CONTROL SEND NOW: submit the current complete dictation with submit_prompt. Do not include this control message.')])],turnComplete=True))))
            elif command=='stop':self.stop.set();return
    async def test_finish(self):
        await asyncio.wait_for(self.submitted.wait(),30);self.stop.set()
    async def run(self):
        tasks=[]
        try:
            async with AsyncExitStack() as stack:
                self.socket=await self.connect(stack)
                self.last_activity=time.monotonic()
                emit('ready',state='listening',inputModel=self.model,voiceModel='Gemini TTS',pauseSeconds=self.options.pause)
                tasks=[asyncio.create_task(self.audio()),asyncio.create_task(self.receive())]
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
