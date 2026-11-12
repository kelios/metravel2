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
  'w', 'we', 'do', 'z', 'ze', 'od', 'po', 'pod', 'koło', 'obok', 'na', 'przez', 'wokoł',
  'in', 'to', 'from', 'near', 'around', 'at', 'of', 'about', 'through', 'via',
])

/**
 * Предлоги «откуда» (#3277): «из Минска в Заславль», «з Мінска да Нясвіжа», «z Krakowa do Zakopanego»,
 * «from Minsk to Brest». Место вопроса — куда едут: город отправления назван, но спрашивают не о нём,
 * а его карточек в каталоге обычно больше («из Минска в Заславль» отдавал восемь квестов Минска).
 * «З», «z» — ещё и «с кем» («з дзецьмі», «z psem»): местом отправления слово становится, только когда
 * оно называет известное место каталога. Записаны как после `normalize`.
 */
const ORIGIN_PREPOSITIONS = new Set(['из', 'із', 'з', 'зі', 'от', 'ад', 'від', 'z', 'ze', 'od', 'from'])

/**
 * Вопрос исключает названное место («в Беларуси, кроме Минска»): карточки Минска оставлять нельзя,
 * а узнать, какое из мест исключено, по словам нельзя — подсказка остаётся прежней.
 */
const EXCLUSION_RE =
  /(?<![\p{L}])(?:кроме|помимо|не\s+считая|за\s+исключением|акрамя|апрача|крім|окрім|oprócz|poza|z\s+wyjątkiem|except|besides|other\s+than|apart\s+from|excluding)(?![\p{L}])/iu

/**
 * Числительные местом не бывают (#3345, lv23): «километров на сорок-пятьдесят» и «квест на сорок минут»
 * после предлога совпадали с городом Сороки, «на сто» — со Столбцами по первым буквам не совпадёт, но
 * правило одно на все: слово-числительное в любом падеже место не называет. Записаны как после `normalize`
 * (без диакритики, «й» → «и»), на RU/BE/UK/PL/EN.
 */
const NUMERAL_RE = new RegExp(
  `^(?:${[
    'од(?:ин|на|но|ни|ного|ну|нои|ному|ним)', 'дв(?:а|е|ух|ум|умя|ое|оих)', 'тр(?:и|ех|ем|емя|ое)', 'четыр(?:е|ех|ем|ьмя)', 'пят(?:ь|и|ью|еро)', 'шест(?:ь|и|ью|еро)', 'сем(?:ь|и|ью|еро)',
    'восемь|восьми|восьмью', 'девят(?:ь|и|ью)', 'десят(?:ь|и|ью)', '(?:один|две|три|четыр|пят|шест|сем|восем|девят)надцат(?:ь|и|ью)', 'двадцат(?:ь|и|ью)', 'тридцат(?:ь|и|ью)',
    'сорок|сорока', 'пят(?:ь|и)десят(?:и|ью)?', 'шест(?:ь|и)десят(?:и|ью)?', 'сем(?:ь|и)десят(?:и|ью)?', 'восем(?:ь|и)десят(?:и|ью)?', 'девяност(?:о|а)', 'сто|ста|сотн(?:я|и|ю)', 'двести|триста', 'тысяч(?:а|и|у|е)?', 'полтор(?:а|ы)|полутора',
    'адзін|адна|адну|дзве|дзвюх|тры|трох|чатыр(?:ы|ох)|пяц(?:ь|і)|шэсць|шасці|сем|сямі|восем|васьмі|дзевяц(?:ь|і)|дзесяц(?:ь|і)|дваццац(?:ь|і)|трыццац(?:ь|і)|пяцьдзесят|паутар(?:ы|а)',
    'одна|одну|дві|двох|трьох|чотир(?:и|ьох)|п.?ят(?:ь|и)|шіст(?:ь)?|шести|сім|семи|вісім|восьми|дев.?ят(?:ь|и)|двадцят(?:ь|и)|тридцят(?:ь|и)|п.?ятдесят|півтор(?:а|и)',
    'jed(?:en|na|no|nego|nej|ną)', 'dw(?:a|ie|och|oma)', 'trzy|trzech', 'czter(?:y|ech)', 'piec|pieciu', 'szesc|szesciu', 'siedem|siedmiu', 'osiem|osmiu', 'dziewiec|dziewieciu', 'dziesiec|dziesieciu',
    'dwadziescia|trzydziesci|czterdziesci|piecdziesiat|sto|tysiac(?:e|y)?|po[łl]tor(?:a|ej)',
    'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|hundred|thousand',
  ].join('|')})$`,
  'u',
)

type Word = { text: string; capital: boolean; afterPreposition: boolean; origin: boolean }

// NFD снимает диакритику («Kraków» → «krakow», «ё» → «е»): город в вопросе и в каталоге пишут по-разному.
const normalize = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')

const wordsOf = (value: unknown): Word[] => {
  const words: Word[] = []
  let afterPreposition = false
  let origin = false
  for (const raw of normalize(value).split(/[^\p{L}\p{N}]+/u)) {
    if (!raw) continue
    const text = raw.toLowerCase()
    if (raw.length >= MIN_WORD_LENGTH && !NUMERAL_RE.test(text)) words.push({ text, capital: /^\p{Lu}/u.test(raw), afterPreposition, origin })
    afterPreposition = PLACE_PREPOSITIONS.has(text)
    origin = ORIGIN_PREPOSITIONS.has(text)
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

export type PlaceLevel = 'cities' | 'countries'

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

const PLACE_LEVELS = ['cities', 'countries'] as const

type NamedPlaces = {
  level: PlaceLevel
  names: string[]
  origins: string[]
  /** `names` названы только после предлога «откуда»: места назначения среди этих названий нет. */
  originOnly: boolean
}

/**
 * Места запроса среди названий, известных карточкам, по уровням «город → страна». В маршруте «из X в
 * Y» место вопроса — Y: названия, стоящие только после предлога «откуда», уходят в `origins`, если в
 * запросе названо и другое место (на любом уровне: «из Минска в Польшу» — это Польша). Названо одно
 * место отправления («Куда поехать из Минска на выходные?») — оно и есть место вопроса.
 */
const namedPlacesOf = (query: string, sources: ReadonlyArray<Pick<AiSource, 'place'>>, levels: readonly PlaceLevel[], strict = false): NamedPlaces[] => {
  const asked = wordsOf(query).filter((word) => !strict || word.capital)
  const found = levels.map((level) => {
    const known = namesOf(sources.flatMap((source) => source.place?.[level] ?? []))
    const direct = known.filter((name) => asked.some((word) => asksAbout(word, name)))
    const destinations = direct.filter((name) => asked.some((word) => !word.origin && asksAbout(word, name)))
    return { level, direct, destinations }
  })
  // Строгий поиск (каталог целиком) место отправления местом вопроса не считает никогда.
  const route = strict || found.some((entry) => entry.destinations.length > 0)
  return found.map(({ level, direct, destinations }) => ({
    level,
    names: route ? destinations : direct,
    origins: route ? direct.filter((name) => !destinations.includes(name)) : [],
    originOnly: !route && direct.length > 0,
  }))
}

/**
 * Среди мест `sources` запрос называет только место отправления (#3277): «из Минска в Заславль», а
 * карточек Заславля в подборе нет. Отбор по месту тогда держится за город отправления — вызывающий
 * сначала ищет место назначения в каталоге (`arrangeSources`).
 */
export const namesOnlyOrigin = (query: string | null | undefined, sources: ReadonlyArray<Pick<AiSource, 'place'>>): boolean => {
  const text = String(query ?? '')
  if (!text.trim() || EXCLUSION_RE.test(text)) return false
  return namedPlacesOf(text, sources, PLACE_LEVELS).some((entry) => entry.originOnly)
}

/**
 * Карточки места, названного в запросе; `null` — место не названо, его карточек нет или названо
 * исключение («кроме Минска»). Порядок карточек сохраняется. Что делать без места, решает вызывающий —
 * цепочка `arrangeSources` (`sourceSelection.ts`): подбор как есть, отбор по упоминанию, сортировка по фактам.
 * `levels` — на каких уровнях искать место; по умолчанию город, затем страна. `strict` — поиск по
 * всему каталогу, где названий сотни: место называет только слово с заглавной буквы (слово со строчной
 * после предлога — «на берёзе», «в мире» — совпало бы с чьим-нибудь городом) и только место, куда едут
 * или где находятся: город отправления («недалеко от Минска», «из Минска на выходные») квестов этого
 * города не просит.
 */
export const matchPlaceSources = <T extends AiSource>(
  query: string | null | undefined,
  sources: readonly T[],
  levels: readonly PlaceLevel[] = PLACE_LEVELS,
  options: { strict?: boolean } = {},
): T[] | null => {
  const text = String(query ?? '')
  if (!text.trim() || EXCLUSION_RE.test(text)) return null
  for (const { level, names } of namedPlacesOf(text, sources, levels, options.strict === true)) {
    if (!names.length) continue
    // Город назван одним написанием («w Grodnie»), а статья о нём — другим («Гродно за выходные»): написания
    // одного города берутся из карточки квеста. У страны так нельзя — у статьи их бывает несколько.
    const named = level === 'cities' ? withSpellings(names, sources) : names
    const kept = sources.filter((source) => isOfPlace(source, named, level))
    if (kept.length) return kept
  }
  return null
}

/**
 * Слово называет место отправления маршрута «из X в Y» (#3277) — по названиям мест из `sources`
 * (каталог квестов экрана). Подбор экрана такие слова в балл квеста не считает: иначе восемь квестов
 * города отправления вытесняли квест места назначения. Нет маршрута — ни одно слово не подходит.
 */
export const routeOriginMatcher = (query: string | null | undefined, sources: ReadonlyArray<Pick<AiSource, 'place'>>): ((word: string) => boolean) => {
  const text = String(query ?? '')
  const origins = text.trim() ? namedPlacesOf(text, sources, PLACE_LEVELS).flatMap((entry) => entry.origins) : []
  if (!origins.length) return () => false
  return (word) => {
    const folded = normalize(word).toLowerCase()
    return origins.some((name) => startsWithName(folded, name, MAX_ENDING_LENGTH))
  }
}

/**
 * Карточка без служебных полей — для списка источников, который уходит посетителю: место (#3315),
 * запись фактов и строка «почему подходит» (#3289) нужны только отбору и подсказке.
 */
export const withoutPlace = <T extends AiSource>(source: T): Omit<T, 'place' | 'facts' | 'why'> => {
  const { place: _place, facts: _facts, why: _why, ...rest } = source
  return rest
}

const MIN_PLACE_WORD = 3
/** Сколько букв окончания может отличаться с каждой стороны: «под Минском» — «Минск», «в Гданьске» — «Гданьска». */
const MAX_PLACE_ENDING = 2

const foldWord = (value: string): string => normalize(value).toLowerCase()

const samePlaceWord = (a: string, b: string): boolean => {
  const shared = sharedPrefix(a, b)
  return shared >= Math.max(MIN_PLACE_WORD, Math.min(a.length, b.length) - MAX_PLACE_ENDING) && Math.max(a.length, b.length) - shared <= MAX_PLACE_ENDING + 1
}

/**
 * Текст упоминает хотя бы одно из названных мест — словом в любом падеже. Грубее отбора по месту
 * (регистр и предлог не смотрятся): отвечает на вопрос «есть ли об этом месте хоть что-то» для режима
 * страницы (#3290) и признака «материала о месте нет» (#3289). Название на другом письме («w Gdańsku»
 * при русском тексте) не узнаётся.
 */
export const mentionsAnyPlace = (places: readonly string[], text: string): boolean => {
  const names = places.map(foldWord).filter((name) => name.length >= MIN_PLACE_WORD)
  if (!names.length) return false
  const words = new Set(String(text ?? '').split(/[^\p{L}]+/u).filter((word) => word.length >= MIN_PLACE_WORD).map(foldWord))
  return names.some((name) => [...words].some((word) => samePlaceWord(name, word)))
}
