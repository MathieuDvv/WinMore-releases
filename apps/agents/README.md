# Agent Watch

Install this folder through WinMore PC Settings → Apps → Install folder, or install the packaged `Agent-Watch-1.2.1.wmapp`. It uses the existing Kit screen and paired transport. Neither the PC companion nor the iPhone needs rebuilding. Enable Agents in the phone's navigation settings if its rail is full. The screen uses fullscreen chrome, which removes the shared music volume slider.

Version 1.2.1 moves the dashboard gradient from an inset content rectangle to Kit's app-wide backdrop, including the area behind the top controls and outer content margins. The bundled low-saturation palette gives a soft charcoal/slate wash. Provider tiles use restrained translucent fills; completion and permission colors are muted. Focused pages use a matching uninterrupted dark surface instead of another inset gradient panel. The existing WinMore navigation bezel remains controlled by the host.

Version 1.2 uses dark gradients with provider accents and removes the decorative dashboard headings. The focused view's back button, agent name and status sit in Kit's fixed bar above the scroll area. Repeated connection errors hide after eight seconds; the current error stays available under the information button. A recovered connection resets that timer for a future outage.

## Live progress and outputs

- Codex: reported `update_plan` steps and successful file-writing tools from hooks or the bounded transcript tail.
- Claude Code: `TodoWrite`, `TaskCreate` and `TaskUpdate` metadata, successful Write/Edit tools, and task files scoped to that session under `~/.claude/tasks/<session-id>`. The hook also respects `CLAUDE_CODE_TASK_LIST_ID` when set by the agent process.
- OpenCode: V1 todos and successful tool metadata; V2 tool metadata and published artifact metadata when the experimental artifacts API is enabled. Optional progress APIs failing do not break basic monitoring. Up to six listed sessions are sampled, cached for five seconds. No experimental feature is enabled by Agent Watch.

The focused view shows the reported checklist and completed-step count, plus artifact/file names and paths that can be copied. These are reported progress and output references, not estimates of task completion or a general file browser. File contents and arbitrary shell output are not captured. Local artifact URLs are copied as references; they are not rewritten into phone-accessible URLs or executed. If an agent does not expose a plan, those sections stay hidden. Linked outputs in assistant messages can also be found in the bounded transcript tail. Older events outside that tail may not be available.

**When upgrading from 1.1:** choose Enable hooks again for each configured provider to refresh the standalone bridge and its progress helper. Review changed hooks in Codex if requested. The existing hooks still provide activity monitoring before this refresh; transcript-derived progress updates are best effort and may lag by ten seconds.

Version 1.1 adds a cream canvas, lavender/coral/mint provider tiles with packaged logos, larger timers, a task detail view, and a separate finished section. Completion banners appear when an observed task changes to Completed and remain until acknowledged. The last 20 notifications are saved locally across app reloads; old completed sessions do not trigger startup alerts. Interruptions and lost connections do not generate success banners. These are in-app banners, not background iOS push notifications. OpenCode V1 idle sessions appear as finished; V2 uses the explicit session outcome. Both require the server to keep the finished session in its listing.

The screen shows multiple agents together: provider, model when available, latest task, project folder, elapsed time, status and current tool. It offers only **Approve once** and **Decline** for pending tool permissions. There is no message composer, arbitrary command execution endpoint, or agent-start endpoint.

## Codex and Claude Code

PC Settings → Agent Watch → Enable the provider's hooks. This adds only WinMore-owned entries to `~/.codex/hooks.json` (respects `CODEX_HOME`) or `~/.claude/settings.json`, preserving existing settings and saving timestamped backups. Node.js must be on the agent's PATH. Codex requires review/trust in Settings → Hooks or `/hooks`. Claude Code may need a new session to pick up the changed settings. Remove buttons remove only WinMore's hook entries. Disable hooks before uninstalling Agent Watch.

Hooks run a standalone copy of the bridge stored in Agent Watch's data folder, so hot reloads and package updates don't invalidate the script path. Events and decisions use a private local spool; the phone uses WinMore's existing authenticated transport. Only the specific pending invocation can consume a decision, and Allow grants it once without changing permission rules. Other hooks and the agent's own policy still apply.

Permission requests wait up to 110 seconds. If WinMore stops or no answer arrives, the bridge returns without a decision and the agent continues its usual PC approval flow. Questions and plan editors requiring structured answers stay on the PC. Oversized requests cannot be remotely approved. Approvals already displayed before hook setup cannot be taken over. Hook availability depends on the installed agent version; the app does not modify or rebuild the agents. This integration is for **Claude Code**, not ordinary Claude Desktop conversations.

Before hooks are enabled, bounded reads of recent Codex and Claude Code session logs can show recent tasks. These rows explicitly say their status may be delayed; log activity does not establish that a process is alive. A missing heartbeat from a hooked session changes Running to Status unknown after three minutes. Elapsed time starts at the latest prompt when known; completed turns stop their timer. Session logs are an undocumented fallback and may change.

## OpenCode

Connect to the **existing** TUI/server in PC Settings → Agent Watch. For a predictable endpoint, launch that TUI with `opencode --port 4096`, then use `http://127.0.0.1:4096`. A TUI launched on a random port needs that actual address. Starting `opencode serve` separately creates another server and does not attach to an already running TUI.

Supports V1 session/status/permission endpoints and V2 `/api/session`, `/api/session/active` and session permission replies. Only loopback HTTP addresses are accepted. Passwords are encrypted using Electron safeStorage and never sent to the phone. Reconnect with the new password after changing the server's credentials. Elapsed time here is since session creation, as labelled. One configured OpenCode server is followed at a time. Its API must expose the sessions being monitored; API/schema changes are reported as connection errors.

## Data and validation

Task excerpts (up to 2,000 characters), project paths and permission details reach paired devices while this screen is open. Transcript reads are bounded to 24 recent sessions per provider, with a 256 KB tail per file; older prompts outside that tail may not appear. Hook events are pruned after 24 hours. No agent credentials or full transcripts are shared. Normal WinMore pairing/network requirements apply.

Run `node --test tests/agents.test.cjs` and `node scripts/check-apps.cjs apps/agents` from the repository. Tests cover configuration preservation, real hook subprocess decisions/fallback, stale/invalid command rejection, transcript discovery and mocked V1/V2 API contracts. Native phone rendering and live agent approval flows still need testing on target devices.

Protocol references: [Codex hooks](https://learn.chatgpt.com/docs/hooks), [Claude Code hooks](https://code.claude.com/docs/en/hooks), [OpenCode V1 server](https://opencode.ai/v1/docs/server/), [OpenCode current API](https://opencode.ai/docs/api).
