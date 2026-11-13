# Changelog

All releases are on [GitHub Releases](https://github.com/agentlabs-common/agl-agent-manager/releases), each with its VSIX.

## 0.15.2 (2026-11-13)

- **Antigravity** (`agy`) joins as a provider: list, open and resume the same conversation, new sessions (also YOLO), running state, stop, restart in YOLO, read-aloud from its transcript, teams and portal pages. Unread agent messages and agl-notes updates reach it through a SessionStart/PreInvocation hook in `~/.gemini/config/hooks.json`, injected once per change; `agl-notes` is installed in `~/.gemini/config/skills`. Antigravity cannot delete conversations yet, so Delete says so.
- **One provider list** (`agents.js`) now drives every label, picker, icon and terminal title, so all agents look alike. **New Kimi Session** and **New Antigravity Session** commands join Codex and Copilot's.
- Tests no longer run delivery against the real home folder (it could reset `~/.config/agentlabs/agl/agent-portal.json` to a test address).

## 0.15.1 (2026-11-09) — local test release

The voice pane now uses the session name in its title, header, reply labels, live captions and composer controls for every provider. Copilot no longer falls back to Claude. Name changes refresh labels even when the reply text is unchanged. The sidebar uses GitHub's Copilot Octicon, with separate light/dark colors and its MIT attribution.

## 0.15.0 (2026-11-09) — local test release

- Adds GitHub Copilot CLI as a local provider: native sessions and terminals, history/readout, teams, portal pages and native user skill switches.
- Allowed portal messages can wake a stopped Copilot agent in the same conversation. Hold, contact withdrawal, cooldown, backoff and duplicate-start locks apply. No YOLO or allow-all flags are added to a wake; ambiguous activity stays queued.
- Adds agent-folder skill switches for Codex and Kimi alongside Claude. Close and reopen Codex/Kimi through AGL after changes. Copilot switches currently affect the account.
- Fixes Interrupt, closed-terminal sends, Refresh, rich Status summaries, failed skill-toggle recovery, Stop dispatch and attached-provider Skills routing. Unsupported voice controls are disabled outside Linux.
- Copilot SSH, agent-folder-only Copilot skills and detailed native activity/permission badges remain follow-up work. Voice still requires Linux. See the Copilot assessment for verification limits.

This build is for local testing before Marketplace publication.

## 0.14.17 (2026-11-09)

Adds a Nano Banana Pro promotional hero and a complete feature-overview image to the Marketplace presentation, plus an accessible text feature table. The artwork is labelled as promotional, separate from actual product screenshots. Platform and provider limitations are explicit. Includes the generic agent discovery and team visibility fixes from 0.14.16.

## 0.14.16 (2026-11-09)

Managed agents now default to All, independently of the legacy showSaved setting, so stopped team members remain visible. Explicit sidebar filters are preserved. Claude, Codex and Kimi results appear as each provider responds instead of waiting for the slowest provider. Failed refreshes retain the last list with a warning. Explicit team members are no longer suppressed as older transcript copies. Existing conversation IDs and team membership are preserved.

## 0.14.15 (2026-11-09)

**Linux, macOS and Windows.** The automated tests now run on all three systems. On Windows the Python helpers use the `py` launcher (or `python`), Codex installed as `codex.cmd` starts correctly, CLIs are found under `%APPDATA%\npm`, and session folders are compared without regard to case or slash style. Stopping a Claude agent works without Linux's `/proc` on macOS and Windows. Voice stays Linux-only for now; the README has a **Platforms** table. The extension ID stays `Agentlabs.claude-folder-agents`.

## 0.14.14 (2026-11-09)

**Fresh installs find the agent CLIs.** When VS Code is started from a desktop launcher it often lacks your shell's PATH, so Claude Code or Codex installed under nvm, npm global or `~/.claude/local` was not found. The extension now looks in those folders too. When a CLI really is missing, the message says to install it or set its path, instead of a raw `Errno 2` or `EPIPE`.

## 0.14.13 (2026-11-09)

**VS Code Marketplace listing.** The README opens with what the extension does and a quick start; this changelog is new; search keywords and categories are set. If Gemini Live lacks the `websockets` package, or no Gemini key is set, the error now says exactly what to do. Dictate is documented as optional, with what it needs.

## 0.14.12 (2026-11-09)

**Published on the VS Code Marketplace as Agentlabs**. The extension ID becomes Agentlabs.claude-folder-agents; uninstall the old local-tools copy after installing this one. Settings and teams carry over; hidden sessions and each window's list filter start fresh. The README now says what the extension writes in your home folder and what leaves the machine.

## 0.14.11 (2026-11-09)

**Repository renamed to agentlabs-common/agl-agent-manager**. Links in the extension and README point at the new name; old links redirect. The README now covers Kimi, teams and Ephemeral, the Working/Idle/Stopped groups, Stop Agent and Delete Session. The extension ID stays local-tools.claude-folder-agents, so installs and settings carry over.

## 0.14.10 (2026-11-09)

**Kimi seats know about their inbox from the first prompt**: a new Kimi seat had no idea of agl-talk or its inbox until the user explained it.
- The prompt hook that tells Claude about unread messages and agl-notes updates is now also added to ~/.kimi-code/config.toml (once, only if Kimi is installed). It prints plain text for Kimi, which ignores Claude's JSON form.
- New seats' AGENTS.md now names the seat, says to read agl-notes before the first reply, to read the inbox at start and keep one listener running (and no longer points at the old STATUS.md).

## 0.14.9 (2026-11-09)

**Stop and delete agents**: right-click a running agent and choose Stop Agent (asks first; the conversation is kept and can be resumed). Delete now also works on a running agent: it stops it first, then deletes, after one confirmation. Claude waits until the stop has taken effect; Kimi ends its process; Codex interrupts the running turn and lets go of the thread.

## 0.14.8 (2026-11-09)

**Named teams, as many as you like**: Add to Team… offers your teams or New team…; right-click a team to Rename or Delete it (its agents go back to Ephemeral). Each team shows Working, Idle and Stopped. Teams live in the workspace's .sessions/teams.json, so a team can span seats; a 0.14.7 team carries over as Team.

## 0.14.7 (2026-11-09)

**Team and Ephemeral**: the agent list splits into Team and Ephemeral, each with Working, Idle and Stopped groups. Every conversation starts as Ephemeral; right-click one and choose Add to Team (or Remove from Team). Membership is stored in the seat's .agl-session.json under `team`, so every window and agent sees the same team. Ephemeral stays open until a workspace has a team.

## 0.14.6 (2026-11-09)

**Groups under every filter**: workspaces whose saved filter was Running showed a flat list, so the Working, Idle and Stopped groups never appeared there. Now Running and Closed group too; only Hidden stays flat.

## 0.14.5 (2026-11-09)

**Agent list: Working, Idle and Stopped, no reshuffling**: three fixed groups — Working (open), Idle and Stopped (folded) — each sorted by name, so a refresh never reshuffles the list; a row moves only when its group changes.

## 0.14.4 (2026-11-09)

- **Separate Idle and Stopped rows** in the agent list: idle agents are still running and open straight into their terminal; stopped ones have no process and start again when opened.
- agl-notes: Auth needs 2.2.0 (not 2.1.1) for http redirects on *.localhost.

## 0.14.3 (2026-11-09)

**Only working agents stay on top**: the default list keeps on top only agents in a turn, waiting on a permission prompt, or with a question for you. Idle agents (turn finished, still alive) and stopped ones fold under one collapsed **Idle and stopped (N)** row. A live agent whose turn has finished reads **idle** instead of done.

## 0.14.2 (2026-11-09)

**Stopped sessions fold away**: in the default view of the AGL Agent Manager list, running sessions stay on top and stopped ones go under one collapsed **Stopped (N)** row, one click away. The running, closed and hidden filters are unchanged, and nothing is removed.

## 0.14.1 (2026-11-09)

**Dictate fixes**:
- A lock left by a recorder that died (window closed, extension host gone) is cleaned up instead of blocking every new dictation with "Dictation is already recording".
- Every recording stops itself after 5 minutes (CC_DICTATE_MAX_SECONDS), so a recorder orphaned by a crashed window can no longer keep the microphone and stream to Deepgram.

## 0.14.0 (2026-11-09)

**Kimi Code CLI as a third agent provider** (step 2 of the Codex and Kimi plan):
- Kimi sessions in the AGL Agent Manager sidebar with their own icon; open in a VS Code terminal with the Voice pane (prompts, replies, voice summaries and notes from Kimi's transcript), Dictate and sending prompts.
- The + flow creates Kimi agent folders `.sessions/kimi/<name>/` with the same files as Claude and Codex; Kimi runs in that folder.
- Restart in YOLO stops only that folder's Kimi process and resumes the same session with `kimi -S <id> --yolo`. Delete uses Kimi's own session delete, after the usual confirmation, never while running.
- Limits: Kimi reports no running state, so running is inferred from a kimi process in the session folder; local workspaces only (SSH not supported yet, and untested); Kimi shows its own session title.

Also: **Dictate** — a late word update can no longer leave the button marked recording (random active look).

## 0.13.2 (2026-11-09)

Three fixes, each analysed against real data and tested live:

- **Waker wakes the agent itself, never a copy**: a running agent (any status, including done/idle) is never woken; a stopped one is resumed through its own job with no flags, keeping its name and mode; a job-less conversation gets --name <seat>.
- **Restart in YOLO waits for the stop to take effect**: resuming too soon after claude stop made Claude Code start a copy. It now waits until Claude Code reports no status, never passes stdin, and fails loudly if a copy is started.
- **New-reply dots read Claude Code's state, not status:** every listening agent is busy from its background listener, so status says nothing about a turn.

## 0.13.1 (2026-11-08)

- **One row per agent**: copies of one agent in one folder show once, the running row or else the newest; older copies move to the hidden filter as "older copy". A running row is never hidden and nothing is deleted.
- **True running state:** a stopped background agent shows "not running" instead of a stale blocked or done.
- **Links on agent portal pages open in a new tab**, only for http(s) on localhost, *.localhost, 127.0.0.1 or [::1].
- **agl-notes:** local names (Desk lessons), links without a port through the port-80 gateway, tickets/wiki/playbooks on the machine's Gitea, and stop only your own listener (never pkill shared tools).

## 0.13.0 (2026-11-08)

**Skill-only release: no plugin code changed since 0.12.1.**

- **Set aside a question:** the agl-notes skill now has every question end with `Z) Set aside, ask me later`. Choose it on the portal (click the option, then Approve) or say to skip it; the agent moves the question to its history as set aside, stops asking, and never brings it back unless you raise it. With no other open question, the agent is no longer needs-you, so its orange sidebar dot clears.
- agl-notes: the bare team domain opens the lead's copy.

## 0.12.1 (2026-11-08)

**Agent portal button beside Stop** in the Voice pane: a globe button in the bottom toolbar, always visible, opens that agent's own page on the agent portal.

## 0.12.0 (2026-11-08)

- **Local naming standard**: every container gets a canonical name like `auth.dev-1.desk.localhost` with a port from the agent's own range; the portal shows the name and published port from the `agl.host` label.
- **Conversations per agent**: an agent's Conversations page lists each agent it talked with, newest first, with a preview and unread count; choosing one opens that pair's thread.
- **Orange dots only when something waits for you:** a permission prompt, or a question on the agent's portal page. Claude Code's sticky `blocked` state is no longer used (on live data, 27 false-or-real orange dots became 15 real ones).
- **Agent Portal** row at the top of the agent list (globe icon); "Status Page" is now "Agent Portal" everywhere.

## 0.11.0 (2026-11-08)

Agents with portal contacts now hear each other reliably through the listener.

- **Not-listening reminder**: an agent with allowed contacts and no live listener is told at its next prompt to start `agl-talk inbox --wait --read` in the background; the portal marks it on the session list and Contacts page.
- **Sidebar dot**: a running agent in that state shows a yellow dot, "Not listening for portal messages", after the more urgent reasons.
- Channels were evaluated and not used: custom channels only reach agents started interactively, while the extension runs agents in the background so they survive closing VS Code.

## 0.10.0 (2026-11-08)


- **Agent communication:** contacts per pair that only you allow, threads, and `agl-talk` for agents; Contacts and Conversations pages per session, `/contacts` across agents, hold control. A change to contacts made outside the portal stops sending until you clear it.
- **Waking:** a stopped Claude session is resumed when an allowed contact writes to it, unless on hold; it resumes the newest conversation, logs failures, backs off and stops after 3. The woken agent may answer an allowed contact but never runs commands a message asks for without you.
- **Restart in YOLO changes the session in place** (same session, id and name) instead of starting a copy that left the original live.
- **Voice pane background per agent**, from the agent's portal name, so you see who you are talking to.
- One portal address per workspace in `agent-portal.json` (`portals`); custom blocks no longer stay on Loading; keeper reminders repeat at most every 6 hours; gradients on portal headers.

## 0.9.0 (2026-11-08)


- **Status keeper** (`scripts/keeper.cjs`): checks every agent's pages against the status guide; marks on the session list and session page, and a short reminder at the agent's next prompt while a problem remains.
- **Teams:** session list grouped by team (reports-to, or inferred from the name); read-only API for pages (`AGL.get` sessions, session, health, lib); OpenUI Pull and TeamStrip for leads.
- **/questions** (open questions across sessions) and **/requests** (why agents went custom).
- **Approvals keep a page fingerprint:** a page changed after approval shows a warning.
- **Live container health** from `docker ps -a --filter label=agl.session=<agent>/<name>` (3 s timeout, 15 s cache).
- OpenUI **Custom** block (own sandbox) and **Chart.js** 4.6.1 as a shared library (MIT).

## 0.8.0 (2026-11-08)

**The agent portal** replaces the status page.

- Agent pages in **OpenUI** or HTML, served in a sandbox (no network, no forms, no same-origin access) with a house kit; page buttons only ask, and the portal's own dialog records approvals.
- **Listen** reads a page aloud through Gemini TTS; one **Stop** button stops it (and runs `~/.claude/hooks/hush.sh` when present).
- The **agl-notes** skill is rewritten for the new pages and delivered on every update, stamped with the plugin version, to `~/.claude/skills` and `~/.agents/skills`.
- A **UserPromptSubmit hook** (`~/.config/agentlabs/agl/agl-skill-check.cjs`, added once to `~/.claude/settings.json` with a backup) tells an agent in an AGL session, once, when its skill is out of date and which pages to migrate; silent otherwise.
- `agl-migrate.cjs` turns Markdown pages into OpenUI pages.

## 0.7.18 (2026-11-08)

**Version in the three-dots menu.** The AGL Agent Manager and Agent Folders sidebars show "Version 0.7.18" in their ... menu; clicking it opens this release.

## 0.7.17 (2026-11-08)

**Cancel for Dictate.** While dictating, an ✕ button appears next to Dictate; it, or Esc, stops the recording and discards the words without sending anything.

## 0.7.16 (2026-11-07)

**A dot marks sessions that need you.** In the AGL Agent Manager sidebar, a warning-coloured dot shows a session waiting on a permission prompt or waiting for your answer; a blue dot shows a reply that finished while that agent was off screen, until you open it. The view shows the count. It uses the state Claude Code already reports, so no hook is needed.

## 0.7.15 (2026-11-07)

**Notes render Markdown.** The Notes tab in the voice pane now renders each view block as Markdown (headings, lists, tables, code, inline SVG) instead of raw text.

Also in this release line: 0.7.14 shows the voice summary in Voices with the full reply folded below.

## 0.7.14 (2026-11-07)

**Voices shows the spoken summary.** A reply with a voice block now shows that summary in the Voices tab, matching what is read aloud, with the full reply in a collapsible "Full reply" below it. Replies without a voice block are unchanged.

## 0.7.13 (2026-11-07)

**Dictate is back as plain speech-to-text.** Press Dictate to start; your words appear above the composer as you speak (Deepgram, the same streamer as Herdr dictation). Press it again to send the text to the agent. It stays visible while Gemini Live is connected, and Live pauses its microphone while you dictate. If sending fails, the text is kept as a draft.

## 0.7.12 (2026-11-06)

Everything since 0.7.5:

- **Gemini Live as a voice companion (0.7.12):** reads agent replies aloud in its own voice, answers questions about a reply without sending anything to the agent, asks "Send that?" when unsure, and handles spoken commands: stop reading, read again, stop the agent, cancel.
- **Reliable sending (0.7.11):** prompts are typed and Enter is pressed separately, so long dictation is no longer swallowed as a paste; a finished dictation is sent after the pause even if Gemini does not submit it; Live sessions resume automatically; Live events are logged to `~/.cache/agl-agent-manager/live.log`.
- **Two-column layout (0.7.10):** agent terminals stay in the first column and voice panes in the second, so switching agents switches tabs instead of creating splits.
- **Status page and session notes (0.7.9):** `agl-notes` skill for Claude and Codex; local status page (pulse icon) with saved comments and Yes/No reviews; Status tab in the voice pane.
- **Extension icon (0.7.8):** AgentLabs logo in the Extensions view.
- **Voice block only (0.7.7):** readout speaks only the `<voice>` summary when a reply has one.
- **Per-agent Skills tab (0.7.6):** switch skills and plugins on or off for one agent via its `.claude/settings.local.json`.

## 0.7.5 (2026-11-05)

Use the existing AgentLabs brand symbol for agent folders in the AGL Agent Folders sidebar.

## 0.7.4 (2026-11-05)

Retrying New Agent with an existing type and name reopens its managed folder. A failed Claude launch offers Trust Workspace and Retry and automatically continues after saving parent workspace trust. Repeated opens share one pending launch. Existing agent folders and history are preserved.

## 0.7.3 (2026-11-05)

Add Trust This Workspace for Claude to the Command Palette and both agent sidebar menus. Trust errors now offer the same action. Saves trust for the canonical parent workspace on the agent host, including SSH, while preserving existing Claude configuration. Does not start or interrupt agents or enable YOLO.

## 0.7.2 (2026-11-05)

Keep the parent workspace open as the single agent-management window. Creating or reopening an agent now launches its terminal and voice pane in the current VS Code window, with the agent process cwd set to its own session folder. The manager scope stays at the parent workspace and refreshes after launch/binding so all managed agents remain listed there. Cross-window launch queues and Open Folder handoffs have been removed.

Creating Claude agent eb-dev from workspace-eb now uses workspace-eb/.sessions/claude/eb-dev with no random folder suffix. Codex agents use the codex directory. All New Agent and YOLO commands use the same current-window flow. Existing folders with suffixes remain supported and are not moved or renamed.

Reveal Agent Folder expands the folder in Explorer without switching workspace. Agent creation still asks only for provider and name; agents add their repository worktrees on demand. Skills GUI is preserved. Native conversation history remains in the provider’s normal storage.

## 0.7.1 (2026-11-05)

Creating a workspace agent now asks only for Claude/Codex and a session name. It creates an empty session folder and launches the agent, with no repository chooser, Git fetch or automatic worktree creation.

A portable helper inside .agl/workspace.cjs lets the agent discover canonical repositories and add only the worktrees required by its task. The generated agent instructions explain the helper and recorded runtime. Worktree addition updates the manifest, preserves existing edits, and rolls back only newly created worktrees on failure. Existing workspace sessions keep their worktrees.

Manage Skills now has a book icon in the main manager toolbar and a command-palette entry, opening the existing Skills GUI.

Validated with 106 passing tests, an isolated VS Code host check, package inspection, and a real SSH test that created an empty session and invoked its helper to add a worktree. Temporary fixtures were cleaned up; no real agent tasks were started.

## 0.7.0 (2026-11-05)

AGL Agent Manager now lists Claude and Codex agents only inside the workspace .sessions directories, including agents in descendant repository folders. Agents in the canonical workspace root or elsewhere are excluded. Existing agents are not moved or stopped.

Workspace Sessions creates .sessions/<agent>/<name>-<id> with selected repository worktrees, then opens that folder and starts the chosen agent. Canonical clones remain on their base branches. Manifests record worktree paths and native conversation IDs; native chat history stays in the agent data directory. Existing session folders from the earlier script are recognized. No companion skill is required or installed for isolation.

Cleanup checks every repository and verifies no agents are running anywhere in the session before removal. Dirty work, unexpected files and symlink escapes block cleanup. Branches and native conversation history are kept. Creation rollback preserves unexpected hook-generated files and reports retained paths.

The new Skills GUI manages workspace and personal folder-based Claude and Codex skills: create, import a folder, edit, enable/disable, and remove after confirmation. Bundled system skills are protected, linked source folders are preserved on entry removal, and unsaved edits block destructive actions. GitHub catalogs and plugin-managed skill packages are outside this first GUI scope.

Workspace and skill operations use Node APIs, with SSH fallback to the VS Code Server runtime. Existing voice helper requirements remain separate.

## 0.6.1 (2026-11-05)

Rename the agent extension to AGL Agent Manager throughout the extension display name, sidebar, command categories, settings, errors, voice page title and documentation.

Existing extension ID, settings, session state and Gemini key storage are preserved, so this updates the installed agent extension.

Validated with all 78 regression tests and VSIX branding checks.

## 0.6.0 (2026-11-05)

Remote SSH launches now explicitly use a local terminal, avoiding a nested SSH connection from the remote workspace. Encoded VS Code host details are decoded, including user and port. Claude, Codex, terminal attachment and daemon commands use Remote.SSH path/configFile settings consistently.

All sessions includes saved interactive Claude conversations and archived Codex threads in the exact selected folder. The view filter offers All, Running, Closed and Hidden. Right-click Hide Session and Restore Hidden Session change only the extension view.

Delete Closed Session requires confirmation and rejects running sessions. Codex uses native permanent deletion, including spawned child sessions. Claude background removal uses the native CLI and may remove its managed worktree; the confirmation states this. Saved interactive Claude conversations remove only session transcripts. Opening an archived Codex thread restores the same thread before terminal launch.

Verified with 78 passing tests, isolated VS Code host smoke testing, native local Claude discovery and VSIX inspection. Remote host routing is covered by test fixtures; the reported target host was not available for a live connection check.

## 0.5.3 (2026-11-05)

The connection button stays visible in the bottom toolbar: green when connected, amber while connecting. Click the connected icon to disconnect.

Live transcription is visible above the composer on every tab, with a bounded scrolling area and a retained last spoken prompt. Action icons remain on one row.

Verified with 69 passing tests, a 320px visual preview, and packaged content checks.

## 0.5.2 (2026-11-05)

All voice actions share one compact bottom toolbar, checked at 320px pane width. Pause and Resume share a position, and redundant Dictate controls hide while Live is connected.

Spoken cleanup removes only redundant repetition and hesitation sounds. Complete dictation is retained when an edit could remove an instruction. Out-of-order Gemini events are buffered; failed sends remain visible as drafts.

Opening an active Codex session attaches normally. Explicit YOLO restart interrupts the selected turn and resumes the same thread.

## 0.5.1 (2026-11-05)

Compact icon buttons for the voice pane.

- Replace connection, microphone, playback, settings, refresh, dictation, interrupt, and send action labels with consistent SVG icons.
- Keep hover tooltips and accessible labels on each action.
- Update the microphone icon and pressed state when muted.
- Keep controls grouped at the bottom.

Install the attached VSIX locally in VS Code and run Developer: Reload Window.

## 0.5.0 (2026-11-05)

Gemini-only natural voice input, reliable reply display, and controls at the bottom.

- Remove Deepgram and external speech hooks. All microphone input now uses conversational gemini-3.8-live.
- Let Gemini recognize complete thoughts and polish grammar and self-corrections before submitting to Claude or Codex. Standalone fillers are not submitted.
- Default to a 3-second thinking pause, with 3/5/custom timing available in settings.
- Disconnect Live after 3 minutes of inactivity. Preserve unfinished dictation in the composer and keep reply readout available.
- Dictate opens Live in Review before sending mode. Auto-send and Send now are also available.
- Populate replies in both tabs independently of auto-speak, connection state, or audio-helper failures. Recheck stale history and replay it when a webview is recreated.
- Group connection status, microphone actions, settings, playback controls, and the composer at the bottom.
- Preserve Gemini TTS and the selected catalog voice for reply readout.

Install the attached VSIX locally in VS Code, then run Developer: Reload Window and reconnect Gemini Live.

## 0.4.1 (2026-11-05)

Fix Codex connections failing with connect ECONNREFUSED 127.0.0.1:80.

A host-supplied HTTP agent could override the WebSocket connection factory and route the daemon handshake to a TCP port. Codex now uses a dedicated HTTP agent pinned to its local or SSH IPC stream.

Install the attached VSIX locally in VS Code, then run Developer: Reload Window.

## 0.4.0 (2026-11-04)

Claude and Codex now share the Agent Sessions sidebar and Gemini voice pane.

- List sessions from both providers in the exact selected local or SSH directory.
- Open Codex sessions in the native terminal using the same thread ID.
- Create Codex sessions, including YOLO sessions, and preserve empty sessions before their first prompt.
- Reuse Gemini TTS, Indian voice selection, dictation, Live transcription, playback and interruption controls.
- Observe Codex history through its shared daemon without sending prompts, forking threads, or changing approval policies.
- Keep one provider usable when the other is unavailable.

Download the VSIX, install it locally in VS Code, and run Developer: Reload Window. Expand Agent Sessions and use + to choose Claude or Codex. If Codex discovery reports no daemon, run Agent Sessions: Start Codex Daemon.

Codex requires the shared daemon API (verified with CLI 0.166.0). Existing active Codex tasks must finish before switching to YOLO mode.

## 0.3.7 (2026-11-04)

The voice pane now shows complete published Claude replies instead of their first sentence or short voice summary.

- Preserve all reply sentences and displayed code text.
- Queue remaining reply text instead of interrupting ongoing automatic readout.
- Skip URLs, URIs, filesystem paths, filenames, and fenced code during speech.
- Retain full visible text when speech skips technical references.

Install the VSIX locally in VS Code and run Developer: Reload Window.

## 0.3.6 (2026-11-04)

Select an Indian female Gemini TTS voice from the voice settings menu.

- Open the gear menu, select TTS voice, then Indian English · Female or Hindi · Female.
- Browse the current Gemini voice catalog by Indian language and gender.
- Search names, accents, pitches, and descriptions.
- Preview or stop a sample before choosing Use this voice. Preview leaves the saved voice unchanged.

Install the attached VSIX locally in VS Code, then run Developer: Reload Window.

## 0.3.5 (2026-11-04)

Configure Gemini from the gear button in the voice pane or Claude Sessions toolbar.

- Select a TTS model, one of 30 voices or a custom voice ID, and speaking style.
- Save or remove the Gemini API key with VS Code secure storage. Saved keys take priority over environment and keys.env for TTS and Live.
- Configure transcription model, microphone behavior, and Python executable.
- Apply TTS changes on the next readout; reconnect Live to apply its configuration changes.

Install the attached VSIX locally in VS Code and run Developer: Reload Window.

## 0.3.4 (2026-11-04)

Claude Sessions & Voice for VS Code.

- List native Claude sessions for the exact local or remote working directory.
- Open sessions with a terminal and voice pane.
- Start or restart existing sessions in YOLO mode.
- Read messages from either tab with streamed Gemini TTS.
- Use Gemini Live transcription to control the selected Claude session by voice.

Download the VSIX below and select Extensions → … → Install from VSIX… in local VS Code, then run Developer: Reload Window. See the README for voice and remote prerequisites.
