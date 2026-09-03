/**
 * scripts/lib/textIntegrity.js
 * Post-write verification for rich text that a script read, changed and PUT back.
 *
 * #1649: the existing `detectRegression()` guards answer "did the article
 * survive?" — publish/slug/gallery/points, and a description that did not
 * shrink by more than a fifth. A mangled code point passes every one of them:
 * two U+FFFD replace one Cyrillic letter, the length moves by one character,
 * and the batch happily writes the same corruption into the next 200 articles.
 *
 * So the round-trip gets its own check with a different failure mode: text
 * corruption is not "this article regressed, skip it" but "the pipeline is
 * damaging content, stop writing". Callers treat it as fatal to the batch.
 */

const REPLACEMENT_CHAR = '�'

/** How many U+FFFD a string carries (0 for null/undefined/non-strings) */
const countReplacementChars = (value) => {
  if (typeof value !== 'string' || !value) return 0
  let count = 0
  for (const char of value) if (char === REPLACEMENT_CHAR) count += 1
  return count
}

/**
 * Replacement characters the round-trip introduced.
 *
 * Compared against what we sent, not against zero: some published articles
 * already carry historical U+FFFD, and refusing to ever touch them again would
 * make them uneditable. Only *new* damage is ours.
 *
 * @returns {string|null} human-readable problem, or null when the text is intact
 */
const detectEncodingCorruption = (sent, got, label = 'text') => {
  const before = countReplacementChars(sent)
  const after = countReplacementChars(got)
  if (after <= before) return null
  return `${label} came back with ${after - before} new U+FFFD replacement character(s) (${before} → ${after}) — the read/write path is mangling UTF-8`
}

/**
 * Byte-exact round-trip check for short scalar fields (name, meta_description).
 *
 * Deliberately NOT applied to `description`: a byte difference in a rich-text
 * body is not evidence of encoding damage — the API is free to normalise the
 * HTML it stores and returns, and the scripts themselves compose it — so a byte
 * compare there reports differences that are not corruption. Only the U+FFFD
 * count is diagnostic for a body.
 *
 * @returns {string|null}
 */
const detectFieldMismatch = (sent, got, label = 'field') => {
  if (sent == null) return null
  // Trimmed, because the API normalises surrounding whitespace on save and a
  // stripped trailing newline is not corruption. Everything inside the value is
  // compared verbatim.
  const sentText = String(sent).trim()
  const gotText = (got == null ? '' : String(got)).trim()
  if (sentText === gotText) return null
  const at = firstDifferenceIndex(sentText, gotText)
  return `${label} was not stored as sent (first difference at char ${at}: sent ${JSON.stringify(
    sentText.slice(Math.max(0, at - 15), at + 15),
  )}, got ${JSON.stringify(gotText.slice(Math.max(0, at - 15), at + 15))})`
}

/** Index of the first differing character, or the length of the shorter string */
const firstDifferenceIndex = (a, b) => {
  const limit = Math.min(a.length, b.length)
  for (let i = 0; i < limit; i += 1) if (a[i] !== b[i]) return i
  return limit
}

/**
 * Verify a batch of round-tripped fields at once.
 *
 * @param {Array<{label: string, sent: *, stored: *, exact?: boolean}>} fields
 *   `exact` marks a short scalar field (name, meta_description). `description`
 *   must NOT be exact — see detectFieldMismatch().
 * @returns {string[]} empty when every field survived the round trip
 */
const detectStoredTextCorruption = (fields = []) => {
  const problems = []
  for (const field of fields) {
    if (!field || field.sent == null) continue
    // Ключа нет в ответе вовсе (#1716). Это «проверить нечем», а не «испорчено»:
    // `meta_description` API не сериализует ни у одной статьи, и байт-сравнение
    // с пустой строкой объявляло порчей КАЖДУЮ запись меты, после чего откат
    // уносил вместе с ней всё описание на тысячи символов. Отсутствующее поле
    // называет `findUnverifiableFields`, и вызывающий обязан о нём сказать
    // вслух — молчание здесь так же плохо, как ложная тревога.
    if (field.stored === undefined) continue
    const corruption = detectEncodingCorruption(field.sent, field.stored, field.label)
    if (corruption) {
      problems.push(corruption)
      continue
    }
    if (field.exact) {
      const mismatch = detectFieldMismatch(field.sent, field.stored, field.label)
      if (mismatch) problems.push(mismatch)
    }
  }
  return problems
}

/**
 * Поля, которые отправили, но проверить не смогли: ответ GET не содержит ключа
 * вовсе (`undefined`). `null` сюда НЕ попадает — это ответ «поле пустое», и
 * расхождение с отправленным текстом там настоящее.
 *
 * Отделено от `detectStoredTextCorruption` намеренно: у этих двух списков
 * разные последствия. Порча — повод откатить запись, непроверяемость — повод
 * предупредить редактора, что круг замкнуть не удалось.
 *
 * @param {Array<{label: string, sent: *, stored: *, exact?: boolean}>} fields
 * @returns {string[]} метки полей, отсутствующих в ответе
 */
const findUnverifiableFields = (fields = []) =>
  fields
    .filter((field) => field && field.sent != null && field.stored === undefined)
    .map((field) => field.label)

/**
 * Thrown instead of a plain Error so a batch loop can tell "this article
 * regressed, skip it" from "the pipeline is mangling text, stop writing".
 */
class TextCorruptionError extends Error {
  constructor(problems, context = '') {
    super(`${context ? `${context}: ` : ''}${problems.join('; ')}`)
    this.name = 'TextCorruptionError'
    this.problems = problems
  }
}

const isTextCorruptionError = (error) => error instanceof TextCorruptionError

module.exports = {
  REPLACEMENT_CHAR,
  TextCorruptionError,
  countReplacementChars,
  detectEncodingCorruption,
  detectFieldMismatch,
  detectStoredTextCorruption,
  findUnverifiableFields,
  firstDifferenceIndex,
  isTextCorruptionError,
}
