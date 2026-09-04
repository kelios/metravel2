/**
 * scripts/lib/pagedList.js
 * Shared paginated-list reader for the SEO operator scripts.
 *
 * `/api/travels/` is DRF `PageNumberPagination`: it answers
 * `{count, next, previous, results}`, and the page AFTER the last one is not an
 * empty list — it is `HTTP 404 «Invalid page»`. Every caller here turns a non-200
 * into a thrown error, so "stop when a page comes back short" is not merely
 * imprecise, it is fatal: when the item count is an exact multiple of the page
 * size the last page is full, the short-page test never fires, the loop asks for
 * one more page and the whole run dies — after it has already read everything.
 *
 * That is #1755 (`scripts/seo-fix-links.js` died on 320 articles by requesting
 * page 5 of 4) and #1766 (the same end condition, copied into
 * `scripts/index-status.js`, latent until the article count reaches 400). Both
 * loops were written independently and both picked the short-page heuristic — a
 * form that is correct for an API serving an empty final page and wrong for DRF.
 * The end condition lives here so a third copy cannot reintroduce it.
 *
 * The leading signal is the `next` cursor: it is present in every DRF answer and
 * is `null` exactly on the last page (probed on production 04.09.2026 —
 * `…&page=4&perPage=100` → `count: 320, next: null, results: […20]`). `count`/
 * `total` and the short page stay as fallbacks for a legacy envelope that carries
 * no cursor at all.
 *
 * Reading the rows themselves is the other half of the same family of bugs:
 * #1325 read `res.data` while the API answered `results`, the list came back
 * empty and the monitor reported "0 articles checked" as a clean pass.
 */

/** The backend clamps a page to 100 records and silently ignores a larger
 *  `perPage` (probe 01.09.2026, see scripts/verify-static-travel-seo.js), so the
 *  request step and the short-page threshold must read the same number. */
const TRAVELS_PER_PAGE = 100

/** Runaway guard: a source that keeps advertising a successor must not make a
 *  run walk forever. 50 pages is 5 000 records at the clamped page size. */
const DEFAULT_MAX_PAGES = 50

/**
 * Rows out of a list envelope. `results` first — that is the current API shape;
 * the older keys and a bare array stay as fallbacks. An unreadable answer is zero
 * rows, not an exception: the caller's own empty-selection guard is what decides
 * whether "nothing found" is a failure.
 */
function pickListRows(res) {
  if (Array.isArray(res)) return res
  if (!res || typeof res !== 'object') return []
  const rows = res.results || res.data || res.items || res.rows
  return Array.isArray(rows) ? rows : []
}

/** The envelope itself, or null when the answer was a bare array or not an object. */
function pickEnvelope(res) {
  return res && typeof res === 'object' && !Array.isArray(res) ? res : null
}

/**
 * Walk a paginated list to its end, deciding the end from the answer already in
 * hand rather than by requesting a page to learn it does not exist.
 *
 * @param {object} opts
 * @param {(page: number, pageSize: number) => Promise<any>} opts.fetchPage
 *   Fetches one 1-based page. Receives the page size the reader will compare the
 *   returned row count against, so the request step and the end test cannot drift.
 * @param {number} [opts.pageSize=TRAVELS_PER_PAGE]
 * @param {number} [opts.maxPages=DEFAULT_MAX_PAGES]
 * @returns {Promise<any[]>} every row read, in page order
 */
async function readPagedList({ fetchPage, pageSize = TRAVELS_PER_PAGE, maxPages = DEFAULT_MAX_PAGES }) {
  const out = []
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchPage(page, pageSize)
    const rows = pickListRows(res)
    if (!rows.length) break
    out.push(...rows)

    const envelope = pickEnvelope(res)
    // Presence of the field, not truthiness of its value: `next: null` is an
    // explicit "this was the last page", while a missing `next` is a legacy
    // envelope that never had a cursor and needs the fallbacks below.
    if (envelope && 'next' in envelope) {
      if (!envelope.next) break
      continue
    }
    // Compared against the accumulated item count, not a page index, so a source
    // that returns fewer rows than it promised still terminates on the short page.
    const total = Number(envelope ? envelope.total ?? envelope.count : undefined)
    if (Number.isFinite(total) && total > 0 && out.length >= total) break
    if (rows.length < pageSize) break
  }
  return out
}

module.exports = {
  DEFAULT_MAX_PAGES,
  TRAVELS_PER_PAGE,
  pickListRows,
  readPagedList,
}
