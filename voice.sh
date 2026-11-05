#!/usr/bin/env bash
# Independent speech playback and streaming dictation.
set -euo pipefail
operation=$1; dir=$2; shift 2
umask 077
mkdir -p "$dir"
case "$operation" in
 voices)
  python="${CLAUDE_AGENTS_VOICE_PYTHON:-python3}"
  "$python" "$(dirname "$0")/tts.py" --list-voices "$@" ;;
 play)
  [ ! -f "$dir/player.pid" ] || kill -CONT -- "-$(cat "$dir/player.pid")" 2>/dev/null || true
  [ ! -f "$dir/player.pid" ] || kill -- "-$(cat "$dir/player.pid")" 2>/dev/null || true
  python="${CLAUDE_AGENTS_VOICE_PYTHON:-python3}"
  command -v aplay >/dev/null || { echo 'Install aplay for Gemini TTS playback.' >&2;exit 1; }
  "$python" "$(dirname "$0")/tts.py" --check "$1"
  echo 'generating · Gemini TTS' > "$dir/speech.state"
  setsid "$python" "$(dirname "$0")/tts.py" --state-dir "$dir" "$1" > "$dir/play.log" 2>&1 & echo $! > "$dir/player.pid"
  rm -f "$dir/paused" ;;
 pause) [ ! -f "$dir/player.pid" ] || { kill -STOP -- "-$(cat "$dir/player.pid")" 2>/dev/null || true;: > "$dir/paused"; } ;;
 resume) [ ! -f "$dir/player.pid" ] || kill -CONT -- "-$(cat "$dir/player.pid")" 2>/dev/null || true;rm -f "$dir/paused" ;;
 stop) [ ! -f "$dir/player.pid" ] || { kill -CONT -- "-$(cat "$dir/player.pid")" 2>/dev/null || true;kill -- "-$(cat "$dir/player.pid")" 2>/dev/null || true; };rm -f "$dir/player.pid" "$dir/paused";echo idle > "$dir/speech.state" ;;
 state) if [ -f "$dir/player.pid" ] && kill -0 "$(cat "$dir/player.pid")" 2>/dev/null;then [ ! -f "$dir/paused" ] && cat "$dir/speech.state" || echo paused;elif [ -f "$dir/speech.state" ] && [[ $(cat "$dir/speech.state") == error:* ]];then cat "$dir/speech.state";else echo idle;fi ;;
 *) echo 'Unknown voice action.' >&2;exit 1 ;;
esac
