/**
 * Режим страницы в подборе службы (#3290): вопрос со страницы статьи или квеста ищется ВНУТРИ её
 * фрагментов. Раньше страницу представлял один фрагмент (первый или найденный общим подбором), а
 * рядом в подсказке стояли две случайные карточки: на «Сколько дней занимает поездка?» со страницы
 * о ярмарках Польши модель отвечала «около 6 дней» из статьи про Люксембург (проба 11.11.2026, p20).
 *
 * Чистые функции без HTTP и модели: выбор строк источника, лучшие под вектор запроса и окно текста
 * вокруг слов вопроса. Карточку собирает `app.ts`.
 */
import type { LoadedIndex } from './index.ts'
import { type Locale, snippet } from './search.ts'

/** Строки источника на локали запроса; источника на ней нет — строки первой его локали в индексе. */
export function pageRows(index: LoadedIndex, key: string, locale: Locale): number[] {
  const rows = index.rowsBySource.get(key) ?? []
  if (!rows.length) return []
  const { chunks } = index.artifact
  const own = rows.filter((row) => chunks[row].locale === locale)
  return own.length ? own : rows.filter((row) => chunks[row].locale === chunks[rows[0]].locale)
}

/**
 * Лучшие под вектор запроса строки страницы — в порядке текста страницы, а не балла: фрагменты одной
 * статьи читаются подряд.
 */
export function bestPageRows(index: LoadedIndex, rows: readonly number[], vector: ArrayLike<number>, limit: number): number[] {
  const { dim } = index.artifact.manifest
  const { vectors } = index.artifact
  const scored = rows.map((row) => {
    let score = 0
    const offset = row * dim
    for (let i = 0; i < dim; i += 1) score += vectors[offset + i] * vector[i]
    return { row, score }
  })
  return scored
    .sort((a, b) => b.score - a.score || a.row - b.row)
    .slice(0, Math.max(0, limit))
    .map((item) => item.row)
    .sort((a, b) => a - b)
}

const MIN_WORD_LENGTH = 4
const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MIN_WORD_LENGTH)

/** Слово вопроса в тексте — по общему началу: «взять» ≈ «возьмите» не ловится, «ночёвка» ≈ «ночёвки» — да. */
const stemOf = (word: string): string => word.slice(0, Math.max(MIN_WORD_LENGTH, word.length - 2))

/**
 * Окно текста фрагмента не длиннее `maxChars`: начинается с предложения, где больше всего слов
 * вопроса, и идёт подряд, пока помещается. Слов вопроса во фрагменте нет — окно с его начала.
 * Фрагмент индекса — до 800 знаков, и ответ на вопрос часто стоит в его середине: начало фрагмента
 * (прежний сниппет в 200 знаков) его не захватывало.
 */
export function focusFragment(text: string, query: string, maxChars: number): string {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (flat.length <= maxChars) return flat
  const sentences = flat.split(/(?<=[.!?…])\s+/u)
  const asked = [...new Set(wordsOf(query).map(stemOf))]
  let start = 0
  let best = 0
  sentences.forEach((sentence, index) => {
    const words = wordsOf(sentence)
    const score = asked.filter((stem) => words.some((word) => word.startsWith(stem))).length
    if (score > best) {
      best = score
      start = index
    }
  })
  let window = ''
  for (let index = start; index < sentences.length; index += 1) {
    const next = window ? `${window} ${sentences[index]}` : sentences[index]
    if (next.length > maxChars) break
    window = next
  }
  // Одно предложение длиннее окна — режется по слову, как сниппет выдачи.
  if (!window) return `${start > 0 ? '… ' : ''}${snippet(sentences[start], maxChars)}`
  return `${start > 0 ? '… ' : ''}${window}${window.length < flat.length && !flat.endsWith(window) ? ' …' : ''}`
}

/** Фрагменты страницы одной строкой карточки: границы видны по «…». */
export const joinPageFragments = (fragments: readonly string[]): string =>
  fragments
    .map((fragment) => fragment.replace(/^…\s*|\s*…$/g, '').trim())
    .filter(Boolean)
    .join(' … ')
