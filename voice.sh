#!/usr/bin/env bash
# Independent speech playback and streaming dictation.
set -euo pipefail
operation=$1; dir=$2; shift 2
umask 077
mkdir -p "$dir"
conf="${CC_TTS_CONF:-$HOME/.claude/hooks/tts.conf}"
[ ! -f "$conf" ] || . "$conf"
venv="${CC_TTS_VENV:-$HOME/.venvs/tts}"
hooks="$HOME/.claude/hooks"
stop_record() {
 if [ -f "$dir/record.pid" ]; then kill -INT "$(cat "$dir/record.pid")" 2>/dev/null || true; rm -f "$dir/record.pid"; fi
 if [ -f "$dir/client.pid" ]; then
  pid=$(cat "$dir/client.pid")
  for _ in $(seq 1 60); do kill -0 "$pid" 2>/dev/null || break; sleep .1; done
  kill "$pid" 2>/dev/null || true;rm -f "$dir/client.pid"
 fi
 rm -f "$dir/audio.fifo"
}
case "$operation" in
 record)
  [ ! -f "$dir/record.pid" ] || { echo 'Dictation is already recording.' >&2;exit 1; }
  [ -n "${DEEPGRAM_API_KEY:-}${CC_STT_KEY:-}" ] || { echo 'Configure Deepgram in ~/.claude/hooks/tts.conf before dictating.' >&2;exit 1; }
  [ -x "$venv/bin/python" ] && [ -f "$hooks/stt-stream.py" ] || { echo 'Install the independent agentlabs-voice speech tools first.' >&2;exit 1; }
  command -v arecord >/dev/null || { echo 'Install arecord to use the microphone.' >&2;exit 1; }
  export DEEPGRAM_API_KEY CC_STT_KEY CC_STT_LANG CC_STT_ONLINE_MODEL CC_STT_KEYTERM_FILE CC_STT_HOST
  : > "$dir/live.txt";: > "$dir/live.txt.partial";: > "$dir/final.txt";rm -f "$dir/audio.fifo";mkfifo "$dir/audio.fifo"
  setsid "$venv/bin/python" "$hooks/stt-stream.py" --live "$dir/live.txt" < "$dir/audio.fifo" > "$dir/final.txt" 2> "$dir/record.err" & echo $! > "$dir/client.pid"
  setsid arecord -q -f S16_LE -r 16000 -c 1 > "$dir/audio.fifo" 2>> "$dir/record.err" & echo $! > "$dir/record.pid"
  printf '%s' "$dir" ;;
 finish) stop_record;tr '\n' ' ' < "$dir/final.txt" ;;
 cancel) stop_record;: > "$dir/live.txt" ;;
 play)
  [ ! -f "$dir/player.pid" ] || kill -CONT -- "-$(cat "$dir/player.pid")" 2>/dev/null || true
  [ ! -f "$dir/player.pid" ] || kill -- "-$(cat "$dir/player.pid")" 2>/dev/null || true
  python="${CLAUDE_AGENTS_VOICE_PYTHON:-python3}"
  command -v aplay >/dev/null || { echo 'Install aplay for Gemini TTS playback.' >&2;exit 1; }
  "$python" "$(dirname "$0")/tts.py" --check
  echo 'generating · Gemini TTS' > "$dir/speech.state"
  setsid "$python" "$(dirname "$0")/tts.py" --state-dir "$dir" "$1" > "$dir/play.log" 2>&1 & echo $! > "$dir/player.pid"
  rm -f "$dir/paused" ;;
 pause) [ ! -f "$dir/player.pid" ] || { kill -STOP -- "-$(cat "$dir/player.pid")" 2>/dev/null || true;: > "$dir/paused"; } ;;
 resume) [ ! -f "$dir/player.pid" ] || kill -CONT -- "-$(cat "$dir/player.pid")" 2>/dev/null || true;rm -f "$dir/paused" ;;
 stop) [ ! -f "$dir/player.pid" ] || { kill -CONT -- "-$(cat "$dir/player.pid")" 2>/dev/null || true;kill -- "-$(cat "$dir/player.pid")" 2>/dev/null || true; };rm -f "$dir/player.pid" "$dir/paused";echo idle > "$dir/speech.state" ;;
 state) if [ -f "$dir/player.pid" ] && kill -0 "$(cat "$dir/player.pid")" 2>/dev/null;then [ ! -f "$dir/paused" ] && cat "$dir/speech.state" || echo paused;elif [ -f "$dir/speech.state" ] && [[ $(cat "$dir/speech.state") == error:* ]];then cat "$dir/speech.state";else echo idle;fi ;;
 *) echo 'Unknown voice action.' >&2;exit 1 ;;
esac
