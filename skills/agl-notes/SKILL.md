---
name: agl-notes
description: "Keep an AGL session's notes in .agl/ current so the user can see every agent at a glance: STATUS after any turn that changed something, FACTS when a decision, repo, branch, version or rule is learned or stops being true, pages for things the user will review or reopen, and answers to the user's saved reviews. Use in any folder under .sessions/ with an .agl-session.json: at session start, at the end of working turns, when blocked or finished, and when the user says they have reviewed something."
---
<!-- Installed by AGL Agent Manager. Edits are overwritten on update. -->

# AGL session notes

The user oversees many agents at once. They read your notes on a local status page and in the
Status tab of your Voice pane. The notes are the single source of truth: your closing chat reply and
your `<voice>` summary must agree with STATUS. If they differ, fix STATUS first.

All paths are relative to the session folder (the one with `.agl-session.json`).

```
.agl/STATUS.md        snapshot, rewritten whole, at most 40 lines
.agl/FACTS.md         durable truths, edited in place, at most 150 lines
.agl/pages/<slug>.md  topic pages, at most 200 lines each, at most 8
.agl/archive/         retired material; write here, never read unless asked
.agl/reviews.json     the user's saved comments and yes/no verdicts
```

Write only your own session's `.agl/`. Never write secrets, tokens, `.env` values, logs, stack
traces, diffs or command output longer than 5 lines. Name where a secret lives instead.

## STATUS.md

```markdown
---
state: needs-you
headline: Login fix ready; choose token storage before I merge
updated: 2026-11-05 14:20
---
## Needs you
1. **Where should login tokens live?**
   A) httpOnly cookie — safer. B) localStorage — simpler.
   My pick: A. If no answer: I wait; nothing merges.

## Blocked
## Now
## Progress (3/5)
## Done recently
## Links
```

- **state** is exactly one of the following:
  - `needs-you`: you need a decision, review or credential from the user.
  - `blocked`: you are waiting on something outside you both.
  - `working`
  - `done`: verified and handed over.
  - `idle`: no goal, or stopped mid-task.
- An open question to the user always means `needs-you`. Never leave a stale `working`.
- **headline**: at most 80 characters. Outcome or question first. No paths, symbols, branch names or SHAs, because it is read aloud.
- **updated**: local time, set on every write.
- **Sections**: keep this order. Omit empty sections.
  - **Needs you**: at most 3 questions. Each has lettered options, your pick, and what happens if the user stays silent. A question asked in chat must also appear here.
  - **Now**: one or two sentences of outcomes, not narration.
  - **Progress (n/m)**: 3 to 7 milestones the user would recognise. No invented percentages.
  - **Done recently**: at most 5 items, each with a link or `(evidence: …)`. Untested work says "written, not run". Never write "should work".
  - **Links**: every PR, commit, deploy, URL and page, each with a label.
- Rewrite the whole file each time. It is a snapshot, not a log.

## FACTS.md

- Use these sections, in this order: `Repos and branches`, `Decisions`, `Versions and endpoints`, `Rules`.
- Write one bullet per fact, ending with the date it was confirmed, e.g. `- Release only from main (2026-11-05)`.
- Never put progress here.
- When a fact stops being true, replace or delete it in the same turn.
- If the old fact mattered, append it with a date and the reason to `.agl/archive/superseded-facts.md`.
- Never keep an outdated fact.

## Pages

- Make a page for something the user will review or reopen: a design, a plan, an investigation, results. Do not make one for a single turn's scratch work.
- **Name**: kind first, then topic, e.g. `design-token-storage.md`.
- **First lines**: `# Title`, then `summary: <one line>`, then `updated: <date>`.
- Link every page from STATUS → Links.
- **Retire a page** when its question is settled:
  1. Put the outcome in FACTS → Decisions.
  2. Move the page to `.agl/archive/YYYY-MM-DD-<slug>.md`.
  3. Remove the links to it.

## When to write

| Trigger | Write |
|---|---|
| Session start or resume | Read STATUS and FACTS once. List pages with `head -3`. |
| Starting long work | STATUS `working`, Now says what |
| Blocked or a question | STATUS `needs-you` or `blocked` with the exact question |
| Decision, repo, branch, PR, version, URL or rule learned | FACTS |
| End of a turn that changed anything | rewrite STATUS |
| Finished | STATUS `done`; headline says what shipped and where |
| Pure question, nothing changed | nothing |

Do not re-read `.agl/` every turn. Read only the file you are about to change. Keep notes work small
next to the real work.

## Reviews

The user comments and says yes or no on the status page. Their reviews are only **saved**. You see
nothing until the user tells you they have reviewed. Then:

1. Read `.agl/reviews.json`. It holds `{"items":[...]}`.
2. Act on every item with `"status": "submitted"`.
   - Its `page` is `STATUS`, `FACTS` or a page slug.
   - Its `kind` is `comment`, `yes` or `no`.
3. For each item, set:
   - `"status": "answered"`
   - `"answer"`: one or two plain sentences saying what you changed or why not.
   - `"answeredAt"`: an ISO time.
4. Rewrite the file whole: write a temp file, then rename it over `reviews.json`. Keep every other item and field unchanged.
5. Never set `confirmed`. Only the user confirms, on the page.
6. Update the reviewed page and STATUS to match.
