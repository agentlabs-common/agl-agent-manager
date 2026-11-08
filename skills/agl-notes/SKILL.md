---
name: agl-notes
description: "Keep an AGL session's pages on the agent portal current so the user can see every agent at a glance: the status page (STATUS.html) after any turn that changed something, FACTS when a decision, repo, branch, version or rule is learned or stops being true, pages for proposals and designs the user will review, and answers the user gives on pages, by voice or in chat. Use in any folder under .sessions/ with an .agl-session.json: at session start, at the end of working turns, when blocked or finished, and when the user answers or reviews something."
---
<!-- Installed by AGL Agent Manager. Edits are overwritten on update. -->

# AGL session notes

The user oversees many agents at once. They read your pages on the **agent portal** (the local status
page) and in the Status tab of your Voice pane. Your pages are the single source of truth: your
closing chat reply and your `<voice>` summary must agree with your status page. If they differ, fix
the page first.

All paths are relative to the session folder (the one with `.agl-session.json`).

```
.agl/STATUS.html        your status page: free HTML, with an index card (below)
.agl/FACTS.md           durable truths, edited in place, at most 150 lines
.agl/pages/<slug>.html  proposals, designs, results, guides: free HTML (or .md), at most 8
.agl/archive/           retired material; write here, never read unless asked
.agl/reviews.json       the user's saved answers and comments (written by the portal)
```

Write only your own session's `.agl/`. Never write secrets, tokens, `.env` values, logs, stack traces,
diffs or command output longer than 5 lines. Name where a secret lives instead.

## How pages are shown

- The portal shows your HTML in a sealed sandbox: no network, no forms, no navigation. It injects a
  **kit** first: house styles and a small script. Use it as much as you like:
  `.agl-page`, `.agl-card` (`.attention` for what needs the user), `.agl-row`, `.agl-grid`,
  `.agl-chip` (`needs-you`, `working`, `done`, `blocked`, `idle`), `.agl-decision` (with `.agl-from`,
  `.agl-q`), `.agl-btn` (`.primary`), `.agl-table`, `.agl-timeline` (`<li><time>…</time><span>…</span>`),
  `.agl-figure` (an inline `<svg>` plus `<figcaption>`), `.agl-muted`, `.agl-scroll`.
- **Buttons only ask.** `<button class="agl-btn" data-agl-ask="approve" data-agl-question="Q7"
  data-agl-choice="A" data-agl-label="what is being approved">` makes the portal show its own box
  with that text; only the user's click there records it. `data-agl-ask="comment"` asks for a
  comment. You cannot approve anything yourself.
- Every `.agl-decision` gets a **Listen** button that reads it aloud, generated live. Write the
  question so it makes sense when heard.
- Answered questions are marked on the page at once by the portal ("You chose A · waiting for the
  agent"); you still record the answer yourself (below).
- Diagrams are inline SVG with a `viewBox`, `role="img"` and an `aria-label`.

## The status page

Free HTML, but what it **says** is fixed:

1. **Index card in `<head>`:**
   ```html
   <title>Status</title>
   <meta name="agl:state" content="needs-you">
   <meta name="agl:headline" content="Agent portal: status page built; review the guide">
   <meta name="agl:updated" content="2026-11-08 12:25">
   <meta name="agl:reports-to" content="hrms-lead">   <!-- seats with a lead only -->
   ```
2. **State** is exactly one of: `needs-you` (you need a decision, review or credential), `blocked`
   (waiting on something outside you both), `working`, `done` (verified and handed over), `idle` (no
   goal, paused or stopped). An open question means `needs-you`. Never leave a stale `working`.
3. **Headline:** the outcome or the question, at most 80 characters, starting with the work's name.
   It is read aloud: no paths, symbols, branch names or SHAs.
4. **Time comes from the clock** (`date '+%F %H:%M'`), never from memory, for `agl:updated` and
   every time on the page.
5. **Needs you** first: at most 3 open questions, each in an `.agl-decision`.
6. **Organise by work.** One card per piece of work the user gave you, named with the user's own
   term. Each card: a one-line goal, state, progress (3 to 7 milestones the user would recognise, no
   invented percentages), its questions, its proposals, what was delivered, and the next step.
   Parked or finished work collapses to one line saying why.
7. **Questions belong to a work item.** Each has an ID (`Q7`), when and where it was asked, lettered
   options, your pick, and what happens if nobody answers. Ask it in your `<voice>` summary too.
   When the user answers, on a page, by voice or in chat, move it to answered with the answer and
   the time in the same turn, then carry on.
8. **Delivered means proven:** each item has evidence (a commit, a test count, a URL, a
   screenshot). Untested work says "written, not run". Never "should work".
9. **Workspace:** everything you run (servers, stacks, ports, preview links), each with its health
   and since when. Stop what you no longer need.
10. **History:** append-only, newest first, one line each: `TOOK` (from whom), `DELIVERED`
    (evidence), `DROPPED` (why).
11. **Short at the top:** the first screen answers "what is happening, and what do you need from
    me?" Detail goes in pages.

Rewrite the whole status page each time. If you still keep an old `.agl/STATUS.md`, `STATUS.html`
wins; keep the two from disagreeing, or delete the old one.

## Proposals and other pages

- Make a page for something the user will review or reopen: a proposal, a design, a plan, results,
  a guide. Not for a single turn's scratch work.
- **Name:** kind first, then topic: `proposal-token-storage.html`, `design-agent-portal.html`.
- **Index card:** `<title>`, `<meta name="description">` (one line), `<meta name="agl:kind">`,
  `<meta name="agl:updated">`. A Markdown page instead starts with `# Title`, `summary:`, `updated:`.
- Explain plainly, for a person reading it once; use SVG diagrams wherever a picture beats ten lines.
  Say what the user is asked to decide. Link the page from its work card.
- **What the user approved does not move.** A change to an approved page is a new version, with the
  change stated at the top.
- **Retire a page** when its question is settled: the outcome goes in FACTS → Decisions, the page
  moves to `.agl/archive/YYYY-MM-DD-<slug>.html`, and its links go.

## FACTS.md

- Sections, in this order: `Repos and branches`, `Decisions`, `Versions and endpoints`, `Rules`.
- One bullet per fact, ending with the date it was confirmed: `- Release only from main (2026-11-05)`.
- Never put progress here. When a fact stops being true, replace or delete it in the same turn;
  if it mattered, append the old one with a date and reason to `.agl/archive/superseded-facts.md`.

## When to write

| Trigger | Write |
|---|---|
| Session start or resume | Read your status page and FACTS once; list pages by their index card. |
| Starting long work | status `working`; the work card says what |
| Blocked or a question | status `needs-you` or `blocked`, with the exact question |
| The user answers (page, voice or chat) | the question moves to answered; FACTS → Decisions; carry on |
| Decision, repo, branch, PR, version, URL or rule learned | FACTS |
| End of a turn that changed anything | rewrite the status page |
| Finished | status `done`; the headline says what shipped and where |
| Pure question, nothing changed | nothing |

Do not re-read `.agl/` every turn. Read only the file you are about to change. Keep notes work small
next to the real work.

## Answers and reviews

The portal saves what the user does on your pages in `.agl/reviews.json` as `{"items":[...]}`.
Approvals arrive as `"kind": "yes"` with text like `Q7: A — what was approved`; comments as
`"kind": "comment"`. Read it at the start of each turn when the user says they answered, and when your
status page asks something. Then:

1. Act on every item with `"status": "submitted"`. Its `page` is `STATUS`, `FACTS` or a page slug.
2. Set `"status": "answered"`, `"answer"` (one or two plain sentences: what you changed or why not)
   and `"answeredAt"` (ISO time).
3. Rewrite the file whole: write a temp file, then rename it over `reviews.json`. Keep every other
   item and field unchanged. Never set `confirmed`: only the user confirms.
4. Update the page and the status page to match.
