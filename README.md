# Agent Sessions & Voice

A standalone VS Code extension for native Claude Code and Codex sessions.
It shows sessions whose working directory equals the current folder.
Subfolders and other workspaces are excluded.
Claude sessions use an orange icon. Codex sessions use a green terminal icon.

## Install

Download the latest VSIX from [GitHub Releases](https://github.com/agentlabs-common/claude-folder-agents/releases/latest).
For Remote SSH, install the VSIX locally in VS Code. Voice playback runs on the local computer.

1. In VS Code, open **Extensions → … → Install from VSIX…**.
2. Select **claude-folder-agents-0.4.0.vsix**.
3. Run **Developer: Reload Window**.
4. Expand **Agent Sessions** in Explorer.

Terminal alternative:

`code --install-extension claude-folder-agents-0.4.0.vsix --force`

## Codex sessions

Claude and Codex appear together in **Agent Sessions**, limited to the exact selected folder.
**Providers** in extension settings can show either provider alone. A missing provider does not hide sessions from the other one.

Open a Codex row to launch `codex resume <thread-id>` with the shared Gemini voice pane. Repeated clicks reuse the terminal.
The extension reads Codex daemon history without sending prompts, forking threads, or changing approval policies. Native Codex handles terminal input and approvals.
Completed Codex replies use the same full-message TTS, Indian voice catalog, dictation, and Gemini Live transcription as Claude.

Use **+ → Codex**, **Agent Sessions: New Codex Session**, or **New Codex Session (YOLO)** to create a session.
Existing idle Codex sessions can use **Restart Session in YOLO Mode**. Wait for an active task to finish before switching mode.
Codex YOLO uses `--dangerously-bypass-approvals-and-sandbox`.

The local or SSH host needs Codex with the shared daemon API (verified with 0.166.0).
New Codex sessions start the daemon when necessary. **Agent Sessions: Start Codex Daemon** starts it explicitly for discovery.
The microphone and Gemini key stay on the local VS Code computer. Codex history and native terminal traffic use SSH for remote folders.

[Official Codex app-server documentation](https://developers.openai.com/codex/app-server).

## Folder scope

The default scope is the active editor's workspace folder, or the first open folder.
Right-click a folder and select **Show Agent Sessions** to use that exact directory.
**Agent Sessions: Show Sessions in Workspace Folders** restores the default scope.
Symbolic links resolve to the same directory.
The list does not include child directories or all agents on the computer.

## Terminals

The extension reads `claude agents --json --all --cwd <folder>` and applies exact directory matching.
It attaches native background sessions with `claude attach <id>`.
The **+** button lets you choose Claude or Codex. Claude starts a native background session; Codex creates a thread and opens its native terminal.
Repeated clicks reuse the session's terminal and voice pane.
Closing the terminal does not stop a background agent.

A live interactive session in tmux opens through a separate grouped tmux client.
The extension checks the process ancestry before it attaches.
A live session in another ordinary terminal cannot be attached.
The extension reports this limitation and prevents a duplicate resume.

## YOLO mode

Click the rocket button in **Claude Sessions**, or run **Agent Sessions: New Claude Session (YOLO)**.
This starts Claude with `--dangerously-skip-permissions`, which skips all permission checks.
Enable **Claude Folder Agents: Yolo Mode** to use it by default for new sessions and resumed inactive interactive sessions.
It works locally and over SSH. To change an existing session, right-click it and select **Restart Session in YOLO Mode**.
This interrupts its current task, stops the existing process, and resumes the same conversation with permission checks skipped.
The extension verifies the folder and waits for the previous process to stop before resuming. Ordinary clicks still attach without changing its mode.

## Voice

The voice pane shows complete published Claude replies and your prompts.
It preserves every sentence and code text in the pane. A voice summary is used only when no reply body is available.
Speech skips URLs, URIs, filesystem paths, filenames, and fenced code blocks. The visible reply remains complete.
Click a reply to play it with **Gemini TTS**. Live-tab messages are clickable too.
**Auto-speak** uses the same Gemini TTS player. Playback does not open the microphone or require a Live connection.
Clicking a reply reads its complete current text. Automatic readout waits for ongoing playback instead of replacing it.
**Read replies early** reads published reply text without waiting for a closing voice tag.
It does not shorten the reply to its first sentence. As a reply grows, remaining text queues after the current audio.
The reader follows appended transcript records every 250 ms locally and 500 ms over SSH.
It does not rescan the complete transcript. A later voice block from the same reply is not read twice.
**Pause** and **Resume** control playback. **Stop speech** stops playback and turns off auto-speak.
Gemini stays connected until you select **Disconnect Gemini**.
**Notes** shows view blocks as plain text.

1. Select **Dictate** to record speech.
2. Select **Review** to put the result in the prompt field, or **Send speech** to submit it.
3. Select **Cancel** to discard a recording.

Typed and dictated prompts go to the selected session's terminal.
**Interrupt** sends Ctrl+C to that terminal.
Closing the voice pane stops its microphone recording.

Speech uses the independent agentlabs-voice setup:
`~/.claude/hooks/stt-stream.py`, the Python environment at `~/.venvs/tts`,
and settings in `~/.claude/hooks/tts.conf`.
Dictation uses Deepgram. Playback streams Gemini TTS through aplay.
Gemini TTS uses your Gemini API key from the environment or `~/.config/agentlabs/keys.env`.
**Tts Model** and **Tts Voice** in extension settings control readout independently of Live.
Defaults are `gemini-3.8-flash-tts` and `Aoede`. Python 3 is sufficient for TTS.
The extension has its own recording and player state.
It does not use another terminal manager, its mods, its sockets, or its voice relay.

## Gemini configuration

Click **⚙** in the voice pane or Claude Sessions toolbar, or run **Agent Sessions: Configure Gemini Voice**.
Choose the TTS model, one of 30 voices or a custom voice ID, speaking style, transcription model, microphone behavior, or Python executable.
For Indian female voices, choose **TTS voice → Indian English · Female** or **Hindi · Female**.
**Browse voice catalog…** offers Indian languages and gender filters. The catalog uses the voices available to your Gemini API key.
Each result shows its name, language, accent, gender, pitch, and description. Search matches these details.
Select a voice, then **Preview voice** to hear it or **Use this voice** to save it. **Stop preview** stops the sample.
Preview does not change your saved voice. Catalog previews use your Gemini TTS quota.

TTS changes apply on the next readout. Reconnect Live after changing its key, transcription model, or Python executable.

**Set Gemini API key** saves the key in VS Code secure storage on the local computer. It takes priority over environment and keys.env values for both TTS and Live.
The key is passed only to local voice helpers, not to the webview, command arguments, repository settings, or SSH host.
**Remove saved API key** restores the environment or keys.env fallback.

## Gemini Live

1. Open the **Gemini Live** tab in the voice pane.
2. Select **Connect Gemini Live**.
3. Speak to the selected Claude session.
4. Select **Disconnect** to stop the microphone and connection.

The **Mute mic** control mutes input. **Send now** sends the current transcript immediately.
Final speech segments also send automatically after a short pause.
Gemini Live transcribes speech. Claude performs the task, and Gemini TTS reads the reply.
Text-to-speech uses its own REST stream and does not use a Live audio model.
The connection badge stays visible on every tab. **Disconnect Gemini** stops live audio and the microphone.
Replies and live captions follow the newest content at the bottom.
The panel shows live captions, connection state, and the time to first readout audio.

The default input model is **gemini-3.5-transcribe-live**.
The readout model is configured under **Tts Model**, separately from Live.
The service uses your Gemini API key and quota.
It reads **GEMINI_API_KEY** or **GOOGLE_API_KEY** from the environment or
`~/.config/agentlabs/keys.env`. Keys stay in the Python process.
The Python environment needs **websockets**. The computer needs **arecord** and **aplay**.

The microphone pauses during readout by default to prevent a speaker-feedback loop.
With a headset, **Live Barge In** keeps the microphone active during playback.
**Interrupt** stops speech and sends Ctrl+C to Claude.
Closing the voice pane shuts down its live connection and audio processes.

Speech starts when Claude publishes its first reply text.
Claude's own reasoning time and text publication time still affect response latency.
Gemini TTS playback streams audio without waiting for the complete reply audio.

[Gemini Live API documentation](https://aistudio.google.com/docs/live-api/capabilities).
[Gemini TTS API documentation](https://aistudio.google.com/docs/speech-generation).

## Remote sessions

Run **Agent Sessions: Open Remote Working Directory over SSH**.
Enter your SSH host and an absolute working directory on that host.
The list then shows only sessions in that exact remote directory.
**Show Sessions in Workspace Folders** returns to the local workspace.

The extension sends its Python helper over SSH stdin without installing it remotely.
The remote machine needs Python 3, native Claude Code, and working SSH authentication.
Terminal attachment also uses SSH.
The microphone and speech playback run on this computer.
Remote transcript summaries travel over SSH to the voice pane.
No global remote-machine or agent list is shown.

This extension runs locally in VS Code, including when the workspace uses Remote-SSH.
A phone or browser client does not stream its microphone to the extension.

## Requirements

- Native Claude Code with `claude agents --json`, `claude --bg`, and `claude attach` (checked with 2.1.318).
- VS Code 1.85 or later, Linux, Python 3, and a trusted workspace.
- For voice: independent agentlabs-voice configuration, arecord, aplay, a Gemini API key for readout, and a Deepgram key for separate dictation.
- For live interactive tmux sessions: tmux.

**Claude Folder Agents: Claude Path** sets the local CLI executable.
**Show Saved** includes completed native background sessions.

## Development

Run `npm install` first to install the WebSocket transport dependency.

Open this directory in VS Code and press **F5**.
`npm test` checks exact folder scope, Claude icons, terminal reuse, SSH quoting, and voice lifecycle.
`npm run test:host` loads the extension in an isolated VS Code window (requires Xvfb).
`npm run package` builds the VSIX.
There are no runtime npm dependencies.
