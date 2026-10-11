/**
 * scripts/lib/questDetailCohort.js
 * Depth verdict plus the numbers behind it for one language cohort of quest
 * detail pages (#2365). No second algorithm: the verdict is
 * `scoreIndexableQuestPages` — the same call RU detail pages already take in
 * `selectIndexableBuiltQuestPages` — and the metrics come from the same
 * `scoreQuestPageLevel` pass with unchanged thresholds.
 *
 * A cohort is every detail page of ONE locale: PL prose is compared with PL
 * siblings, never with RU, and a sparse locale keeps the full floors.
 */

const {
  groupQuestPagesByKind,
  questPageFromHtml,
  scoreIndexableQuestPages,
  scoreQuestPageLevel,
} = require('./questPageDepth')

/**
 * @param {{ path: string, html: string }[]} entries one locale only
 * @returns {Map<string, { words: number, ratio: number, indexable: boolean, issues: string[] }>}
 */
function scoreDetailCohort(entries) {
  const pages = entries.map((entry) => questPageFromHtml(entry.html, entry.path))
  const { indexable } = scoreIndexableQuestPages(pages)
  const result = new Map()
  for (const page of pages) {
    if (!page.kind) result.set(page.path, { words: 0, ratio: 0, indexable: false, issues: ['no crawlable quest section'] })
  }
  for (const [, kindPages] of groupQuestPagesByKind(pages)) {
    for (const scored of scoreQuestPageLevel(kindPages)) {
      // `null` = nothing to compare with (a cohort of one): no sibling shares any
      // of its five-grams, so its own share is whole — or zero without text.
      const ratio = scored.ratio === null ? (scored.words > 0 ? 1 : 0) : scored.ratio
      result.set(scored.path, {
        words: scored.words,
        ratio,
        indexable: indexable.has(scored.path),
        issues: scored.issues,
      })
    }
  }
  return result
}

module.exports = { scoreDetailCohort }
