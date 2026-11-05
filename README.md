# Agent Sessions & Voice

A standalone VS Code extension for native Claude Code and Codex sessions.
It shows sessions whose working directory equals the current folder.
Subfolders and other workspaces are excluded.
Claude sessions use an orange icon. Codex sessions use a green terminal icon.

## Install

Download the latest VSIX from [GitHub Releases](https://github.com/agentlabs-common/claude-folder-agents/releases/latest).
For Remote SSH, install the VSIX locally in VS Code. Voice playback runs on the local computer.

1. In VS Code, open **Extensions → … → Install from VSIX…**.
2. Select **claude-folder-agents-0.5.3.vsix**.
3. Run **Developer: Reload Window**.
4. Expand **Agent Sessions** in Explorer.

Terminal alternative:

`code --install-extension claude-folder-agents-0.5.3.vsix --force`

## Codex sessions

Claude and Codex appear together in **Agent Sessions**, limited to the exact selected folder.
**Providers** in extension settings can show either provider alone. A missing provider does not hide sessions from the other one.

Open a Codex row to launch `codex resume <thread-id>` with the shared Gemini voice pane. Repeated clicks reuse the terminal.
The extension reads Codex daemon history without sending prompts, forking threads, or changing approval policies. Native Codex handles terminal input and approvals.
Completed Codex replies use the same full-message TTS, Indian voice catalog, dictation, and Gemini Live prompt editing as Claude.

Use **+ → Codex**, **Agent Sessions: New Codex Session**, or **New Codex Session (YOLO)** to create a session.
Use **Restart Session in YOLO Mode** to interrupt the selected active turn and resume the same session with YOLO permissions. Ordinary opening attaches to a running session without interrupting it.
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

Replies populate both Voices and Gemini Live even when auto-speak is off or an audio helper fails.
The pane shows the full published reply. Speech skips paths, URLs, filenames, and fenced code.
Click a reply in either tab to hear it with the selected Gemini TTS voice.
**Auto-speak** queues new replies without interrupting audio already playing.
**Pause**, **Resume**, and **Stop speech** control playback.

Connection status, microphone controls, settings, playback controls, and the composer are grouped at the bottom.
Action buttons use compact icons. Hover for a tooltip; each button also has an accessible label.

**Dictate** connects Gemini Live in **Review before sending** mode.
Gemini turns your spoken thought into a lightly polished draft. Edit it and select **Send** when ready.
In **Auto-send polished prompt** mode, complete spoken prompts go directly to the selected agent terminal.
Typed prompts are sent as written. **Interrupt** sends Ctrl+C to the terminal.
Closing the voice pane stops its microphone and connection.

## Gemini configuration

Click **⚙** in the voice pane or Claude Sessions toolbar, or run **Agent Sessions: Configure Gemini Voice**.
Choose the TTS model, one of 30 voices or a custom voice ID, speaking style, Live model, pause timing, prompt polishing, microphone behavior, or Python executable.
For Indian female voices, choose **TTS voice → Indian English · Female** or **Hindi · Female**.
**Browse voice catalog…** offers Indian languages and gender filters. The catalog uses the voices available to your Gemini API key.
Each result shows its name, language, accent, gender, pitch, and description. Search matches these details.
Select a voice, then **Preview voice** to hear it or **Use this voice** to save it. **Stop preview** stops the sample.
Preview does not change your saved voice. Catalog previews use your Gemini TTS quota.

TTS changes apply on the next readout. Reconnect Live after changing its key, Live model, pause timing, prompt polishing, or Python executable.

**Set Gemini API key** saves the key in VS Code secure storage on the local computer. It takes priority over environment and keys.env values for both TTS and Live.
The key is passed only to local voice helpers, not to the webview, command arguments, repository settings, or SSH host.
**Remove saved API key** restores the environment or keys.env fallback.

## Gemini Live

All microphone input uses the conversational **gemini-3.8-live** model. No Deepgram or external speech hooks are used.

1. Select **Connect Gemini Live** in the bottom controls.
2. Speak naturally. Gemini keeps context across thinking pauses and self-corrections.
3. Gemini calls the prompt-submission function when your thought is complete.
4. Use **Send now** to explicitly end a dictation, or **Disconnect** to stop the microphone.

The default minimum silence window is **3 seconds**. In settings, choose **Pause before sending** to use 3, 5, or a custom 1–10 seconds.
Gemini can continue waiting if the thought is incomplete. Fillers such as “right” and “or rather” are not submitted on their own.
After **3 minutes without microphone activity**, Live disconnects automatically. Unfinished dictation is preserved in the composer, and reply readout stays available.
**Remove spoken redundancy** removes only repeated wording and hesitation sounds. It keeps all distinct requirements, self-corrections, numbers, paths, and technical details. Unsafe edits fall back to the complete original dictation. Failed submissions stay visible as a draft.
Disable it to preserve the original wording. Reconnect after changing Live settings.

Gemini is a prompt editor, not the coding agent. Claude or Codex performs the task.
Reply readout uses the dedicated Gemini TTS API, preserving the selected Indian or other catalog voice.

The connection icon stays green while connected; click it to disconnect. Live transcription appears above the composer on every tab.
All action icons share one bottom toolbar. Pause and Resume share a position. Hover an icon for its label.
**Mute mic** mutes input. **Review** places spoken prompts in the composer instead of submitting them.
The microphone pauses during reply playback by default to prevent speaker echo.
With a headset, **Live Barge In** keeps it active during playback.

The Gemini key comes from VS Code secure storage, the environment, or ~/.config/agentlabs/keys.env.
The Live Python environment needs **websockets**, and the local computer needs **arecord** and **aplay**.
Speech starts after the agent publishes reply text, so the agent’s own response time still affects readout latency.

[Gemini Live documentation](https://aistudio.google.com/docs/live-api).
[Gemini TTS documentation](https://aistudio.google.com/docs/speech-generation).

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
- For voice: arecord, aplay, a Gemini API key, and a Python environment with websockets.
- For live interactive tmux sessions: tmux.

**Claude Folder Agents: Claude Path** sets the local CLI executable.
**Show Saved** includes completed native background sessions.

## Development

Run `npm install` first to install the WebSocket transport dependency.

Open this directory in VS Code and press **F5**.
`npm test` checks exact folder scope, Claude icons, terminal reuse, SSH quoting, and voice lifecycle.
`npm run test:host` loads the extension in an isolated VS Code window (requires Xvfb).
`npm run package` builds the VSIX.
The packaged extension includes the ws WebSocket transport dependency.
