# AGL Agent Manager

A standalone VS Code extension for native Claude Code and Codex sessions.
It lists Claude and Codex agents only inside the current workspace’s .sessions folders, including their repository worktrees.
Agents started directly in the canonical workspace or elsewhere are excluded.
Claude sessions use an orange icon. Codex sessions use a green terminal icon.

## Install

Download the latest VSIX from [GitHub Releases](https://github.com/agentlabs-common/claude-folder-agents/releases/latest).
For Remote SSH, install the VSIX locally in VS Code. Voice playback runs on the local computer.

1. In VS Code, open **Extensions → … → Install from VSIX…**.
2. Select **claude-folder-agents-0.7.12.vsix**.
3. Run **Developer: Reload Window**.
4. Expand **AGL Agent Manager** in Explorer.

Terminal alternative:

`code --install-extension claude-folder-agents-0.7.12.vsix --force`

## Claude workspace trust

Run **AGL Agent Manager: Trust This Workspace for Claude** from the Command Palette or the **…** menu in either agent sidebar. If a launch reports missing trust, select **Trust Workspace and Retry** to approve the parent and continue automatically. The action approves the canonical parent workspace, even when invoked from an agent folder. It merges the trust flag into Claude’s configuration on the machine running the agents; SSH workspaces update the remote configuration. Other configuration entries are kept. No agent is started or interrupted.

Ordinary session subfolders inherit parent trust. Nested Git repositories and some project permissions can still require their own approval. This action does not enable YOLO mode.

## Codex sessions

Claude and Codex appear together in **AGL Agent Manager**, limited to managed .sessions folders and their descendants.
**Providers** in extension settings can show either provider alone. A missing provider does not hide sessions from the other one.

Open a Codex row to launch `codex resume <thread-id>` with the shared Gemini voice pane. Repeated clicks reuse the terminal.
The extension reads Codex daemon history without sending prompts, forking threads, or changing approval policies. Native Codex handles terminal input and approvals.
Completed Codex replies use the same full-message TTS, Indian voice catalog, dictation, and Gemini Live prompt editing as Claude.

Use **+ → Codex**, **AGL Agent Manager: New Codex Session**, or **New Codex Session (YOLO)** to create a session.
Use **Restart Session in YOLO Mode** to interrupt the selected active turn and resume the same session with YOLO permissions. Ordinary opening attaches to a running session without interrupting it.
Codex YOLO uses `--dangerously-bypass-approvals-and-sandbox`.

The local or SSH host needs Codex with the shared daemon API (verified with 0.166.0).
New Codex sessions start the daemon when necessary. **AGL Agent Manager: Start Codex Daemon** starts it explicitly for discovery.
The microphone and Gemini key stay on the local VS Code computer. Codex history and native terminal traffic use SSH for remote folders.

[Official Codex app-server documentation](https://developers.openai.com/codex/app-server).

## Workspace sessions

**AGL Agent Folders** uses the AgentLabs logo for each agent folder and creates isolated folders of repository worktrees. No companion skill is needed or installed for workspace isolation.

1. Open the workspace containing the canonical repository clones.
2. Select **+** in **AGL Agent Manager** or **AGL Agent Folders**.
3. Choose Claude or Codex and enter an agent name, such as eb-dev. There is no repository picker or generated folder-name suffix.
4. The manager creates **.sessions/<agent>/<name>/** without worktrees or Git fetches.
5. It starts the selected native agent terminal and voice pane in the current VS Code window. The VS Code workspace stays open at the parent folder; only the agent process uses the new session folder as its working directory.
6. The agent chooses repositories from the task and uses the bundled **.agl/workspace.cjs** helper to add their worktrees on demand.

The default base is **main**, using **origin/main** when origin exists. Set **Workspace Base Branch** for another branch. When adding a worktree, its canonical clone must be clean and on that branch; canonical working trees are not switched, edited or built. The helper discovers repositories dynamically. Adding a worktree fetches the configured base branch and updates the session manifest. Failed additions roll back only newly created worktrees and preserve existing edits; retained paths are reported.

Each new session contains **.agl-session.json**, **AGENTS.md**, **CLAUDE.md**, and the portable **.agl/workspace.cjs** helper. The instructions tell the agent how to discover repositories and run **add <session-root> <repo-name> [repo-name...]** with the recorded Node runtime. The manifest starts with an empty repository list and records worktrees as the agent adds them. The manifest records native conversation IDs after launch for later resume. Existing .sessions/<agent>/<folder> directories are recognized even without a manifest. Worktree metadata is discovered from their canonical clones; no skill or manual migration is needed.

For example, VS Code remains open at **workspace-eb**, while Claude agent **eb-dev** runs in **workspace-eb/.sessions/claude/eb-dev/** and appears in that same window’s manager. Multiple agents remain visible there together. Existing older folders with ID suffixes remain supported and are not renamed.

**Working directory and history are separate.** A new agent starts in the specific session folder. Its conversation history stays in the native agent data directory on the machine running it, rather than being copied into the workspace folder. Existing agents are not moved, stopped, or deleted. The agent list excludes agents outside .sessions, including those started directly in the canonical workspace. Closed histories remain visible while their workspace folder still exists.

Select an agent-folder row to start or resume its agent in the same window. Repeating New Agent with an existing agent type and name opens that folder, including after a failed first launch. Repeated clicks share the same pending launch. **Reveal Agent Folder** expands the folder in the existing Explorer. Creating or reopening agents never calls Open Folder or opens another VS Code window. Native launchers currently support Claude and Codex.

**Remove Agent Folder…** checks all repositories before removing the first worktree. Running agents, dirty/untracked work, symbolic-link escapes, and unexpected files outside the repositories block removal. After confirmation, clean worktrees and ignored build outputs are removed; branches and native conversation history are kept. A later Git failure reports partial removal and preserves the remaining worktrees and metadata. Project skills or notes in the session must be moved or removed before cleanup.

The workspace and skill engines use Node APIs and Git argument arrays, without Bash. SSH jobs use Node on PATH or VS Code Server’s bundled Node; Windows SSH runtime discovery uses PowerShell and the Remote SSH platform setting. The existing microphone and playback requirements are separate below. Linux and real SSH integration were tested; Windows and macOS host runs have not yet been performed.

## Skills GUI

Select the **Manage Skills** book icon in the main manager toolbar, or run **AGL Agent Manager: Manage Skills**.
**AGL Skills** manages folder-based skills separately from workspace isolation. It groups workspace and personal sources for Claude, Codex/shared AGENTS skills, and legacy Codex locations on the selected local or SSH host.

- **New Skill** creates a SKILL.md from a name and description and opens it for editing.
- **Import Skill Folder** copies a folder containing SKILL.md and its supporting files into the chosen source; existing skills are not overwritten.
- Select a skill to edit its SKILL.md. Bundled system skills open as a preview without editing their source.
- **Disable Skill** moves the entry outside the provider’s discovery directory; **Enable Skill** restores it without overwriting a replacement.
- **Remove Skill…** requires confirmation. Removing a linked entry keeps the linked source folder.

Save or discard unsaved skill edits before disabling or removing a skill. Changes affect future skill discovery; a running agent may need to reload or restart. Project skills are scoped to the selected workspace folder; personal skills apply on that host. Skills supplied by plugin catalogs and GitHub installation are not managed by this first GUI version.

### Skills for one agent

The **Skills** tab in a Claude session’s Voice pane lists the skills that agent can load: skills in its own folder, skills inherited from parent folders, personal skills and installed plugins. Switches apply to that agent only. They are saved as `skillOverrides` (skills) and `enabledPlugins` (plugins) in the agent folder’s `.claude/settings.local.json`, the same file Claude Code’s `/skills` menu writes; other settings in that file are kept. Plugins switch as a whole, because Claude Code has no per-folder switch for a single plugin skill. Restart the agent to apply a change. Codex sessions show the tab without switches.

Source discovery follows [Codex skills](https://developers.openai.com/codex/skills) and [Claude skills](https://code.claude.com/docs/en/skills). Session instructions follow [Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md) and [Claude memory](https://code.claude.com/docs/en/memory).

## Status page and session notes

Each session keeps notes in `.agl/`: `STATUS.md` (a short snapshot with a state and a headline), `FACTS.md` (dated, durable facts) and optional `pages/*.md`. The bundled **agl-notes** skill teaches agents the format; the extension installs it into `~/.claude/skills` and `~/.agents/skills` on start and never replaces a skill of the same name that it did not install. New sessions’ `AGENTS.md` points to it.

- **Open Status Page** (pulse icon in **AGL Agent Manager** or **AGL Agent Folders**) opens a local page in your browser. It listens on 127.0.0.1 only, and every URL carries a random token. The home page lists every session in the workspace, needs-you first, with stale and open-review flags.
- Each session page shows Status, Facts and its pages. **Save comment**, **Yes** and **No** only record a review in `.agl/reviews.json`; nothing is sent to the agent. Tell the agent when you have reviewed; it answers each review, and you select **Confirm reviewed** to close it.
- The **Status** tab in the Voice pane shows the same status and facts for that agent.

Local workspaces only for now; SSH sessions are not shown. Notes in `.agl/` block **Remove Agent Folder…** until you move or delete them.

## Closed and hidden sessions

The default **All sessions** filter includes running sessions, saved Claude conversations, and closed or archived Codex conversations under existing .sessions workspace folders. The extension cannot recover history already removed by the agent.
Use the **Filter Sessions** funnel in the view title to choose **All**, **Running**, **Closed**, or **Hidden** sessions.

Right-click a session for **Hide Session**. This changes only this extension's view and keeps the conversation and any running task.
Choose **Hidden sessions**, then right-click **Restore Hidden Session** to show it again.

**Delete Closed Session…** permanently removes the selected conversation after confirmation. Running sessions must be closed first.
For Codex, native deletion also removes spawned child sessions. For Claude background agents, native deletion may remove its managed worktree; the confirmation explains this before deletion. Saved interactive Claude conversations delete their transcripts while keeping project files.
Opening an archived Codex conversation restores that same thread before opening its terminal.

## Folder scope

The default scope is the active editor's workspace folder, or the first open folder.
Right-click a canonical workspace or session folder and select **Show AGL Agent Manager**.
**AGL Agent Manager: Show Sessions in Workspace Folders** restores the default scope.
Canonical workspace paths resolve symbolic links. Managed session paths themselves must not be symbolic links.
The list includes only agents whose working directories are inside a recognized .sessions folder; it includes descendant repository directories and excludes canonical clones.

## Terminals

The extension reads native agent inventories and saved conversations, then applies .sessions directory boundaries before displaying or attaching them.
It attaches native background sessions with `claude attach <id>`.
The **+** button lets you choose Claude or Codex. Claude starts a native background session; Codex creates a thread and opens its native terminal.
Repeated clicks reuse the session's terminal and voice pane.
Closing the terminal does not stop a background agent.

A live interactive session in tmux opens through a separate grouped tmux client.
The extension checks the process ancestry before it attaches.
A live session in another ordinary terminal cannot be attached.
The extension reports this limitation and prevents a duplicate resume.

## YOLO mode

Run **AGL Agent Manager: New Agent Session (YOLO)** to create a named agent folder and start it in the current window.
This starts Claude with `--dangerously-skip-permissions`, which skips all permission checks.
Enable **AGL Agent Manager: Yolo Mode** to use it by default for new sessions and resumed inactive interactive sessions.
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

**Dictate** is plain speech-to-text, the same Deepgram streamer as Herdr dictation (`~/.claude/hooks/stt-stream.py`, key in `~/.claude/hooks/tts.conf`). Press it to start; your words appear above the composer. Press it again to send the text to the agent. It works with or without Gemini Live; a connected Live session pauses its microphone while you dictate. For Gemini-edited prompts that wait in the composer, choose **Review** in the Live delivery menu.
Gemini turns your spoken thought into a lightly polished draft. Edit it and select **Send** when ready.
In **Auto-send polished prompt** mode, complete spoken prompts go directly to the selected agent terminal.
Typed prompts are sent as written. **Interrupt** sends Ctrl+C to the terminal.
Closing the voice pane stops its microphone and connection.

## Gemini configuration

Click **⚙** in the voice pane or AGL Agent Manager toolbar, or run **AGL Agent Manager: Configure Gemini Voice**.
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
3. Gemini decides when your thought is complete and sends it. If it never does, what it heard is sent after the pause. When unsure, it asks “Send that?”.
4. Use **Send now** to explicitly end a dictation, or **Disconnect** to stop the microphone.
5. Gemini reads the agent’s replies aloud in its own voice. Ask it about a reply (“did the tests pass?”) and it answers from the reply without sending anything to the agent.
6. Say **stop** or **quiet** to stop reading, **read that again**, **stop the agent** to interrupt it, or **cancel** / **scratch that** to drop the current dictation.

Prompts are typed into the agent terminal and Enter is pressed separately, so long dictation is submitted instead of being treated as a paste.

The default minimum silence window is **3 seconds**. In settings, choose **Pause before sending** to use 3, 5, or a custom 1–10 seconds.
Gemini can continue waiting if the thought is incomplete. Fillers such as “right” and “or rather” are not submitted on their own.
After **3 minutes without microphone activity**, Live disconnects automatically. Unfinished dictation is preserved in the composer, and reply readout stays available.
**Remove spoken redundancy** removes only repeated wording and hesitation sounds. It keeps all distinct requirements, self-corrections, numbers, paths, and technical details. Unsafe edits fall back to the complete original dictation. Failed submissions stay visible as a draft.
Disable it to preserve the original wording. Reconnect after changing Live settings.

Gemini is a voice companion, not the coding agent. Claude or Codex performs the task.
While Live is connected, Gemini Live speaks replies (set `GEMINI_LIVE_VOICE` for a prebuilt Live voice). When it is disconnected, readout uses the dedicated Gemini TTS API with the selected catalog voice.
Live sessions resume automatically when Gemini rotates the connection. Events, without partial transcripts, are logged to `~/.cache/agl-agent-manager/live.log`.

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

Run **AGL Agent Manager: Open Remote Working Directory over SSH**.
Enter your SSH host and an absolute working directory on that host.
The list then shows agents only under that workspace’s .sessions folders.
**Show Sessions in Workspace Folders** returns to the local workspace.

The extension sends its Python helper over SSH stdin without installing it remotely.
The remote machine needs Python 3, native Claude Code, and working SSH authentication.
Terminal attachment also uses SSH, launched explicitly on the local computer to avoid a second SSH connection from the remote workspace.
The extension decodes VS Code SSH connection details and uses the configured **Remote.SSH: Path** and **Remote.SSH: Config File**, including custom user and port settings.
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

**AGL Agent Manager: Claude Path** sets the local CLI executable.
**Show Saved** includes completed native background sessions.

## Development

Run `npm install` first to install the WebSocket transport dependency.

Open this directory in VS Code and press **F5**.
`npm test` checks managed-session boundaries, worktree lifecycle, skill management, native terminals, SSH transport, and voice lifecycle.
`npm run test:host` loads the extension in an isolated VS Code window (requires Xvfb).
`npm run package` builds the VSIX.
The packaged extension includes the ws WebSocket transport dependency.
