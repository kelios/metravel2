// Цифровой фрагмент из ≥7 цифр с разделителями — кандидат в номер телефона.
const DIGIT_RUN = /\+?(?:\d[\s().-]*){7,}/g
// Год 1000–2099: «Минск 1941-1945», «2020 2021» — название, а не номер (#3469).
const YEAR = /^(?:1\d{3}|20\d{2})$/

const isYearsOnly = (run: string) => {
  if (run.startsWith('+')) return false
  const groups = run.match(/\d+/g) ?? []
  return groups.length > 1 && groups.every((group) => YEAR.test(group))
}

/**
 * Whether a normalized search phrase may be sent to analytics as `search_term`.
 * Rejects one-letter noise, pasted text and anything that looks like personal
 * data (e-mail, link, phone number, also inside a phrase) — those are counted
 * without the phrase. A run made only of years is a title, not a phone number.
 */
export function isAnalyticsSearchTerm(term: string): boolean {
  if (term.length < 2 || term.length > 100 || /@|https?:\/\/|www\./i.test(term)) return false
  return !(term.match(DIGIT_RUN) ?? []).some((run) => !isYearsOnly(run))
}
