---
name: metravel-instagram-editor
description: "Prepare or audit Instagram @metravelby posts, captions, carousels, Reels, weekly content packs and metrics using author-1 articles or project quests, following the planner → researcher → creator → visual-qa → operator role split. Use for today's post, a content plan, an approved scheduled-post edit or a weekly review."
---

# Instagram Editor

The Instagram chain has five roles; their contracts live in `.claude/agents/instagram-*.md`
and are the single source for Codex too. Read only the role you are performing, and do not
copy rules into this skill:

| Step | Role contract | Writes in the post package |
| --- | --- | --- |
| 1. Topic and date | `.claude/agents/instagram-planner.md` | `brief.md`, calendar row in `docs/INSTAGRAM_PLAN.md` |
| 2. Facts | `.claude/agents/instagram-researcher.md` | `sources.md`, `article-edits.md` |
| 3. Slides / Reel / caption | `.claude/agents/instagram-creator.md` | `slides/`, `spec.json` or `slides.txt`, `caption.txt`, `package.md` |
| 4. Review | `.claude/agents/instagram-visual-qa.md` | `qa.md`, `qa-sheet.jpg` |
| 5. Schedule, publish, metrics, follower cleanup | `.claude/agents/instagram-editor.md` + `docs/INSTAGRAM_OPERATIONS.md` | `published.md` |

The package folder, its file contract and the QA round limits are in
`docs/INSTAGRAM_CONTENT_SPEC.md` section 0; MeTravel C is in section 17; voice and form rules
are V1–V11 and F1–F13 in section 18. Select personal diary, quest adventure (section 3), or
site-action mode (section 2) before drafting; owner hard rules are in section 25; references are
section 26. For examples of scoped requests, read [references/prompts.md](references/prompts.md).
For visual changes add `$metravel-instagram-visuals`.

## Non-negotiables

Read `docs/INSTAGRAM_CONTENT_SPEC.md` section 27 before every content or account task: it is
the canonical music/media rights policy for all five roles. Require asset-by-asset hashed
`rights.json` evidence and its gate before any upload, rehearsal, schedule or publication;
use silence as a working base or checked own voice/nature when music rights are unproven.
Final silence requires the owner's explicit request and the F11 record from section 27;
otherwise an uncleared track blocks handoff to QA and scheduling. For existing posts
report cleared/unknown/restricted and audit coverage; unknown is neither illegal nor cleared.

- Sources and product mechanics follow section 25: author-1 articles, project quests and
  verified UI/code/API evidence. Record claims in `sources.md`; exclude spoilers (F10).
- Draft the coherent story before slides, with voice and editorial scope from V1–V4/V11;
  a product invitation must not invent a personal visit or playthrough.
- Before handing a package to review: `python3 scripts/instagram/lint-package.py <package>` exits
  0; Belarus packages also pass `node scripts/scan-content-sources.js <package>` with zero hits.
  The reviewer runs both again first.
- On request only (owner, 11.10.2026): nothing is scheduled in `scheduled_content` or published
  without the owner's command for that post and that day, after she saw it in chat and on the
  афиша. An approval recorded in the plan or given for another post is not authorization.
- Hashtags: 3–5 relevant ones as the last paragraph, with a Polish geo hashtag for Poland
  (F8); there is no mandatory brand hashtag.
- Calendar rows belong to the planner; the operator writes only the weekly-review and cleanup
  tables.

## Account actions and verification

Use `mcp__cua_repl` to select the existing Instagram browser tab, following its returned API
documentation; the tab is the owner's logged-in session. Screenshot/text/DOM evidence drives each
UI action; do not guess selectors or invoke private Instagram endpoints. Do not log
cookies/tokens, read `.secrets`, or expose personal account data in artifacts. Scheduling steps
(visible tab, real clicks, select-all before paste, caption counter N/2200 checked against
`len()`, at most 29 days ahead) are in `docs/INSTAGRAM_OPERATIONS.md` §3.

Publication, new scheduling, deletion, archive, comments, likes, follower cleanup and DMs are
separate actions: require the user's explicit instruction for that action. A request to remake
images authorizes generation and preparation; when it also authorizes editing the specific
scheduled post, preserve its caption, account, slide order and time. Do not auto-delete/recreate
the post or create a backup publisher. If the UI lacks media replacement, retain the schedule and
return ready files plus the precise missing action for approval.

Before an authorized save, compare account/post identity, files/count/order, caption and
date/time with the original. After save, reopen and verify that the same scheduled entry contains
the expected change. On uncertain mutation outcome, check state before retrying; on
challenge/429 stop and report the action.

Handoff: preview/files, actual changed account state (or explicit unchanged state), sources,
lint and review results, and the remaining blocker if any.
