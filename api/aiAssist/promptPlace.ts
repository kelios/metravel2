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
 * Общий разбор места (#3416, #3431) — один для материалов сайта и маршрутов мира (`worldTrails.ts`):
 * слова вопроса с признаками «заглавная буква», «после предлога места», «откуда», «с кем»; падежные формы
 * названия (`stemsOf`); страна на любом из пяти языков по таблице `placeCountries.ts`; «N км от места» в
 * разборе условий (`namesPlaceAfterFrom`). Правило о регистре одно: заглавная буква — признак названия,
 * пока автор вопроса ею пользуется; вопрос, набранный без заглавных, читается по предлогам. Часть света
 * (`namedContinents`) — отбор по странам только у маршрутов мира; карточки сайта по ней не отбираются.
 *
 * Модуль без `@/`-импортов: службу грузит `node --experimental-strip-types`.
 */

import { type Continent, CONTINENT_COUNTRIES, CONTINENT_NAMES, COUNTRY_NAMES } from './placeCountries.ts'
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
 * Предлоги «с кем» (#3416, п.6): «в поход с Викторией», «з Лідай», «z Wiktorią», «with Jordan» — имя
 * человека совпадает с местом каталога (Лида) и газеттира маршрутов мира (штат Виктория, Иордания,
 * Каролина). Слово после такого предлога в творительном падеже — спутник, а не место; родительный после
 * тех же «с», «з», «z» — место отправления («с Корсики», «з Мінска», «z Krakowa») и местом остаётся.
 * Записаны как после `normalize`.
 */
const COMPANION_PREPOSITIONS = new Set(['с', 'со', 'з', 'із', 'зі', 'z', 'ze', 'with'])
/**
 * Окончания творительного падежа, как после `normalize` («й» → «и»): «Викторией», «Лідай», «Вікторією»,
 * «Иорданом», «Jordanem». Родительный падеж места отправления так не кончается: «с Корсики», «з Расіі».
 */
const INSTRUMENTAL_CYRILLIC_RE = /(?:[оеая]и|[оеая]ю|єю|[оеа]м|[ыиі]м|[ая]ми|[ая]мі)$/u
const INSTRUMENTAL_LATIN_RE = /(?:em|im|ym|ami)$/u

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

/**
 * Названия каталога, которые совпадают с обычным словом: «на мост» — не Мосты, «под берёзой» — не Берёза,
 * «в глубоком озере» — не Глубокое, «на ветке» — не Ветка, «у червні» / «у чэрвені» (в июне) — не Червень.
 * Местом такое название становится только словом с заглавной буквы не в начале фразы. Записаны как после
 * `normalize`.
 */
const COMMON_WORD_NAMES = new Set(['мосты', 'масты', 'mosty', 'береза', 'бяроза', 'глубокое', 'глыбокае', 'горки', 'горкі', 'ветка', 'круглое', 'круглае', 'высокое', 'высокае', 'столбцы', 'стоубцы', 'червень', 'чэрвень'])

/** Режим разбора: как читать регистр и уровень страны. Задаёт вызывающий — `matchPlaceSources`. */
type PlaceMode = {
  /** Поиск по всему каталогу или газеттиру: место называет слово с заглавной буквы, место отправления не в счёт. */
  strict: boolean
  /** В строгом поиске вопрос без заглавных букв читается по предлогу места. */
  lowercase: boolean
  /** Названия уровня `countries` — страны: к ним добавляются названия на остальных языках сайта. */
  countryForms: boolean
}

type Word = {
  text: string
  capital: boolean
  afterPreposition: boolean
  origin: boolean
  /** Слово стоит после предлога «с кем» (`COMPANION_PREPOSITIONS`); спутник ли оно, решает падеж — `isCompanion`. */
  companion: string | null
  /** Первое слово фразы: заглавная буква там — правило письма, а не признак названия. */
  initial: boolean
}

// NFD снимает диакритику («Kraków» → «krakow», «ё» → «е»): город в вопросе и в каталоге пишут по-разному.
const normalize = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')

const wordsOf = (value: unknown): Word[] => {
  const words: Word[] = []
  let afterPreposition = false
  let origin = false
  let companion: string | null = null
  // Фразы делятся знаком конца предложения и переводом строки; слова — всем, что не буква и не цифра.
  // Точка после одной буквы — сокращение («в г. Минске», «с. Вашково»), фразу она не делит.
  for (const sentence of normalize(value).split(/(?<=[\p{L}\p{N}]{2}|[)»"”])[.!?…]+\s+|[!?…]+\s+|\n+/u)) {
    let initial = true
    for (const raw of sentence.split(/[^\p{L}\p{N}]+/u)) {
      if (!raw) continue
      const text = raw.toLowerCase()
      if (raw.length >= MIN_WORD_LENGTH && !NUMERAL_RE.test(text)) words.push({ text, capital: /^\p{Lu}/u.test(raw), afterPreposition, origin, companion, initial })
      initial = false
      afterPreposition = PLACE_PREPOSITIONS.has(text)
      origin = ORIGIN_PREPOSITIONS.has(text)
      companion = COMPANION_PREPOSITIONS.has(text) ? text : null
    }
    // Предлог в конце фразы к следующей не относится.
    afterPreposition = false
    origin = false
    companion = null
  }
  return words
}

/**
 * Автор вопроса заглавными буквами названий не выделяет: ни одного слова с заглавной, кроме первых слов
 * фраз («пеший маршрут в шотландии», «Куда съездить в польше?»). Регистр тогда ничего не говорит, и место
 * узнаётся по предлогу даже там, где обычно нужна заглавная буква (поиск по всему каталогу и газеттиру).
 */
const isCaseless = (words: readonly Word[]): boolean => !words.some((word) => word.capital && !word.initial)

/**
 * Беглая гласная: «Новогрудок» — «в Новогрудке», «Навагрудак» — «па Навагрудку», «Лунинец» — «в
 * Лунинце». У названия на «-ок / -ак / -ек / -ец» вторая основа — без этой гласной.
 */
const stemsOf = (name: string): string[] => {
  const fleeting = /^(.{3,})[оаеэ]([кц])$/u.exec(name)
  if (fleeting) return [name, fleeting[1] + fleeting[2]]
  // Украинские чередования (#3369): «Відень — до Відня», «Львів — зі Львова», «Київ — з Києва» (после
  // `normalize` «ї» читается как «і»), «Тернопіль — до Тернополя».
  const softFleeting = /^(.{3,})ень$/u.exec(name)
  if (softFleeting) return [name, `${softFleeting[1]}н`]
  const closed = /^(.{2,})і(в|ль)$/u.exec(name)
  if (closed) return closed[2] === 'в' ? [name, `${closed[1]}ов`, `${closed[1]}ев`, `${closed[1]}єв`] : [name, `${closed[1]}ол`]
  // Польское чередование «k → c» в местном падеже (#3357): «Polska — w Polsce», «Korsyka — na Korsyce»,
  // «Wieliczka — w Wieliczce», «Białka — w Białce». Вторая основа — с «c» на месте «k»; только у названий
  // латиницей на «-ka» («ł» после `normalize` остаётся собой).
  const softened = /^(\p{Script=Latin}{3,})ka$/u.exec(name)
  if (softened) return [name, `${softened[1]}ce`]
  return [name]
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
 * Падежные окончания названия на пяти языках — как после `normalize` («й» → «и», «ў» → «у», «ą» → «a»).
 * Список закрытый (#3357, приёмка на полном индексе): раньше окончанием считались любые три буквы после
 * общего начала, и «в Нарнии» читалось как «Нара» + «нии», «в Альпах» — как «Альб» + «пах» (Швабский Альб,
 * Альберта, Альфёльд в ответе об Альпах). Последние три записи — формы названий-прилагательных
 * («Глубокое — в Глубоком», «Zakopane — z Zakopanego»).
 */
const CASE_ENDING_RE = new RegExp(
  `^(?:${[
    'а|я|у|ю|е|и|і|ы|о|ои|еи|аи|яи|ою|ею|єю|аю|яю|ом|ем|ам|ям|ах|ях|ами|ями|амі|ямі|ов|ев|ау|яу|оу|еу|ів|ью',
    // Латиница: польские падежи, в том числе мягкая основа («Poznań — do Poznania»), и английское
    // множественное число названия («Tatra — the Tatras»).
    'a|u|e|y|i|o|ie|iu|ia|ii|em|iem|im|ym|om|ach|ami|ow|owi|ej|s',
    'м|го|га|му|m|go|ego|mu|emu',
  ].join('|')})?$`,
  'u',
)
/** Последняя буква названия, которую падежное окончание заменяет: гласная, «ь» и «й» (после `normalize` — «и»). */
const REPLACED_LAST_RE = /[аеиоуыэюяіїєьaeiouy]$/u
/**
 * Чередование последней согласной названия: «Брэст — у Брэсце», «Budapeszt — w Budapeszcie», «Egipt — w
 * Egipcie». Другой замены последней согласной у падежной формы нет.
 */
const CONSONANT_SHIFT_RE = /^(?:це|зе|cie|sie|zie|rze|ce|dze)$/u
/** Белорусское «ў — в»: «Кракаў — у Кракаве», «Магілёў — з Магілёва». */
const V_FOR_U_RE = /^в(?:а|е|у|ам|ом)$/u
/**
 * Окончания, которых у названия латиницей на «-a» нет: «po polsku» — «по-польски», а не Польша (её формы —
 * «Polski», «Polsce», «Polskę»); «-u», «-em», «-owi» — мужской и средний род.
 */
const NOT_FEMININE_LATIN_RE = /^(?:u|iu|em|iem|im|ym|ow|owi|go|ego|mu|emu|m)$/u
/** Прилагательное и название края от названия: «Несвижский», «Гродненская», «Навагрудскі», «Гродненщина», «krakowskiego». */
const ADJECTIVE_ENDING_RE = /^(?:[а-яіїє]{0,2}(?:с|сь|ц|ць|з|зь)к[а-яіїє]{1,3}|[а-яіїє]{0,2}(?:щ|шч)[иы]н[а-яіїє]{1,2}|[a-zł]{0,2}[sc]k[a-zł]{1,4})$/u

/**
 * Слово — форма названия: падежная либо (когда `maxEnding` допускает длинное окончание) прилагательное.
 * От основы совпадает всё или всё, кроме последней буквы («Лида» — «в Лиду»); остаток слова обязан быть
 * окончанием из списка, а не любыми буквами.
 */
const startsWithName = (word: string, name: string, maxEnding: number): boolean =>
  stemsOf(name).some((stem) => {
    const shared = sharedPrefix(word, stem)
    if (shared < Math.max(MIN_WORD_LENGTH, stem.length - 1) || word.length - shared > maxEnding) return false
    // У названия на «-а» падежной формы на «-о» нет: «Лидо» (ресторан в статье о Риге) — не Лида (#3369).
    if (shared === stem.length - 1 && /[аa]$/u.test(stem) && word.length === stem.length && /[оo]$/u.test(word)) return false
    const rest = word.slice(shared)
    if (maxEnding > MAX_ENDING_LENGTH && ADJECTIVE_ENDING_RE.test(rest)) return true
    // «Cypr — na Cyprze»: польское «r — rz» перед окончанием.
    if (shared === stem.length) return CASE_ENDING_RE.test(rest) || (rest === 'ze' && stem.endsWith('r'))
    // Последняя буква названия заменена: гласную заменяет окончание, согласную — только чередование.
    if (!REPLACED_LAST_RE.test(stem)) return CONSONANT_SHIFT_RE.test(rest)
    if (stem.endsWith('a') && NOT_FEMININE_LATIN_RE.test(rest)) return false
    // «Ліда — у Лідзе»: белорусское «д — дз» перед окончанием.
    return CASE_ENDING_RE.test(rest) || rest === 'зе' || (stem.endsWith('у') && V_FOR_U_RE.test(rest))
  })

/** Слово — падежная форма названия («tatras» — «tatra», «францыі» — «францыя»); оба — как после `foldWord`. */
export const isPlaceForm = (word: string, name: string): boolean => startsWithName(word, name, MAX_ENDING_LENGTH)

/**
 * Слово после предлога «с кем» — спутник: «with Victoria» всегда; после «с», «з», «z» — только в творительном
 * падеже. Польское «-ą» после `normalize` читается как «-a», поэтому творительным считается и слово, равное
 * названию на «-a» («z Wiktorią»): место отправления стояло бы в родительном («z Wiktorii», «z Krakowa»).
 */
const isCompanion = (word: Word, name: string): boolean => {
  if (!word.companion) return false
  if (word.companion === 'with') return true
  if (/\p{Script=Cyrillic}/u.test(word.text)) return INSTRUMENTAL_CYRILLIC_RE.test(word.text)
  return INSTRUMENTAL_LATIN_RE.test(word.text) || (word.text === name && name.endsWith('a'))
}

/**
 * Слово вопроса называет место: падежная форма названия с заглавной буквы или после предлога места.
 * «Гродненская» и «варшавские» (прилагательные со строчной) названием не считаются. `anyLength` — короткое
 * название после предлога читается и со строчной («в азии»): так сверяется только список частей света, где
 * омонимов обычных слов нет.
 */
const asksAbout = (word: Word, name: string, anyLength = false): boolean => {
  if (!startsWithName(word.text, name, MAX_ENDING_LENGTH) || isCompanion(word, name)) return false
  const common = COMMON_WORD_NAMES.has(name)
  // Строчная буква после предлога места («квесты в гродно»); название-омоним обычного слова так не читается.
  if (word.afterPreposition && !common && (anyLength || name.length > SHORT_NAME_LENGTH)) return true
  if (!word.capital) return false
  // Заглавная в начале фразы — правило письма (#3369): «Глубокой ночью приезжаем…» — не Глубокое, «Most
  // interesting quests» — не Мосты. Первым словом место называет только само название («Гродно за день?»)
  // или слово после предлога; название-омоним в начале фразы местом не считается вовсе.
  if (!word.initial || word.afterPreposition) return true
  return !common && word.text === name
}

/** Слово текста статьи называет место — в том числе прилагательным; короткое название — только с заглавной. */
const mentions = (word: Word, name: string): boolean =>
  startsWithName(word.text, name, MAX_ADJECTIVE_ENDING_LENGTH) && (word.capital || name.length > SHORT_NAME_LENGTH)

export type PlaceLevel = 'cities' | 'countries'

const foldName = (value: string): string => normalize(value).toLowerCase().replace(/\s+/g, ' ').trim()

/** Таблица стран в виде для сверки: запись (слово или название целиком) → код и слова каждой страны. */
const COUNTRY_CODE_BY_NAME = new Map<string, string>()
const COUNTRY_WORDS_BY_CODE = new Map<string, string[]>()
for (const [code, names] of Object.entries(COUNTRY_NAMES)) {
  const words: string[] = []
  for (const name of names) {
    const folded = foldName(name)
    COUNTRY_CODE_BY_NAME.set(folded, code)
    if (/^[\p{L}\p{N}]+$/u.test(folded)) words.push(folded)
  }
  COUNTRY_WORDS_BY_CODE.set(code, words)
}

/**
 * Коды стран по названиям карточки — точным совпадением с таблицей: значение целиком («Южная Корея»,
 * «United Kingdom»), его части через запятую («Польша, Словакия») и отдельные слова («Bosnia»).
 */
export const countryCodesOf = (values: ReadonlyArray<string | null | undefined> | undefined): string[] => {
  const codes = new Set<string>()
  for (const value of values ?? []) {
    const whole = String(value ?? '')
    for (const part of [whole, ...whole.split(/[,;/]+/u), ...whole.split(/[^\p{L}\p{N}]+/u)]) {
      const code = COUNTRY_CODE_BY_NAME.get(foldName(part))
      if (code) codes.add(code)
    }
  }
  return [...codes]
}

/** Слова названия страны вместе с её названиями на остальных языках сайта: «Польша» → «polska», «poland», «польща»… */
const countryNamesOf = (values: ReadonlyArray<string | null | undefined> | undefined): string[] => [
  ...new Set([...namesOf(values), ...countryCodesOf(values).flatMap((code) => COUNTRY_WORDS_BY_CODE.get(code) ?? [])]),
]

const COUNTRY_WORD_CACHE_LIMIT = 8000
const countryWordCache = new Map<string, string | null>()

/**
 * Код страны, которую называет слово в любом падеже («polsce», «niemczech», «польщі»); оба — как после
 * `foldWord`. Регистр и предлог здесь не смотрятся — это дело вызывающего.
 */
export const countryCodeOfWord = (word: string): string | null => {
  const cached = countryWordCache.get(word)
  if (cached !== undefined) return cached
  let found: string | null = null
  if (word.length >= MIN_WORD_LENGTH && !NUMERAL_RE.test(word)) {
    search: for (const [code, names] of COUNTRY_WORDS_BY_CODE) {
      for (const name of names) {
        if (startsWithName(word, name, MAX_ENDING_LENGTH)) {
          found = code
          break search
        }
      }
    }
  }
  if (countryWordCache.size >= COUNTRY_WORD_CACHE_LIMIT) countryWordCache.clear()
  countryWordCache.set(word, found)
  return found
}

/** Два слова называют одну страну — на разных языках и в разных падежах: «Niemcy» — «Niemczech», «Польша» — «Polsce». */
export const sameCountryWord = (a: string, b: string): boolean => {
  const code = countryCodeOfWord(a)
  return code !== null && code === countryCodeOfWord(b)
}

/**
 * Страны, названные в вопросе, — кодами таблицы: слово с заглавной буквы либо после предлога места в
 * любом регистре (таблица — закрытый список, слово со строчной здесь с чужим городом не совпадёт).
 * Короткое название («Куба», «Кипр», «США») — только с заглавной, как в `asksAbout`. Вопрос с исключением
 * («в Европе, кроме Польши») страну не называет — как и для отбора карточек.
 */
export const namedCountryCodes = (query: string | null | undefined): string[] => {
  const text = String(query ?? '')
  if (!text.trim() || EXCLUSION_RE.test(text)) return []
  const codes = new Set<string>()
  for (const word of wordsOf(text)) {
    for (const [code, names] of COUNTRY_WORDS_BY_CODE) {
      if (!codes.has(code) && names.some((name) => asksAbout(word, name))) codes.add(code)
    }
  }
  return [...codes]
}

const CONTINENT_BY_COUNTRY = new Map<string, Continent>()
for (const [continent, codes] of Object.entries(CONTINENT_COUNTRIES) as Array<[Continent, readonly string[]]>) {
  for (const code of codes) CONTINENT_BY_COUNTRY.set(code, continent)
}
const CONTINENT_FORMS = CONTINENT_NAMES.map(([continents, names]) => ({ continents, names: names.map(foldName) }))
/** «Северная» и «Южная» рядом со словом «Америка» — как после `normalize`, на пяти языках. */
const NORTH_RE = /^(?:северн|пауночн|північн|po[lł]nocn|north)/u
const SOUTH_RE = /^(?:южн|пауднев|південн|po[lł]udniow|south)/u

/**
 * Части света стран по кодам таблицы (`countryCodesOf`): у маршрута по нескольким странам их бывает две.
 * Пустой список — страну определить нельзя: под отбор по части света такая карточка не проходит.
 */
export const continentsOfCodes = (codes: readonly string[]): Continent[] => [...new Set(codes.flatMap((code) => CONTINENT_BY_COUNTRY.get(code) ?? []))]

/** Слово — название части света в любом падеже («europie», «азии», «америки»); как после `foldWord`. */
export const isContinentWord = (word: string): boolean =>
  word.length >= MIN_WORD_LENGTH && CONTINENT_FORMS.some(({ names }) => names.some((name) => startsWithName(word, name, MAX_ENDING_LENGTH)))

/** Слово рядом с частью света, которое её уточняет («Северной Америке», «South America»), — не своё место. */
export const isContinentSide = (word: string): boolean => {
  const folded = foldName(word)
  return NORTH_RE.test(folded) || SOUTH_RE.test(folded)
}

/**
 * Части света, названные в вопросе (#3357); `null` — не названа. Слово с заглавной буквы либо после
 * предлога места в любом регистре: список закрытый, омонимов обычных слов в нём нет («в европе», «в азии»).
 * «Америка» — обе, пока рядом нет «Северная» или «Южная»: «в Южной Америке», «w Ameryce Północnej», «in North
 * America». Пустой список — названа часть света без стран (Антарктида). Вопрос с исключением («в мире, кроме
 * Европы») часть света не называет — как страну и город.
 */
export const namedContinents = (query: string | null | undefined): Continent[] | null => {
  const text = String(query ?? '')
  if (!text.trim() || EXCLUSION_RE.test(text)) return null
  const words = wordsOf(text)
  const found = new Set<Continent>()
  let named = false
  for (let at = 0; at < words.length; at += 1) {
    const before = words[at - 1]
    const sides = [before, words[at + 1]].map((side) => side?.text ?? '')
    // Предлог стоит перед уточнением: «в северной америке», «in north america».
    const word: Word = before?.afterPreposition && isContinentSide(before.text) ? { ...words[at], afterPreposition: true } : words[at]
    for (const { continents, names } of CONTINENT_FORMS) {
      if (!names.some((name) => asksAbout(word, name, true))) continue
      named = true
      const north = sides.some((side) => NORTH_RE.test(side))
      const south = sides.some((side) => SOUTH_RE.test(side))
      const america = continents.includes('north-america') && north !== south
      for (const continent of america ? ([north ? 'north-america' : 'south-america'] as const) : continents) found.add(continent)
    }
  }
  return named ? [...found] : null
}

/**
 * Названия места карточки для сверки. У страны к словам карточки добавляются её названия на остальных
 * языках сайта (#3416, п.4): русская «Польша» находится на «w Polsce», «in Poland», «у Польшчы».
 */
const placeNamesOf = (values: ReadonlyArray<string | null | undefined> | undefined, level: PlaceLevel, countryForms: boolean): string[] =>
  level === 'countries' && countryForms ? countryNamesOf(values) : namesOf(values)

/**
 * Карточка относится к названному месту. Квест — по городу каталога: в его названии бывает другой
 * город («…из Минска в Заславль»). Статья — по названию и фрагменту: её `cityName` в каталоге —
 * точка маршрута («Нижняя станция канатной дороги…»), а не город; страна у статьи надёжна.
 */
const isOfPlace = (source: AiSource, names: readonly string[], level: PlaceLevel, { countryForms }: PlaceMode): boolean => {
  // Своё место карточки — то же название или его прилагательное: квест на озере «Свіцязь (Навагрудскі раён)» — место Новогрудка.
  const own = placeNamesOf(source.place?.[level], level, countryForms)
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
const DEFAULT_MODE: PlaceMode = { strict: false, lowercase: false, countryForms: true }

const namedPlacesOf = (query: string, sources: ReadonlyArray<Pick<AiSource, 'place'>>, levels: readonly PlaceLevel[], mode: PlaceMode = DEFAULT_MODE): NamedPlaces[] => {
  const { strict, countryForms } = mode
  const words = wordsOf(query)
  // Строгий поиск читает место по заглавной букве; вопрос без заглавных (`lowercase`) — по предлогу места.
  // Страна из таблицы узнаётся после предлога в любом регистре: список закрытый, с чужим городом слово не совпадёт.
  const caseless = strict && mode.lowercase && isCaseless(words)
  const asked = words.filter((word) => !strict || word.capital || (word.afterPreposition && (caseless || countryCodeOfWord(word.text) !== null)))
  const found = levels.map((level) => {
    const known = placeNamesOf(sources.flatMap((source) => source.place?.[level] ?? []), level, countryForms)
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
 * Вопрос называет место только как точку отправления — по форме слов, без карточек: «маршрут на выходные из
 * Минска», «plan a weekend trip from Minsk», «z Krakowa na weekend». Место отправления — слово с заглавной
 * буквы после предлога «откуда»; названо и другое место после предлога («из Минска в Вильнюс») — это маршрут
 * туда, а не вопрос «куда поехать из X». Вопрос без заглавных букв так не читается: без карточек не отличить
 * «из минска» от «на выходные».
 */
export const namesOriginOnly = (query: string | null | undefined): boolean => {
  const named = wordsOf(query).filter((word) => word.capital && word.afterPreposition)
  return named.length > 0 && named.every((word) => word.origin)
}

/**
 * Карточки места, названного в запросе; `null` — место не названо, его карточек нет или названо
 * исключение («кроме Минска»). Порядок карточек сохраняется. Что делать без места, решает вызывающий —
 * цепочка `arrangeSources` (`sourceSelection.ts`): подбор как есть, отбор по упоминанию, сортировка по фактам.
 * `levels` — на каких уровнях искать место; по умолчанию город, затем страна. `strict` — поиск по
 * всему каталогу, где названий сотни: место называет только слово с заглавной буквы (слово со строчной
 * после предлога — «на берёзе», «в мире» — совпало бы с чьим-нибудь городом) и только место, куда едут
 * или где находятся: город отправления («недалеко от Минска», «из Минска на выходные») квестов этого
 * города не просит. `lowercase` (только вместе со `strict`) — вопрос, набранный без заглавных букв («пеший
 * маршрут в шотландии»), читать по предлогу места: регистр в нём ничего не говорит. Включают маршруты мира;
 * каталог квестов сайта остаётся строгим — ошибка там ставит в подсказку модели квесты чужого города (lv23).
 * `countryForms: false` — названия уровня `countries` странами не считать: маршруты мира передают этим
 * уровнем и места ниже страны.
 */
export const matchPlaceSources = <T extends AiSource>(
  query: string | null | undefined,
  sources: readonly T[],
  levels: readonly PlaceLevel[] = PLACE_LEVELS,
  options: Partial<PlaceMode> = {},
): T[] | null => {
  const text = String(query ?? '')
  if (!text.trim() || EXCLUSION_RE.test(text)) return null
  const mode: PlaceMode = { strict: options.strict === true, lowercase: options.lowercase === true, countryForms: options.countryForms !== false }
  for (const { level, names } of namedPlacesOf(text, sources, levels, mode)) {
    if (!names.length) continue
    // Город назван одним написанием («w Grodnie»), а статья о нём — другим («Гродно за выходные»): написания
    // одного города берутся из карточки квеста. У страны так нельзя — у статьи их бывает несколько.
    const named = level === 'cities' ? withSpellings(names, sources) : names
    const kept = sources.filter((source) => isOfPlace(source, named, level, mode))
    if (kept.length) return kept
  }
  return null
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

/** Два слова — одно название в разных падежах: общее начало почти во всю длину («Франция» — «Франции»). Оба — как после `foldWord`. */
export const samePlaceWord = (a: string, b: string): boolean => {
  const shared = sharedPrefix(a, b)
  return shared >= Math.max(MIN_PLACE_WORD, Math.min(a.length, b.length) - MAX_PLACE_ENDING) && Math.max(a.length, b.length) - shared <= MAX_PLACE_ENDING + 1
}

/**
 * Перед названием стоит слово обзора: с горы Турбач в Горце «в ясную погоду открывается панорама Татр»,
 * «потрясающие виды на Татры и Пьенины» — статья о Горце упоминала Татры в шести фрагментах из девяти и
 * вставала в подсказку на «маршрут в Татрах для новичков» (lv79). Между словом обзора и названием
 * допускается одно слово («видно Высокие Татры», «панорама польских Татр»).
 */
const VIEW_BEFORE_RE =
  /(?<![\p{L}])(?:вид(?:ы|ом|ами|а|ов)?\s+на|в[іi]д(?:ы|ам)?\s+на|краявід\p{L}*\s+на|краєвид\p{L}*\s+на|панорам\p{L}*|панарам\p{L}*|видн[оыа]|виден|видать|відаць|открыва\p{L}+|адкрыва\p{L}+|відкрива\p{L}+|widok\p{L}*\s+na|wida[ćc]|panoram\p{L}*(?:\s+of)?|views?\s+(?:of|over|to|towards|across)|overlook\p{L}*)\s+(?:(?:the|на|в)\s+)?(?:[\p{L}-]+\s+)?$/iu
const VIEW_WINDOW_CHARS = 60

/**
 * Текст упоминает хотя бы одно из названных мест — словом в любом падеже. Грубее отбора по месту
 * (регистр и предлог не смотрятся; упоминание места как вида с другой точки не считается): отвечает на вопрос «есть ли об этом месте хоть что-то» для режима
 * страницы (#3290) и признака «материала о месте нет» (#3289). Город на другом письме («w Gdańsku»
 * при русском тексте) не узнаётся; страна узнаётся на любом из пяти языков сайта (`placeCountries.ts`).
 */
export const mentionsAnyPlace = (places: readonly string[], text: string): boolean => {
  const asked = places.map(foldWord).filter((name) => name.length >= MIN_PLACE_WORD)
  if (!asked.length) return false
  // Страна названа на языке вопроса («w Polsce»), а текст — на своём («Польша»): сверяются все её названия.
  const names = [...new Set([...asked, ...asked.flatMap((name) => COUNTRY_WORDS_BY_CODE.get(countryCodeOfWord(name) ?? '') ?? [])])]
  const value = String(text ?? '')
  const seen = new Map<string, boolean>()
  for (const match of value.matchAll(/\p{L}+/gu)) {
    const raw = match[0]
    if (raw.length < MIN_PLACE_WORD) continue
    let named = seen.get(raw)
    if (named === undefined) {
      const word = foldWord(raw)
      named = names.some((name) => samePlaceWord(name, word))
      seen.set(raw, named)
    }
    // Место, на которое только смотрят, — не место материала (#3369): «виды на Татры», «панорама Татр».
    if (named && !VIEW_BEFORE_RE.test(value.slice(Math.max(0, (match.index ?? 0) - VIEW_WINDOW_CHARS), match.index))) return true
  }
  return false
}

/**
 * Ориентир, а не место: «маршрут 20 км от вокзала», «trasa 15 km od dworca», «20 km from the station».
 * Слова записаны как после `normalize`; в английском ориентир выдаёт артикль или притяжательное слово.
 */
const LANDMARK_RE = new RegExp(
  `^(?:${[
    'вокзал\\p{L}*', 'станци\\p{L}+', 'остановк\\p{L}+', 'платформ\\p{L}+', 'центр\\p{L}*', 'дом(?:а|у|ом|е)?', 'отел\\p{L}+', 'гостиниц\\p{L}+', 'хостел\\p{L}*', 'парковк\\p{L}+', 'стоянк\\p{L}+', 'метро',
    'старт\\p{L}*', 'начал\\p{L}+', 'город(?:а|у|ом|е|ка)?', 'деревн\\p{L}+', 'поселк\\p{L}+', 'озер\\p{L}+', 'рек(?:и|а|е|у|ои)', 'мор(?:я|е|ю|ем)', 'границ\\p{L}+', 'аэропорт\\p{L}*', 'лагер\\p{L}+', 'турбаз\\p{L}+', 'кемпинг\\p{L}*', 'пляж\\p{L}*', 'площад\\p{L}+', 'парк(?:а|у|ом|е)?', 'трасс\\p{L}+', 'дорог\\p{L}+', 'шоссе',
    'вакзал\\p{L}*', 'станцы\\p{L}+', 'прыпынк\\p{L}+', 'цэнтр\\p{L}*', 'гатэл\\p{L}+', 'паркоук\\p{L}+', 'стаянк\\p{L}+', 'горад(?:а|у|ам|зе)?', 'веск\\p{L}+', 'возер\\p{L}+', 'рак(?:і|а|у|ои)', 'мяж\\p{L}+', 'пачатк\\p{L}+',
    'зупинк\\p{L}+', 'готел\\p{L}+', 'будинк\\p{L}+', 'міст(?:а|у|ом|і)?', 'сел(?:а|у|ом|і)', 'річк\\p{L}+', 'кордон\\p{L}*', 'початк\\p{L}+',
    'dworc\\p{L}+', 'dworzec', 'stacj\\p{L}+', 'przystank\\p{L}+', 'centrum', 'dom(?:u|em)?', 'hotel\\p{L}*', 'hostel\\p{L}*', 'parking\\p{L}*', 'metra', 'start\\p{L}*', 'miast\\p{L}+', 'wsi', 'jezior\\p{L}+', 'rzek\\p{L}+', 'morz\\p{L}+', 'granic\\p{L}+', 'lotnisk\\p{L}+', 'pocz[aą]tk\\p{L}+',
    'the', 'an?', 'my', 'our', 'your', 'this', 'that', 'here', 'home', 'town', 'downtown',
  ].join('|')})$`,
  'u',
)
/**
 * «N км от …» — расстояние от места, а не длина маршрута (#3416, п.2). `after` — текст сразу за предлогом
 * «от», «ад», «від», «od», «from». Место называет слово с заглавной буквы («от Минска») и слово со
 * строчной, если это не ориентир: «от минска», «od krakowa» — место; «от вокзала», «from the station» —
 * ориентир, и «20 км» там — длина маршрута. Незнакомое слово со строчной считается местом: ошибка в эту
 * сторону лишь не добавляет условие длины, обратная убирала бы подходящие карточки как «слишком длинные».
 */
export const namesPlaceAfterFrom = (after: string): boolean => {
  const first = /^\s*([\p{L}\p{N}][\p{L}\p{N}'’ʼ-]*)/u.exec(String(after ?? ''))?.[1]
  if (!first) return false
  return /^\p{Lu}/u.test(first) || !LANDMARK_RE.test(foldWord(first))
}
