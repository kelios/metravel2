/**
 * scripts/lib/questAnswerNormalize.js
 * Нормализация ответа квеста для аудит-скриптов — ровно та же, по которой
 * `utils/questAdapters.normalize` засчитывает ввод игрока.
 *
 * Почему копия, а не импорт: рантайм живёт в TypeScript и тянет alias-импорты
 * (`@/utils/mediaUrl`), а скрипты в `scripts/` — обычный CommonJS без
 * TS-загрузчика (в проекте нет ни ts-node, ни tsx). Копия правил при этом
 * опасна ровно тем, ради чего скан существует: разойдись она с рантаймом хоть
 * одним `replace`, и скан начнёт отчитываться «недостижимых нет» о словаре,
 * который игроку недоступен.
 *
 * Поэтому расхождение ловится тестом, а не соглашением:
 * `__tests__/scripts/scanQuestAnswerReachability.test.ts` сверяет и поведение
 * на корпусе, и сам список преобразований, вырезанный из
 * `utils/questAdapters.ts`. Новое правило в рантайме роняет тест здесь.
 */

const { CYRILLIC, LATIN } = require('./questScriptMixing')

// Копия сведения букв-подменышей из `utils/questAnswerNormalization.ts` (#3191);
// поведение сверяет корпус теста паритета.
const LATIN_TO_CYRILLIC = {
  a: 'а', c: 'с', e: 'е', i: 'і', o: 'о', p: 'р', x: 'х', y: 'у',
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
}
const CYRILLIC_TO_LATIN = Object.fromEntries(
  Object.entries(LATIN_TO_CYRILLIC).map(([latin, cyrillic]) => [cyrillic, latin]),
)
const CYRILLIC_LETTER = new RegExp(CYRILLIC.source, 'g')
const LATIN_LETTER = new RegExp(LATIN.source, 'g')
const MIXED_SCRIPT_WORD = new RegExp(`(?:${LATIN.source}|${CYRILLIC.source})+`, 'g')

/** Слово смешанного алфавита — к алфавиту большинства букв; ничья — к кириллице. */
function foldToMajorityScript(word) {
  const cyrillic = (word.match(CYRILLIC_LETTER) || []).length
  const latin = (word.match(LATIN_LETTER) || []).length
  if (!cyrillic || !latin) return word
  const table = cyrillic >= latin ? LATIN_TO_CYRILLIC : CYRILLIC_TO_LATIN
  let folded = ''
  for (const letter of word) folded += table[letter] || letter
  return folded
}

/**
 * Один в один тело `utils/questAdapters.normalize`. Менять только вместе с ним —
 * тест паритета сравнивает цепочку преобразований посимвольно.
 */
function normalizeRuntime(s) {
  return s
    .replace(MIXED_SCRIPT_WORD, foldToMajorityScript)
    .toLowerCase()
    .replace(/[–—]/g, ' ')
    .replace(/-/g, /\S\s+\S/.test(s) ? ' ' : '')
    .replace(/[.,;:!?'„""]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ё/g, 'е')
    .replace(/і/g, 'и')
    .replace(/э/g, 'е')
    .replace(/(^| )ад(?= |$)/g, '$1от')
    .trim()
}

/**
 * То же самое, но безопасно к `null`/`undefined`/числу: в бандлах поля шага
 * необязательны, а рантайм получает строку всегда (её даёт сам инпут).
 */
function normalizeAnswer(value) {
  return normalizeRuntime(String(value == null ? '' : value))
}

/**
 * Только сведение подменышей, без остальной косметики: скан ищет смешанные
 * алфавиты по СЫРОМУ тексту (дефис значим), но после этого шага рантайма.
 */
function foldMixedScriptWords(value) {
  return String(value == null ? '' : value).replace(MIXED_SCRIPT_WORD, foldToMajorityScript)
}

module.exports = { normalizeRuntime, normalizeAnswer, foldMixedScriptWords }
