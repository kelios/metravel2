## Context

Two SEO operator scripts walk `/api/travels/` page by page. `scripts/seo-fix-links.js`
was corrected under #1755; `scripts/index-status.js` still carries the original
short-page heuristic. The endpoint is DRF `PageNumberPagination`, whose answer is
`{count, next, previous, results}` and whose page *after* the last one is
`HTTP 404 «Invalid page»`. Both scripts turn a non-200 into a thrown error, so the
short-page heuristic is not merely imprecise — on a count that is an exact multiple
of the page size it is fatal.

The backend also clamps the page to 100 records and ignores a larger `perPage`
(probe 01.09.2026, recorded in `scripts/verify-static-travel-seo.js`), so 100 is
not a free parameter.

## Goals / Non-Goals

**Goals**

- One reader owns the end condition, so a third caller cannot reintroduce the
  short-page heuristic by copying a loop.
- `scripts/index-status.js` finishes the list at any item count.
- The end condition is provable in tests against a stub that behaves like
  production, including the `404`.

**Non-Goals**

- Rewriting `scripts/seo-fix-links.js` onto the shared reader: its copy is correct
  and its file belongs to #1755, still in progress.
- Touching `scripts/seo-audit.js`, `scripts/seo-find-dupes.js` or
  `scripts/seo-mass-augment.js`, which hold the same latent copy — follow-up card.
- Any change to the endpoint, the report, or the CLI surface.

## Decisions

### Shared reader in `scripts/lib/`, not a copied loop

`scripts/lib/` already holds the cross-script helpers the SEO tools reuse
(`fetchJson`, `httpText`, `seo-cli-contract`, `travelSlug`). A new
`scripts/lib/pagedList.js` exporting `TRAVELS_PER_PAGE`, `pickListRows` and
`readPagedList` puts the end condition in one documented place. The reader is
transport-agnostic: it takes a `fetchPage(page)` callback, so each script keeps its
own HTTP client, retry policy, auth headers and error text, and only the walking
logic is shared. That is the minimum surface that removes the duplication without
forcing the two scripts onto one HTTP stack.

**Rejected:** exporting `listTravels` from `seo-fix-links.js` and importing it into
`index-status.js`. It would couple a monitoring script to a mutating one, drag in
that script's `getJson`, `API_BASE` and manifest handling, and edit a file another
in-progress task owns.

**Rejected:** leaving the loop inline and only swapping the end test. It fixes this
instance and leaves the next copy free to repeat the mistake, which is exactly how
the defect reached a second script.

### End signal precedence: cursor, then declared total, then short page

`next` is present in every DRF answer and is `null` precisely on the last page, so
it decides on its own — a full page with `next: null` ends the walk, a short page
with a cursor continues it. Only when the envelope has no `next` field at all do
the older signals apply, in the order `count`/`total` then short page. The legacy
signals are kept rather than dropped because the same reader is meant to serve the
older-shaped callers listed as follow-up, whose fixtures may not carry a cursor.

Reaching a declared `count` is compared against the accumulated item count, not
against a page index, so a source that returns fewer rows than it promised still
terminates on the short page.

### `pickListRows` moves into the shared reader and stays exported from the script

`scripts/index-status.js` already exports `pickListRows` and
`__tests__/scripts/index-status.test.ts` asserts its behaviour, including the
#1325 regression. The function moves to `scripts/lib/pagedList.js` and is
re-exported from the script unchanged, so the existing tests keep testing the same
contract at the same import path and the envelope-reading fix stays covered.

### Dependency injection over HTTP interception in tests

`listTravels` gains an optional `deps = {}` argument with a `fetchJson` override,
matching the shape `scripts/seo-fix-links.js` already uses for the same purpose.
Tests drive a stub that mirrors production — full pages up to the last one, a
`count`/`next` envelope, and a thrown `HTTP 404` for any page past the last. The
stub throwing is the point: a reader that requests the extra page fails the test in
the same way the run fails in production.

### Page size stays 100 and lives in one constant

`TRAVELS_PER_PAGE = 100` in the shared reader is both the requested `perPage` and
the short-page threshold, so the two can no longer drift. The backend clamp makes a
larger value meaningless.

## Affected paths

- `scripts/lib/pagedList.js` — new; page size constant, `pickListRows`,
  `readPagedList`.
- `scripts/index-status.js` — `listTravels` walks through the shared reader and
  accepts injected deps; `pickListRows` re-exported from the shared module;
  `listTravels` added to the export list for tests.
- `__tests__/scripts/index-status.test.ts` — pagination regressions.
- `__tests__/scripts/paged-list.test.ts` — new; reader contract in isolation.

## Data/API contract

Unchanged. Same `GET /api/travels/?where={user_id,publish,moderation}&page=N&perPage=100`,
same `{count, next, previous, results}` answer, same 100-record clamp. The client
issues one fewer request per run: the trailing request that used to answer `404`.

## Risks and mitigation

- **A source that omits `next` regresses to the old behaviour.** Mitigated by the
  explicit `'next' in envelope` test — presence of the field, not truthiness of its
  value — plus a legacy-envelope test case, so an answer that carries
  `next: null` is not confused with one that carries no cursor at all.
- **Moving `pickListRows` breaks the #1325 coverage.** Mitigated by re-exporting it
  from `scripts/index-status.js` and leaving the existing assertions untouched.
- **The shared reader gets a second caller later and its assumptions do not fit.**
  Mitigated by keeping it transport-agnostic and by covering the legacy envelope
  paths now, before the second caller exists.

## Rollback

Single-commit revert. The script has no build artefact, no cached state and no
deploy step; the previous behaviour returns with the file.

## Validation matrix

| Surface | Applies | How validated |
| --- | --- | --- |
| Desktop web | no | Script is not bundled; nothing rendered changes. |
| Mobile web | no | Same. |
| Android | no | Same; no shared runtime module touched. |
| iPhone | no | Same. |
| Operator CLI (`npm run stats:index`) | yes | Unit tests on the multiple-of-page-size and short-last-page cases against a production-shaped stub, plus a live read-only run against author 1 that reaches the end of the list. |
| Locales RU/BE/UK/PL/EN | n/a | No user-facing text; operator output unchanged. |
