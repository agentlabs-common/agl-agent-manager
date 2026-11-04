const{test}=require('node:test');const assert=require('node:assert/strict');const{execFile}=require('node:child_process');const{promisify}=require('node:util');const path=require('node:path');const run=promisify(execFile);
test('Gemini transcription flushes without turn-complete, preserves repeats, and separates input from readout',async()=>{const code=String.raw`import importlib.util
spec=importlib.util.spec_from_file_location('live','live.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
b=m.Utterances();b.add('Please check ',now=1);b.add('the folder.',now=1.1)
assert b.flush(now=1.5) is None
assert b.flush(now=1.8)=='Please check the folder.'
assert b.flush(now=2) is None
b.add('yes',now=3);assert b.flush(now=3.7)=='yes'
b.add('yes',now=5);assert b.flush(now=5.7)=='yes'
b.preview('unfinished',now=7);assert b.flush(now=8) is None;assert b.flush(force=True,now=8)=='unfinished'
source=m.setup('gemini-3.5-transcribe-live')['setup'];speaker=m.setup('gemini-3.8-live',True)['setup']
assert source['generationConfig']['responseModalities']==['TEXT']
assert speaker['generationConfig']['responseModalities']==['AUDIO']
assert 'inputAudioTranscription' in source and 'systemInstruction' not in source
assert 'speech renderer' in speaker['systemInstruction']['parts'][0]['text']
print('Gemini buffering checks passed')`;const r=await run('python3',['-c',code],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});

test('stopping paused audio terminates its player and ignores cancelled output writes',async()=>{const r=await run('python3',['-c',"import asyncio,importlib.util,signal,types\nspec=importlib.util.spec_from_file_location('live','live.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nasync def check():\n b=object.__new__(m.Bridge);events=[]\n class Player:\n  returncode=None\n  def send_signal(self,sig):events.append(sig)\n  def terminate(self):events.append('terminate')\n  async def wait(self):self.returncode=0;events.append('wait')\n b.player=Player();await b.halt_playback();assert b.player is None;assert events==[signal.SIGCONT,'terminate','wait']\n b.playback=asyncio.Event();b.playback.set();b.drop=False;b.options=types.SimpleNamespace(output=None);b.deadline=0\n class Pipe:\n  def write(self,data):b.drop=True;raise BrokenPipeError()\n  async def drain(self):pass\n p=Player();p.stdin=Pipe();b.player=p\n await b.play(b'cancelled audio')\nasyncio.run(check());print('Audio cancellation checks passed')"],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});

test('secure Gemini key takes precedence and removing it restores environment fallback',async()=>{const r=await run('python3',['-c',"import os,live\nos.environ['GEMINI_API_KEY']='environment-test-key'\nos.environ['CLAUDE_AGENTS_GEMINI_KEY']='secure-test-key'\nos.environ['CLAUDE_AGENTS_KEYS']='/dev/null'\nassert live.settings()['GEMINI_API_KEY']=='secure-test-key'\ndel os.environ['CLAUDE_AGENTS_GEMINI_KEY']\nassert live.settings()['GEMINI_API_KEY']=='environment-test-key'\nprint('Secure key precedence checks passed')"],{cwd:path.join(__dirname,'..')});assert.match(r.stdout,/checks passed/);});
