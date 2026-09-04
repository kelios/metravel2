## Why

`scripts/index-status.js` reads the author's article list page by page and decides
the list has ended when a page comes back with fewer than 100 rows
(`listTravels`, `scripts/index-status.js:359`). The backend does not behave that
way: `/api/travels/` is DRF `PageNumberPagination`, and the page *after* the last
one is not an empty list — it is `HTTP 404 «Invalid page»`. `fetchJson` turns any
non-200 into a thrown error, so as soon as the article count is an exact multiple
of 100 the last page is full, the short-page test never fires, the loop asks for
one more page and the whole run dies — after it has already read every article.
The neighbouring `if (!rows.length) break` is unreachable for the same reason:
that empty page is never served.

This is not a hypothetical shape. The identical defect was observed live and
fixed in `scripts/seo-fix-links.js` under board task #1755 (commit e25191457):
there the run died on 320 articles because it requested page 5 of 4. Probed on
production on 04.09.2026,
`GET /api/travels/?where={"user_id":1,…}&page=4&perPage=100` answers
`{count: 320, next: null, results: […20]}` — the `next` cursor is present in every
answer and is `null` exactly on the last page, so the correct end signal is
available and is simply not read.

The consequence is a silent stop of the daily SEO routine (`npm run stats:index`,
`stats:index:json`) on the day the article counter crosses a round number. Today
author 1 has 320 articles; the failure starts at 400.

The root cause is duplication: both loops were written independently and both
picked the short-page heuristic, which is correct for an API that serves an empty
final page and wrong for DRF. There is no shared paged-list reader for the SEO
scripts, so fixing one copy does not close the other — and `scripts/seo-audit.js`,
`scripts/seo-find-dupes.js` and `scripts/seo-mass-augment.js` carry the same
latent copy today.

## What Changes

- Introduce one shared paged-list reader for the SEO scripts that owns the end
  condition: the `next` cursor leads, `count`/`total` and the short page remain
  fallbacks for a legacy envelope that carries no cursor.
- Make `listTravels` in `scripts/index-status.js` use that reader, so the run ends
  the list *before* asking for a page that does not exist.
- Collapse the page size into a single constant, so the request step and the
  short-page threshold can no longer drift apart.
- Cover the behaviour with regression tests against a stub that reproduces
  production: `HTTP 404` past the last page, an item count that is an exact
  multiple of the page size, an item count that is not, and a legacy
  cursor-less envelope.

### Goal and user-visible result

The daily SEO indexing routine keeps completing when the number of published
articles reaches an exact multiple of the page size. Nothing rendered to a site
visitor changes: this is an operator-side script.

### Platform impact

`none`. `scripts/index-status.js` runs on the operator's machine under Node and is
not part of any bundle: desktop web, mobile web, Android and iPhone do not load
it and are not affected. No shared runtime module is touched.

### Localization impact

`none`. No app-owned UI copy, no `@/i18n` key, no locale-sensitive formatting, no
SEO locale surface. The script's own operator-facing Russian output is unchanged.

### Dependencies and fallback/mock policy

- Reference implementation and prior art: `scripts/seo-fix-links.js:151-182`
  (commit e25191457, board task #1755). Board task #1325 is the closed ancestor
  where an empty list was read as a clean pass.
- No backend dependency. `../metravel-backend` stays read-only, the endpoint, the
  query and the response envelope are unchanged, and no `area=back` task is
  needed.
- Tests run against an in-process stub that reproduces the production contract,
  including the `404` past the last page. The stub may not be softened to make a
  test pass: a reader that swallows the `404` instead of stopping before it would
  satisfy a lenient stub and still fail in production.
- The live check is read-only (`--limit`-bounded inspection of author 1); no
  write, no deploy, no board mutation beyond this task's own status.

### Existing behavior to preserve

- The envelope reading fixed in #1325: `results` first, with `data`/`items`/`rows`
  and a bare array kept as fallbacks. A missing `results` must keep producing an
  empty list rather than an exception, and the empty-selection guard in
  `selectTargets` must keep turning "0 articles" into a failure instead of a
  clean pass.
- The slug normalisation in `listTravels` (absolute URL, leading slashes and a
  `travels/` prefix all reduced to the bare slug) and the shape it emits
  (`{id, name, slug}`).
- The 50-page ceiling as a runaway guard.
- The unchanged behaviour of `--section travels|quests|all`, which reads
  `sitemap.xml` and never touches this loop.

### Out of scope / Non-goals

- Migrating `scripts/seo-fix-links.js` onto the shared reader. Its copy is already
  correct and it belongs to board task #1755, which is still in progress; moving
  it now would collide with that work. It is recorded as follow-up.
- Fixing the same latent short-page condition in `scripts/seo-audit.js`,
  `scripts/seo-find-dupes.js` and `scripts/seo-mass-augment.js`. Each needs its
  own evidence and its own regression; they are recorded as a follow-up board
  task rather than folded in here.
- Any change to the endpoint, the query, the page size the backend enforces, the
  report format, the CLI surface or the Search Console inspection path.
- Deploying or publishing anything.

### Open questions

None. The end signal, the failure mode past the last page and the live envelope
are all established by direct observation on production.

## Capabilities

### New Capabilities

- `seo-script-paged-list-reading`: the observable contract for how the SEO
  operator scripts read a paginated list from the travels API — which end signal
  wins, what happens on a count that is an exact multiple of the page size, what
  happens to a legacy envelope with no cursor, and what an empty result must do.

### Modified Capabilities

None. `openspec/specs/` holds no living capability for the SEO scripts, so this
change introduces the first one.

## Impact

- **Expected frontend scope:** a new shared reader under `scripts/lib/`,
  `listTravels` in `scripts/index-status.js` plus its export list, and tests under
  `__tests__/scripts/`. No application source, no route, no component.
- **Data/API:** unchanged. Same endpoint, same query, same envelope, same page
  size; only the client-side end condition changes. The change removes one
  request per run — the one that used to 404.
- **SEO:** no route, canonical, redirect, sitemap, robots, metadata,
  structured-data or SSG output changes. The effect is on the monitoring of SEO,
  not on anything Google reads.
- **Accessibility:** `none`. No rendered surface.
- **Performance:** negligible and positive — one fewer HTTP request per run.
- **Security:** `none`. No new input, URL construction, redirect, credential,
  storage or network destination; the same authenticated read as today.
- **Analytics:** `none`. No event, parameter or goal.
