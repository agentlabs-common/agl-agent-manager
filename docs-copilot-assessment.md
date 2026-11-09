# Copilot provider assessment

GitHub Copilot CLI is viable as a fourth AGL provider. The first adapter targets local workspaces and CLI 1.0.108 and bundled headless runtime 1.0.105 / SDK protocol 3. It keeps the real Copilot terminal and uses the CLI's standard framed SDK transport for lifecycle operations. It reuses AGL's team, workspace, portal and voice UI.

| Feature | Candidate support | Remaining qualification |
| --- | --- | --- |
| Create, discover, resume | Implemented; native lifecycle checked | Only local sessions; cloud sessions excluded |
| Native terminal, send, Interrupt | Shared terminal UI | Manual VS Code extension-host test still needed |
| Stop, delete, YOLO restart | Native delete; owned terminal/process control | Stop refuses a process it cannot identify safely |
| Teams, hide, filters, worktrees | Existing AGL management | Normal workflow regression tests cover Copilot |
| Notes and Status | Shared local Markdown/rich-status UI | Full interactive rich page remains in portal |
| History, readout, Notes extracted from replies | Native persisted event reader | Copilot transcript events are version-sensitive |
| Gemini Connect, voice, dictation | Shared AGL controls | Linux voice requirements remain; live dictation still needs a usable Deepgram credential |
| Skill enable/disable | Native Copilot switches, verified with isolated settings | These switches are account-wide. Agent-folder-only switches still need a supported session/terminal bridge |
| Running/closed state | AGL terminal tracking and native process inspection | Ambiguous external runtimes are displayed conservatively; detailed busy/permission/unread transitions are not full parity |
| Allowed messages and listener | Shared portal contacts and inbox | Running agents must keep their listener active; no duplicate prompt is injected into a busy terminal |
| Wake a stopped Copilot agent | Implemented; native allowed-message test passed | Resumes recorded ID only. Hold, contact withdrawal, cooldown, failure backoff and concurrent-portal locks apply |
| SSH / remote Copilot | Not implemented | Requires remote runtime, activity and transcript integration, with actual SSH tests |
| Copilot-only terminal dialogs | Available in its native terminal | No promise that every Copilot TUI dialog can become a dashboard button |

## Wake behavior

The portal checks for messages every 20 seconds. A stopped Copilot seat with a recorded conversation and an allowed sender can resume in background prompt mode. The message is supplied on stdin as data, not as a new user instruction or a command-line argument. No YOLO or allow-all flag is added; Copilot's own saved approvals govern tools. Messages are marked read after a successful response. A long-running wake is shown as started until completion, rather than as confirmed delivery.

A running agent consumes messages through its existing AGL listener. If activity is ambiguous, automatic waking is skipped. The adapter will not manufacture a conversation when its binding is missing. The existing five-minute cooldown and exponential failure backoff remain. Automatic stopped-agent waking currently supports Claude and Copilot; Codex and Kimi still need their own wake adapters.

## Evidence

On this Linux machine, native authentication, creation, discovery, resume, history, disconnect and deletion passed. One harmless licensed Copilot chat passed and appeared in readout history. Isolated skill switches passed enabled/disabled/enabled. A separate isolated allowed-message test resumed the same native conversation, received a response, marked the tested inbox read, and left no real agent messages or fixture conversations behind.

Automated checks cover owned-terminal stop, identity and scope validation, transcript changes, provider routing, native protocol framing, hold, withdrawal, failures and duplicate wake prevention. Windows and macOS native Copilot operation, physical audio, manual VS Code interaction and full permission-dialog badges are not certified by those Linux checks. This candidate is not installed or released.

Repeatable native probes: `scripts/audit-native-copilot.cjs` (optional `--chat`) and `scripts/audit-native-copilot-wake.cjs --chat`. Chat checks use the configured Copilot subscription; metadata and isolated skill checks send no model prompt.

## Official references

- [SDK/CLI feature mapping](https://docs.github.com/en/copilot/how-tos/copilot-sdk/troubleshooting/compatibility): session operations, history, abort, events, skills and native-only dialogs.
- [SDK session lifecycle](https://github.com/github/copilot-sdk/blob/main/docs/features/session-persistence.md): persistence, resumption and deletion semantics.
- [Copilot skill management](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills): native skill commands and reload behavior.
- [Copilot settings](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference): account and repository configuration scopes.

Full parity is feasible for most AGL features, but per-agent terminal skill settings, exact external activity/permission events, remote execution and native UI coverage remain explicit follow-up work. SDK support alone is not proof of safe attachment to every independently running terminal.
