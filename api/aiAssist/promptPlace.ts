/**
 * Отбор карточек подсказки по месту вопроса (#3315).
 *
 * Подбор отдаёт до восьми карточек, и рядом с материалами города из вопроса в них стоят чужие:
 * в 75 из 104 ходов приёмки 11.11.2026 с известным местом. Модель добирала ими список — «три
 * квеста в Гродно» получали третьим квест Карловых Вар, детский квест Пинска — соседа из
 * Ушачского района, хотя карточек нужного места хватало. Выбирать «своих» среди восьми — работа
 * отбора, а не модели на 4 млрд параметров.
 *
 * Правило одно для экрана, службы `/ai/ask` и набора quality (все собирают подсказку через
 * `buildAssistantMessages`): место вопроса — слова запроса подбора, совпавшие с городом или
 * страной найденных карточек. Если у названного города есть карточки, в подсказку идут только
 * они; иначе то же для страны; иначе подсказка прежняя. Список источников посетителя и страж
 * ссылок работают с полным подбором.
 *
 * Модуль без `@/`-импортов: службу грузит `node --experimental-strip-types`.
 */

import type { AiSource } from './types'

const MIN_WORD_LENGTH = 3
/** Сколько букв окончания может отличаться: «Гродно» — «в Гродне», «Kraków» — «w Krakowie». */
const MAX_ENDING_LENGTH = 3
/** В тексте статьи место стоит и прилагательным: «Несвижский замок», «Брестская крепость», «zamek krakowski». */
const MAX_ADJECTIVE_ENDING_LENGTH = 6
/** Название не длиннее этого («Мир», «Лида», «Рига») совпадает с обычным словом: нужна заглавная буква. */
const SHORT_NAME_LENGTH = 4

/**
 * Слова названия, которые местом не являются: «с. Вашково (Ушацький район)», «Vashkovo (Ushachy
 * District)». Строчные слова названия отбрасываются и без списка; здесь — те, что пишут с заглавной.
 * Записаны как после `normalize` («й» → «и», «ё» → «е», «ó» → «o»). Сюда же — общие слова городов и
 * природных мест каталога («Старый Орхей», «Нова-Слупя», «Кутна-Гора», «Blue Spring», «Lake
 * Svityaz», «Puszcza Nalibocka»): иначе «Старые замки Беларуси», «Новые квесты?», «Горы рядом» или
 * «Spring trips» оставляли в подсказке одну карточку этого места.
 */
const GENERIC_NAME_WORDS = new Set([
  'раион', 'раен', 'область', 'вобласць', 'округ', 'краи', 'город', 'горад', 'село', 'деревня',
  'district', 'region', 'county', 'city', 'town', 'village', 'old', 'new',
  'rejon', 'powiat', 'gmina', 'miasto', 'wies', 'stare', 'nowe',
  'старыи', 'стары', 'старии', 'стара', 'новыи', 'новы', 'нова', 'нові', 'нови', 'нижнии', 'великии', 'вялікі',
  'stary', 'stara', 'nowa', 'nowy', 'novi', 'wielki', 'veliky', 'saint',
  'гора', 'гура', 'hora', 'gora', 'lake', 'spring', 'blue', 'forest', 'tract', 'bog', 'puszcza', 'uroczysko',
])

/**
 * Предлоги места на RU/BE/UK/PL/EN — как после `normalize` ниже («ў» → «у»). Слово вопроса со
 * строчной буквы называет место только после предлога: «квесты в гродно» — да, «приезжаем глубокой
 * ночью» — нет, хотя Глубокое есть в каталоге (то же «берёзой» — Берёза, «мосты» — Мосты).
 */
const PLACE_PREPOSITIONS = new Set([
  'в', 'во', 'у', 'ув', 'из', 'із', 'з', 'зі', 'по', 'па', 'под', 'пад', 'під', 'до', 'да', 'около', 'возле', 'каля', 'біля',
  'от', 'ад', 'від', 'вокруг', 'вакол', 'навколо', 'к', 'ко', 'на', 'про', 'пра',
  'w', 'we', 'do', 'z', 'ze', 'po', 'pod', 'koło', 'obok', 'na', 'przez', 'wokoł',
  'in', 'to', 'from', 'near', 'around', 'at', 'of', 'about', 'through', 'via',
])

/**
 * Вопрос исключает названное место («в Беларуси, кроме Минска»): карточки Минска оставлять нельзя,
 * а узнать, какое из мест исключено, по словам нельзя — подсказка остаётся прежней.
 */
const EXCLUSION_RE =
  /(?<![\p{L}])(?:кроме|помимо|не\s+считая|за\s+исключением|акрамя|апрача|крім|окрім|oprócz|poza|z\s+wyjątkiem|except|besides|other\s+than|apart\s+from|excluding)(?![\p{L}])/iu

type Word = { text: string; capital: boolean; afterPreposition: boolean }

// NFD снимает диакритику («Kraków» → «krakow», «ё» → «е»): город в вопросе и в каталоге пишут по-разному.
const normalize = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')

const wordsOf = (value: unknown): Word[] => {
  const words: Word[] = []
  let afterPreposition = false
  for (const raw of normalize(value).split(/[^\p{L}\p{N}]+/u)) {
    if (!raw) continue
    const text = raw.toLowerCase()
    if (raw.length >= MIN_WORD_LENGTH) words.push({ text, capital: /^\p{Lu}/u.test(raw), afterPreposition })
    afterPreposition = PLACE_PREPOSITIONS.has(text)
  }
  return words
}

/**
 * Беглая гласная: «Новогрудок» — «в Новогрудке», «Навагрудак» — «па Навагрудку», «Лунинец» — «в
 * Лунинце». У названия на «-ок / -ак / -ек / -ец» вторая основа — без этой гласной.
 */
const stemsOf = (name: string): string[] => {
  const fleeting = /^(.{3,})[оаеэ]([кц])$/u.exec(name)
  return fleeting ? [name, fleeting[1] + fleeting[2]] : [name]
}

/** Слова названия места: с заглавной буквы и не служебные («болото Ельня (Миорский район)» → «ельня», «миорский»). */
const namesOf = (values: ReadonlyArray<string | null | undefined> | undefined): string[] => {
  const names = new Set<string>()
  for (const value of values ?? []) {
    for (const word of wordsOf(value)) {
      if (word.capital && !GENERIC_NAME_WORDS.has(word.text)) names.add(word.text)
    }
  }
  return [...names]
}

const sharedPrefix = (a: string, b: string): number => {
  let length = 0
  while (length < a.length && length < b.length && a[length] === b[length]) length += 1
  return length
}

/**
 * Слово называет место: от названия совпало всё, кроме последней буквы («Лида» — «в Лиду»), у слова
 * остаётся окончание не длиннее `maxEnding`.
 */
const startsWithName = (word: string, name: string, maxEnding: number): boolean =>
  stemsOf(name).some((stem) => {
    const shared = sharedPrefix(word, stem)
    return shared >= Math.max(MIN_WORD_LENGTH, stem.length - 1) && word.length - shared <= maxEnding
  })

/**
 * Слово вопроса называет место: падежная форма названия с заглавной буквы или после предлога места.
 * «Гродненская» и «варшавские» (прилагательные со строчной) названием не считаются.
 */
const asksAbout = (word: Word, name: string): boolean =>
  startsWithName(word.text, name, MAX_ENDING_LENGTH) && (word.capital || (word.afterPreposition && name.length > SHORT_NAME_LENGTH))

/** Слово текста статьи называет место — в том числе прилагательным; короткое название — только с заглавной. */
const mentions = (word: Word, name: string): boolean =>
  startsWithName(word.text, name, MAX_ADJECTIVE_ENDING_LENGTH) && (word.capital || name.length > SHORT_NAME_LENGTH)

type PlaceLevel = 'cities' | 'countries'

/**
 * Карточка относится к названному месту. Квест — по городу каталога: в его названии бывает другой
 * город («…из Минска в Заславль»). Статья — по названию и фрагменту: её `cityName` в каталоге —
 * точка маршрута («Нижняя станция канатной дороги…»), а не город; страна у статьи надёжна.
 */
const isOfPlace = (source: AiSource, names: readonly string[], level: PlaceLevel): boolean => {
  // Своё место карточки — то же название или его прилагательное: квест на озере «Свіцязь (Навагрудскі раён)» — место Новогрудка.
  const own = namesOf(source.place?.[level])
  if (own.some((word) => names.some((name) => word === name || startsWithName(word, name, MAX_ADJECTIVE_ENDING_LENGTH)))) return true
  if (source.type !== 'travel') return false
  const text = wordsOf(`${source.title} ${source.snippet}`)
  return names.some((name) => text.some((word) => mentions(word, name)))
}

/** Названные города вместе с остальными написаниями тех же городов из карточек квестов. */
const withSpellings = (direct: readonly string[], sources: readonly AiSource[]): string[] => {
  const names = new Set(direct)
  for (const source of sources) {
    const own = namesOf(source.place?.cities)
    if (own.some((name) => direct.includes(name))) own.forEach((name) => names.add(name))
  }
  return [...names]
}

/**
 * Карточки места из вопроса; без названного места, без его карточек и при исключении («кроме
 * Минска») — список как есть. Порядок подбора сохраняется.
 */
export const selectPlaceSources = (query: string | null | undefined, sources: readonly AiSource[]): readonly AiSource[] => {
  const text = String(query ?? '')
  if (sources.length < 2 || !text.trim() || EXCLUSION_RE.test(text)) return sources
  const asked = wordsOf(text)
  for (const level of ['cities', 'countries'] as const) {
    const known = namesOf(sources.flatMap((source) => source.place?.[level] ?? []))
    const direct = known.filter((name) => asked.some((word) => asksAbout(word, name)))
    if (!direct.length) continue
    // Город назван одним написанием («w Grodnie»), а статья о нём — другим («Гродно за выходные»): написания
    // одного города берутся из карточки квеста. У страны так нельзя — у статьи их бывает несколько.
    const named = level === 'cities' ? withSpellings(direct, sources) : direct
    const kept = sources.filter((source) => isOfPlace(source, named, level))
    if (kept.length) return kept
  }
  return sources
}

/** Место карточки без служебного поля — для списка источников, который уходит посетителю. */
export const withoutPlace = <T extends AiSource>(source: T): Omit<T, 'place'> => {
  const { place: _place, ...rest } = source
  return rest
}
