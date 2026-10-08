---
name: metravel-instagram-editor
description: "Prepare or audit Instagram @metravelby posts, captions, carousels, Reels, weekly content packs and metrics using author-1 articles or project quests. Use for today's post, a content plan, an approved scheduled-post edit or a weekly review."
---

# Instagram Editor

Use `docs/INSTAGRAM_PLAN.md` as the strategy/calendar owner. Read the relevant
date row and headings `Цель и аудитория`, `Тематические подборки`, `Расписание
публикаций: где смотреть и как ставить`, or `Производство роликов` as needed.
Where historical rows conflict, use the latest explicit owner decision; an old
approval recorded in the plan is not authorization for a new publication.
For examples of scoped requests, read [references/prompts.md](references/prompts.md).

## Identify and source

- Resolve "today" from the client date and `Europe/Warsaw`. Read the actual
  browser post when the user refers to an open editor: account, first caption
  line, complete carousel, schedule date/time. A screenshot identifies a
  candidate; verify live state before changing it.
- Travel content: public `GET https://metravel.by/api/travels/<id>/` must show
  `userIds == "1"`, `publish == true`, `moderation == true`. Lists are discovery;
  detail is confirmation. Never substitute guest material.
- Project quests: `GET https://metravel.by/api/quests/` (follow pagination), then
  `GET https://metravel.by/api/quests/by-quest-id/<quest_id>/`. Confirm title,
  city, intro, ordered steps, finale and public quest URL.
- Extract each claim from its source field. Durations, counts, prices and
  distances need a quoted source fragment in the working source manifest.
  Contradictory/unavailable claims stay out of the pack until resolved.
  Legends are presented as legends. Do not reveal answers to quest tasks.
- Match each photograph to the depicted place using its caption and visual
  inspection. Personal archive material must belong to the same trip; do not
  invent identities or a personal visit. For visual changes add
  `$metravel-instagram-visuals`.

## Produce the requested scope

Prepare assets yourself using inspected existing tools and media. Do not ask
the owner to select frames or assemble the post. Missing access/source footage
is a concrete blocker, not an invitation to fabricate media.

- `audit` / `brief`: actual scheduled post, source, mismatch per slide and a
  concrete repair recommendation; do not rewrite captions in an image-only task.
- `carousel` / `pack`: slide sequence, hook, caption, single CTA, geotag and
  source manifest. Preserve the plan's current geography/season strategy.
  Russian captions, place-first hook, 3–5 hashtags including `#metravel`;
  choose length and slide count to fit the topic, not a fixed template.
- `reel`: live footage from the same trip and the relevant
  `docs/INSTAGRAM_REELS_BRIEF.md` sections. No slideshow substitute for a Reel.
- `review`: explicit absolute period; inspect `scripts/instagram-insights.js`
  usage before running it, or read visible Insights via CUA. Report missing
  metrics as missing, distinguish measured effects from causal hypotheses.

Store outputs and raw evidence under ignored `.codex-temp/instagram/<date>/<topic>/`.
Keep ordered final files, caption, source manifest and reproducible visual
prompts together. Read current `scripts/instagram/make-carousel.py` interface
before building a spec; never invent parameters. Update only the relevant plan
rows when maintaining the calendar is in scope.

## Account actions and verification

Use `mcp__cua_repl` to select the existing Instagram browser tab, following its
returned API documentation. Screenshot/text/DOM evidence drives each UI action;
do not guess selectors or invoke private Instagram endpoints. Do not log
cookies/tokens, read `.secrets`, or expose personal account data in artifacts.

Publication, new scheduling, deletion, archive, comments, likes, follower
cleanup and DMs are separate actions: require the user's explicit instruction
for that action. A request to remake images authorizes generation and preparation;
when it also authorizes editing the specific scheduled post, preserve its
caption, account, slide order and time. Do not auto-delete/recreate the post or
create a backup publisher. If the UI lacks media replacement, retain the
schedule and return ready files plus the precise missing action for approval.

Before an authorized save, compare account/post identity, files/count/order,
caption and date/time with the original. After save, reopen and verify that the
same scheduled entry contains the expected change. On uncertain mutation outcome,
check state before retrying; on challenge/429 stop and report the action.

Handoff: preview/files, actual changed account state (or explicit unchanged
state), sources, visual review results, and the remaining blocker if any.
