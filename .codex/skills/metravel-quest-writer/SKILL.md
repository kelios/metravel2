---
name: metravel-quest-writer
description: >-
  Research, write, validate, and optionally publish new or substantially rewritten metravel city quests.
  Use for requests such as "write a quest for a city", "create/add a quest", or "replace a quest story",
  including family and children's quests split by age, fairy-tale or interactive routes, route design,
  intro/steps/finale, observable tasks, hints, answer patterns, local quest data, and migration preparation.
  Do not use for quest UI code, a small edit to an existing quest, or coordinate-only review.
---

# Metravel Quest Writer

Create an evidence-based walking quest that reads as one story and can be represented by the existing metravel quest contract.

## Read first

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/README.md`
- `.claude/skills/metravel-quest/SKILL.md` when present; use it as the detailed legacy authoring reference, while newer project rules and this skill win on conflicts.
- `references/child-quest-design.md` for any child, family, fairy-tale, park, amusement, or teen quest; select one primary age band before route or story design.
- The nearest current `scripts/*-quest-data.js`, migration script, quest API types, and `utils/questAdapters.ts` before producing repository data.

## Authority gate

- Writing or creatively rewriting quest prose, titles, stories, tasks, hints, or finale requires a separate explicit confirmation question under `AGENTS.md`, even if the initial request appears direct. Stop before authoring until that confirmation is received.
- Research, duplicate checks, contract inspection, route analysis, and a non-creative outline may proceed before confirmation.
- Treat draft creation, repository changes, API publication, and media upload as separate actions. Do not publish, patch production, or upload media unless the user explicitly requests that action.
- Keep tokens in approved env/secret files and never print them. Take an ignored rollback snapshot before changing an existing remote quest.

## Route and story contract

- Check `GET /api/quests/` and `GET /api/quests/by-quest-id/<quest_id>/` before creating anything. Reuse the existing quest and stable identifiers when the city or `quest_id` already exists.
- Build 8–12 meaningful must-see steps in a walkable sequence without backtracking. For a child quest, use the shorter age-specific limits in `references/child-quest-design.md` instead of padding the route to 8 steps. Put optional stops only where they naturally fit; do not make them blocking.
- Check real pedestrian feasibility, access restrictions, opening hours, unsafe crossings, seasonal closures, and whether a place can actually be observed from the public route. State accessibility or schedule limitations instead of hiding them.
- Give the quest one narrative thread. The intro establishes the theme and direction, each step advances it with a transition to the next place, and the finale closes the arc.
- Write as an engaged human guide: concrete, concise, on `ты`, without boilerplate, bureaucratic phrasing, emoji, or generic headings.
- Distinguish verified history from local legend. Do not invent quotations, people, events, etymologies, architectural details, or visible features.
- Verify current facts with web research. Prefer official venue/city sources, heritage registers, museums, primary documentation, and reputable reference sources; keep source URLs in an ignored working artifact.
- Optional museums, viewpoints, cafes, or themed stops must include verified hours and an official site when available. Mark hours as time-sensitive and recheck them before publication.

## Step quality contract

Each main step must contain `title`, `location`, `story`, `task`, `hint`, `answer_pattern`, `lat`, `lng`, and `mapsUrl`.

Use a task only when all are true:

1. The answer is unambiguous and verified.
2. The player can observe it while standing at the point.
3. The story and hint do not reveal it.
4. The observed object is stable across season, viewpoint, and routine maintenance.

Prefer tasks that ask the player to:

- identify a distinctive symbol, object, person, animal, dish, or local feature;
- read a clearly visible date, name, or inscription verified from reliable imagery;
- find a stable hidden detail;
- identify what a monument or relief depicts or symbolizes.

Avoid unstable counting, obscure architectural terminology, subjective shapes or levels, internet trivia, and facts invisible on site. If no reliable observation question exists, use one purposeful `any_text` reflection instead of a brittle quiz. One or two reflective steps per quest are acceptable.

Hints direct attention but never contain the answer, a synonym, a partial phrase, an exact count, or an answer range. Check answer tokens against `title`, `location`, `story`, and `hint` before handoff.

## Answer patterns

- `any`: intro, navigation-only, or optional pause.
- `exact`: one indisputable short value, usually a number or year.
- `exact_any`: a stringified JSON array of accepted words/phrases; include lowercase inflections, synonyms, local names, and transliterations that the normalizer should accept.
- `range`: a stringified `{ "min": n, "max": n }` for verified counts of 3 or more, normally with only ±1 tolerance.
- `any_text`: a stringified `{ "min_length": n }` for a genuine reflective response.
- `any_number`: any numeric observation when the exact number is intentionally irrelevant.
- `approx`: a stringified `{ "target": n, "tolerance": n }` only when an approximate measurement is the actual task.

Match the task grammar to the checker. A prompt asking for a number must not use a text minimum that rejects a one-character answer. Respect the current normalization in `buildAnswerChecker`: lowercase, collapsed whitespace, punctuation removal, and `ё` → `е`.

## Data and identity

- Follow the nearest current data shape instead of relying on memory. The expected quest-level fields include `quest_id`, `title`, `city`, `meta`, `storage_key`, `intro`, `steps`, and `finale`.
- Use stable kebab-case `quest_id` and `step_id`. Never change `quest_id`, `step_id`, or `storage_key` for an existing published quest unless a separately approved migration explicitly requires it.
- Keep `order` equal to the real walking order. Reordering an existing quest must preserve step identity and use the repository's collision-safe two-phase order update.
- Use decimal coordinates and coordinate-based Google Maps URLs when that is the current project convention.
- Confirm the country contract and the matching ISO code/Russian label in the catalog helpers before adding a country that is not already represented.

## Workflow

1. Classify the request as outline, authored draft, repository implementation, existing-quest rewrite, or publication. For child/family scope, also set one primary age band and classify the route as public walk, ticketed venue, or hybrid.
2. Pass the authority gate before writing creative content.
3. Check for duplicate city/quest entries and inspect the current API/data contract.
4. Research candidate places and sources; select the narrative theme and public walking route. For child/family scope, audit age fit, adult accompaniment, toilets/rest points, road and water hazards, paid or booked access, seasonality, and a weather fallback.
5. Order the route, estimate realistic duration/distance, and remove backtracking or inaccessible detours.
6. Draft intro, the general 8–12 steps or the selected child-band step count, optional non-blocking stops, and finale.
7. Audit every fact, transition, task, hint, and answer pattern. Record unresolved uncertainty instead of inventing content.
8. Hand coordinates to `$metravel-quest-geo-verifier`; run `scripts/quest-geocheck.js` when available and resolve every real WARN/FAIL before publication.
9. When repository implementation is requested, use the current data/migration pattern and route code/contract changes to `$metravel-quest-expert`. Keep the migration idempotent and perform its documented dry run.
10. Validate data parsing, nested JSON values, unique IDs/orders, route continuity, answer leakage, and GET payload shape.
11. Publish only when explicitly requested, then re-fetch the quest and verify the authenticated mobile flow and printable view. Media/finale video is a separate requested workflow.

## Handoff

Return a compact `Quest Writer Handoff` with:

- mode completed: outline, draft, repository data, or published;
- quest id, city, theme, primary age band, venue model, step count, route direction, and estimated duration;
- fact/source coverage, question-quality audit, answer-pattern audit, and geo result;
- changed files or remote objects, rollback snapshot when applicable, validation run, and blockers.

Route small edits to existing quest content to `$metravel-quest-editor`, quest UI/code to `$metravel-quest-expert`, and coordinate-only work to `$metravel-quest-geo-verifier`.
