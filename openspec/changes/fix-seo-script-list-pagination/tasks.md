## 1. Shared paged-list reader

- [ ] 1.1 Add `scripts/lib/pagedList.js` with `TRAVELS_PER_PAGE = 100`, `pickListRows` moved over unchanged from `scripts/index-status.js`, and `readPagedList({ fetchPage, pageSize, maxPages })`.
- [ ] 1.2 Implement the end-signal precedence: presence of `next` in the envelope decides on its own (falsy ends, non-empty continues); otherwise a declared `count`/`total` reached by the accumulated item count ends the walk; otherwise a page shorter than the page size ends it.
- [ ] 1.3 Record in the module docblock why the cursor leads — the page past the last one answers `HTTP 404 «Invalid page»`, so the end must be decided before the request — with the #1755 and #1325 references.
- [ ] 1.4 Keep the reader transport-agnostic: it receives a `fetchPage(page)` callback and owns no HTTP client, auth or error text.

## 2. `scripts/index-status.js`

- [ ] 2.1 Rewrite `listTravels` to walk through `readPagedList`, keeping the slug normalisation and the emitted `{id, name, slug}` shape byte-for-byte.
- [ ] 2.2 Give `listTravels` an optional `deps = {}` with a `fetchJson` override, matching the shape `scripts/seo-fix-links.js` already uses.
- [ ] 2.3 Re-export `pickListRows` from the shared module so the existing #1325 assertions keep passing at the same import path, and add `listTravels` to the export list.
- [ ] 2.4 Confirm no other behaviour in the script changed: same query, same page size, same 50-page ceiling, same empty-selection guard in `selectTargets`.

## 3. Regression coverage

- [ ] 3.1 Add `__tests__/scripts/paged-list.test.ts` covering the reader in isolation: multiple-of-page-size count, short last page, full page with `next: null`, short page with a cursor, legacy envelope with a total, legacy envelope with neither, unreadable page, empty first page, and the runaway bound.
- [ ] 3.2 Extend `__tests__/scripts/index-status.test.ts` with `listTravels` against a stub that reproduces production, including a thrown `HTTP 404` for any page past the last one.
- [ ] 3.3 Assert the multiple-of-page-size case explicitly — 300 items over a page size of 100 returns 300 and requests exactly three pages — since that is the case the short-page heuristic fails.
- [ ] 3.4 Assert the 320-item case returns 320, and that the slug normalisation still reduces an absolute URL, a leading slash and a `travels/` prefix to the bare slug.

## 4. Validation

- [ ] 4.1 Run `npx jest __tests__/scripts/index-status.test.ts __tests__/scripts/paged-list.test.ts` and record the result.
- [ ] 4.2 Run the affected static checks (`npx tsc --noEmit` for the touched test files, lint on the touched scripts) and record the result.
- [ ] 4.3 Run `index-status` read-only against author 1 with a small `--limit` and confirm the list walk reaches the end and reports 320 articles without a `404`.
- [ ] 4.4 Run `openspec validate fix-seo-script-list-pagination --strict`.

## 5. Review and handoff

- [ ] 5.1 Run the mandatory code-review-and-fix pass over the complete diff, correcting confirmed correctness, duplication and reuse findings without touching the unrelated modified files another session owns.
- [ ] 5.2 Re-run the affected tests after review fixes and update this checklist with the final evidence.
- [ ] 5.3 File the follow-up board card for the remaining copies of the same end condition in `scripts/seo-audit.js`, `scripts/seo-find-dupes.js` and `scripts/seo-mass-augment.js`, linked to this task.
- [ ] 5.4 Stage only this task's own paths, commit and push to `main`, then move #1766 to `testing`.
