/**
 * Whether a normalized search phrase may be sent to analytics as `search_term`.
 * Rejects one-letter noise, pasted text and anything that looks like personal
 * data (e-mail, link, phone number) — those are counted without the phrase.
 */
export function isAnalyticsSearchTerm(term: string): boolean {
  if (term.length < 2 || term.length > 100 || /@|https?:\/\/|www\./i.test(term)) return false
  return !(/^[+\d\s().-]+$/.test(term) && term.replace(/\D/g, '').length >= 7)
}
