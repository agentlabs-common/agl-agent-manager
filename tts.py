#!/usr/bin/env python3
"""Stream Gemini TTS over REST without opening a microphone or Live session."""
import argparse,base64,json,os,subprocess,sys,time,urllib.error,urllib.request,urllib.parse
from pathlib import Path
from live import settings

def request_body(text,model,voice,style=''):
    content=dict(type='text',text=text)
    if style:content['annotations']=[dict(type='speech_metadata',style=style)]
    return dict(model=model,input=[dict(type='user_input',content=[content])],response_format=dict(type='audio',mime_type='audio/l16',sample_rate=24000),generation_config=dict(speech_config=[dict(voice=voice)]),stream=True,store=False)

def list_voices(key,language='',gender='',accent=''):
    query={name:value for name,value in [('language_code',language),('gender',gender),('accent',accent)] if value}
    query['page_size']=1000;voices=[];tokens=set()
    while True:
        request=urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/voices?'+urllib.parse.urlencode(query),headers={'x-goog-api-key':key})
        with urllib.request.urlopen(request,timeout=20) as response:page=json.load(response)
        voices.extend(page.get('voices',[]));token=page.get('next_page_token') or page.get('nextPageToken')
        if not token or token in tokens:return voices
        tokens.add(token);query['page_token']=token

def events(response):
    data=[]
    for raw in response:
        line=raw.decode('utf-8').rstrip('\r\n')
        if line.startswith('data:'):data.append(line[5:].lstrip())
        elif not line and data:
            value='\n'.join(data);data=[]
            if value!='[DONE]':yield json.loads(value)
    if data and data!=['[DONE]']:yield json.loads('\n'.join(data))

def audio_chunk(event):
    if event.get('event_type') in ('error','interaction.failed') or 'error' in event:
        raise RuntimeError(event.get('error',{}).get('message') or 'Gemini TTS generation failed.')
    delta=event.get('delta',{})
    if delta.get('type')=='audio' and delta.get('data'):return base64.b64decode(delta['data'])
    return b''

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');parser.add_argument('--list-voices',action='store_true');parser.add_argument('--language',default='');parser.add_argument('--gender',default='');parser.add_argument('--accent',default='');parser.add_argument('--output');parser.add_argument('--state-dir');parser.add_argument('text',nargs='?');args=parser.parse_args()
    state_dir=Path(args.state_dir) if args.state_dir else None
    def state(value):
        if state_dir:(state_dir/'speech.state').write_text(value)
    player=None;sink=None;started=time.monotonic();total=0
    try:
        config=settings();key=config['GEMINI_API_KEY'] or config['GOOGLE_API_KEY']
        if args.check:return 0
        if args.list_voices:
            print(json.dumps(dict(voices=list_voices(key,args.language,args.gender,args.accent)),ensure_ascii=False));return 0
        if not args.text or not args.text.strip():raise ValueError('Enter text to read aloud.')
        model=config.get('GEMINI_TTS_MODEL') or 'gemini-3.8-flash-tts';voice=config.get('GEMINI_TTS_VOICE') or 'Aoede'
        body=json.dumps(request_body(args.text,model,voice,os.environ.get('GEMINI_TTS_STYLE',''))).encode()
        request=urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/interactions',data=body,headers={'x-goog-api-key':key,'Content-Type':'application/json','Accept':'text/event-stream'})
        state('generating · Gemini TTS')
        with urllib.request.urlopen(request,timeout=45) as response:
            for event in events(response):
                chunk=audio_chunk(event)
                if not chunk:continue
                if not total:
                    print(json.dumps(dict(first_audio_ms=round((time.monotonic()-started)*1000),model=model)),flush=True)
                    if args.output:sink=open(args.output,'wb')
                    else:player=subprocess.Popen(['aplay','-q','--buffer-time=80000','--period-time=20000','-t','raw','-f','S16_LE','-r','24000','-c','1'],stdin=subprocess.PIPE)
                    state('playing · Gemini TTS')
                (sink or player.stdin).write(chunk)
                if player:player.stdin.flush()
                total+=len(chunk)
        if not total:raise RuntimeError('Gemini TTS returned no audio.')
        if player:
            player.stdin.close()
            if player.wait():raise RuntimeError('The speech audio device could not play Gemini TTS.')
        print(json.dumps(dict(audio_bytes=total)),flush=True);state('idle');return 0
    except Exception as error:
        if isinstance(error,urllib.error.HTTPError):
            try:message=json.loads(error.read()).get('error',{}).get('message',str(error))
            except (ValueError,AttributeError):message=str(error)
        else:message=str(error)
        state('error: '+message);print('Gemini TTS: '+message,file=sys.stderr);return 1
    finally:
        if sink:sink.close()
        if player and player.poll() is None:player.terminate();player.wait()
if __name__=='__main__':sys.exit(main())
