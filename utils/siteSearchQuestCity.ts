/** Минимум символов нормализованного запроса для блока «Ещё по запросу». */
export const SITE_SEARCH_MIN_QUERY_LENGTH = 3

/**
 * Регистр, диакритика (в том числе «ё» → «е» и «й» → «и» — обе стороны сравнения
 * проходят одно правило), дефисы и пунктуация, повторные пробелы.
 */
export function normalizeSiteSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-‐‑–—_.,;:!?'’"«»()/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
