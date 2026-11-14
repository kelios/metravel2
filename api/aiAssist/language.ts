/**
 * Язык текста по буквам и служебным словам — один определитель для службы `/ai/ask` и контура оценки
 * (#3369). До него правило жило в `scripts/ai-assistant-eval/checks.mjs` (проверка «ответ на языке
 * вопроса») и второй копией в `scripts/ai-train/eval.py`; служба языка вопроса не знала вовсе и брала
 * язык справочного ответа из `locale` запроса — польский вопрос без `locale` получал русскую запись.
 *
 * Кириллический язык — тот, чьих «чужих» букв в тексте меньше всего (русский не пишет «і ў ї є ґ»,
 * белорусский — «и щ ъ ї є ґ», украинский — «ы э ё ъ ў»). При равном счёте решают буквы, которые есть
 * только в одном языке, и служебные слова: белорусская фраза с опечаткой («…ўзровень гадин») и украинская
 * без «і», «ї», «є» по буквам от русской не отличались (#3345). Латиница — польские диакритика и диграфы
 * против английских. Латинские имена в кириллическом тексте («MeTravel», «iPhone») в счёт не идут.
 *
 * Модуль без `@/`-импортов: его грузит служба (`node --experimental-strip-types`) и контур оценки.
 */

export type TextLanguage = 'ru' | 'be' | 'uk' | 'pl' | 'en'

const URL_RE = /\bhttps?:\/\/[^\s<>()[\]"'«»]+/gi
const POLISH = 'ąćęłńśźżó'
const CYRILLIC_NEVER: Record<'ru' | 'be' | 'uk', string> = { ru: 'іўїєґ', be: 'ищъїєґ', uk: 'ыэёъў' }
const PL_RE = /sz|cz|rz|dz|ie|ow|ych|\b(?:i|w|z|na|nie|jest|się|do)\b/g
const EN_RE = /th|wh|sh|ea|ou|ing\b|\b(?:a|an|the|and|of|to|is|in|for)\b/g
const CYRILLIC_ONLY: Record<'ru' | 'be' | 'uk', string> = { ru: '', be: 'ў', uk: 'їєґ' }
const CYRILLIC_WORDS: Record<'ru' | 'be' | 'uk', readonly string[]> = {
  ru: ['и', 'что', 'как', 'это', 'или', 'если', 'есть', 'нет', 'вот', 'но', 'также', 'только', 'уже', 'ещё', 'еще', 'чтобы', 'из', 'от', 'можно', 'указано', 'указаны'],
  be: ['што', 'як', 'гэта', 'або', 'калі', 'ёсць', 'няма', 'вось', 'але', 'таксама', 'толькі', 'ужо', 'яшчэ', 'каб', 'ад', 'каля', 'можна', 'пазначана', 'пазначаны'],
  uk: ['що', 'як', 'це', 'або', 'якщо', 'є', 'немає', 'ось', 'але', 'також', 'тільки', 'вже', 'ще', 'щоб', 'від', 'та', 'й', 'можна', 'вказано', 'вказані', 'взимку', 'влітку'],
}

export type LanguageVerdict = {
  language: TextLanguage | null
  /**
   * Счёт равный: языки, между которыми текст не выбирает («Квест платны?» — русский или белорусский;
   * «Quest free?» — польский или английский). `language` тогда — первый по прежнему порядку (русский,
   * белорусский, украинский; для латиницы — английский). Пусто — язык определён однозначно.
   */
  tied: TextLanguage[]
}

/** Язык текста и признак равного счёта; `language: null` — в тексте нет букв. */
export const judgeLanguage = (text: string | null | undefined): LanguageVerdict => {
  const raw = String(text ?? '').replace(URL_RE, ' ')
  // Латинское слово с заглавной буквой в кириллическом тексте — имя, а не язык: «Да, приложение MeTravel есть
  // для iPhone, iPad и Android» по буквам выходило английским. Английская фраза в таком тексте по-прежнему
  // видна: её слова — со строчной.
  const value = (/[а-яёіўїєґ]/i.test(raw) ? raw.replace(/[A-Za-z]*[A-Z][A-Za-z]*/g, ' ') : raw).toLowerCase()
  const letters = value.match(/\p{L}/gu) ?? []
  const cyr = letters.filter((ch) => (ch >= 'а' && ch <= 'я') || 'ёіўїєґ'.includes(ch)).join('')
  const lat = letters.filter((ch) => (ch >= 'a' && ch <= 'z') || POLISH.includes(ch)).join('')
  if (!cyr && !lat) return { language: null, tied: [] }
  if (lat.length > cyr.length) {
    const words = (value.match(/[a-ząćęłńśźżó]+/g) ?? []).join(' ')
    const pl = 3 * [...lat].filter((ch) => POLISH.includes(ch)).length + (words.match(PL_RE) ?? []).length
    const en = (words.match(EN_RE) ?? []).length
    return { language: pl > en ? 'pl' : 'en', tied: pl === en ? ['en', 'pl'] : [] }
  }
  const count = (chars: string): number => [...chars].reduce((sum, ch) => sum + cyr.split(ch).length - 1, 0)
  const scored = (Object.keys(CYRILLIC_NEVER) as Array<'ru' | 'be' | 'uk'>).map((lang) => ({ lang, bad: count(CYRILLIC_NEVER[lang]) }))
  const least = Math.min(...scored.map((item) => item.bad))
  const tied = scored.filter((item) => item.bad === least)
  if (tied.length === 1) return { language: tied[0].lang, tied: [] }
  const words = value.match(/[\p{L}’'ʼ]+/gu) ?? []
  const evidence = (lang: 'ru' | 'be' | 'uk'): number => count(CYRILLIC_ONLY[lang]) + words.filter((word) => CYRILLIC_WORDS[lang].includes(word)).length
  // При равных признаках — прежний порядок: русский, белорусский, украинский.
  const best = tied.reduce((winner, item) => (evidence(item.lang) > evidence(winner.lang) ? item : winner))
  const top = evidence(best.lang)
  const level = tied.filter((item) => evidence(item.lang) === top).map((item) => item.lang)
  return { language: best.lang, tied: level.length > 1 ? level : [] }
}

/** Язык текста; `null` — в тексте нет букв. */
export const detectLanguage = (text: string | null | undefined): TextLanguage | null => judgeLanguage(text).language

/**
 * Язык вопроса посетителя для ответа без модели (справка, #3293): язык самого вопроса, а не интерфейса.
 * Вопрос, который между языками не выбирает («Квест платны?», «Quest?»), читается на языке запроса
 * `locale`, если тот среди равных; вопрос без букв — тоже на нём.
 */
export const questionLanguage = <L extends string>(question: string | null | undefined, locale: L): TextLanguage | L => {
  const verdict = judgeLanguage(question)
  if (!verdict.language) return locale
  return (verdict.tied as string[]).includes(locale) ? locale : verdict.language
}
