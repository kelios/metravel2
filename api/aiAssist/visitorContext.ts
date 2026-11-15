/**
 * Личный контекст вошедшего посетителя (#3354): сводка его статей, отметок «был / хочу / запланировано»,
 * избранного и ближайших поездок. Сводку собирает служба `/ai/ask` по ответам API сайта на запросы с
 * токеном самого посетителя (`scripts/ai-assist/visitorProfile.ts`); этот модуль — чистые правила:
 *
 *   - строка «О посетителе» для подсказки модели — не длиннее `VISITOR_BLOCK_MAX_TOKENS`, без имени,
 *     почты и идентификаторов. Это сведения о человеке, а не карточки: ссылок по ним модель не даёт;
 *   - вопрос о «моих» местах («куда я хотела поехать», «из сохранённого», «мои планы» — RU/BE/UK/PL/EN)
 *     делает сохранённые и запланированные материалы кандидатами в карточки;
 *   - на вопрос «куда поехать» материалы «уже посещено» и собственные статьи понижаются в порядке
 *     подбора, но не удаляются;
 *   - названия материалов сводки, которых нет среди карточек ответа, — для стража: предложение с таким
 *     названием в ответе модели вырезается (`answerGuard.ts`, `visitorTitles`).
 *
 * Гость сюда не попадает: без сводки ни одна функция не вызывается, и подсказка с подбором остаются прежними.
 * Модуль общий для службы и тестов экрана, без `@/`-импортов.
 */

import type { AiSource } from './types'

/** Материал сайта из отметок посетителя: статья и её название. */
export type VisitorPlace = {
  id: number
  title: string
  country?: string | null
  /** Дата отметки: запланированная или дата посещения (`YYYY-MM-DD`), если посетитель её указал. */
  date?: string | null
}

/** Поездка из планировщика: место старта и даты. Материалом сайта не является. */
export type VisitorTrip = {
  place: string
  start?: string | null
  end?: string | null
}

export type VisitorContext = {
  /** Опубликованные статьи самого посетителя: число, страны по убыванию частоты, идентификаторы. */
  own: { count: number; countries: string[]; ids: number[] }
  visited: VisitorPlace[]
  wishlist: VisitorPlace[]
  planned: VisitorPlace[]
  favorites: VisitorPlace[]
  trips: VisitorTrip[]
}

/** Потолок строки «О посетителе» в подсказке, токенов. */
export const VISITOR_BLOCK_MAX_TOKENS = 120
/**
 * Знаков на токен для оценки размера строки. Замер подсказки службы — ≈ 3,2 знака на токен для русского
 * и 2,87 для белорусского (`docs/features/ai-assistant.md` → «Бюджет подсказки службы»); оценка берёт
 * меньшее с запасом, чтобы потолок держался на любом языке названий.
 */
export const VISITOR_CHARS_PER_TOKEN = 2.8
export const VISITOR_BLOCK_LABEL_RU = 'О посетителе'

/**
 * Правило личного контекста: дописывается к системному сообщению только вместе со строкой «О посетителе».
 * В обучении кругов 1–9 такой строки не было — блок выключается переменной `AI_ASSIST_PROMPT_PROFILE=0`.
 */
export const VISITOR_RULE_RU =
  `Строка «${VISITOR_BLOCK_LABEL_RU}» — сведения о том, кто спрашивает, а не карточки: учитывай их, выбирая из карточек, ` +
  'но не давай ссылок на материалы из этой строки и не называй их, если их нет среди карточек.'

const MAX_TITLE_CHARS = 40
const MAX_PLACE_CHARS = 32
const MAX_COUNTRIES = 3
const MAX_LISTED = 2
const MONTHS_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'] as const

export const estimateTokens = (text: string): number => Math.ceil([...String(text ?? '')].length / VISITOR_CHARS_PER_TOKEN)

/** Строка как данные подсказки: без управляющих и невидимых символов, адресов, кавычек-ёлочек и разметки ссылок. */
export const cleanVisitorText = (value: unknown, maxLength: number): string => {
  const text = String(value ?? '')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/https?:\/\/\S+/giu, ' ')
    .replace(/[«»[\]()<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if ([...text].length <= maxLength) return text
  const cut = [...text].slice(0, maxLength).join('')
  const atWord = cut.replace(/\s+\S*$/u, '')
  return `${(atWord.length >= maxLength / 2 ? atWord : cut).replace(/[\s,.:;—–-]+$/u, '')}…`
}

const monthOf = (iso: string | null | undefined): { label: string; time: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (month < 1 || month > 12) return null
  return { label: `${MONTHS_RU[month - 1]} ${year}`, time: Date.UTC(year, month - 1, day) }
}

const DAY_MS = 86_400_000

/** Поездки, которые ещё не закончились, — ближайшая первой. */
export const upcomingTrips = (trips: readonly VisitorTrip[], now: Date = new Date()): VisitorTrip[] =>
  trips
    .map((trip) => ({ trip, start: monthOf(trip.start), end: monthOf(trip.end ?? trip.start) }))
    .filter((entry) => entry.start !== null && entry.end !== null && entry.end.time >= now.getTime() - DAY_MS)
    .sort((a, b) => a.start!.time - b.start!.time)
    .map((entry) => entry.trip)

/** В сводке есть что учитывать: без статей, отметок, избранного и поездок строки и правила нет. */
export const hasVisitorData = (context: VisitorContext | null | undefined): context is VisitorContext =>
  Boolean(
    context &&
      (context.own.count > 0 || context.visited.length || context.wishlist.length || context.planned.length || context.favorites.length || context.trips.length),
  )

type Segment = string[]

const quoted = (place: VisitorPlace): string => `«${cleanVisitorText(place.title, MAX_TITLE_CHARS)}»`

/** Варианты одной части строки — от полного к короткому: два названия, одно, только число. */
const listVariants = (label: string, places: readonly VisitorPlace[], render: (place: VisitorPlace) => string = quoted): Segment => {
  const named = places.filter((place) => cleanVisitorText(place.title, MAX_TITLE_CHARS))
  if (!named.length) return []
  const more = (shown: number): string => (named.length > shown ? ` и ещё ${named.length - shown}` : '')
  const variants = [MAX_LISTED, 1].filter((shown) => shown <= named.length).map((shown) => `${label}: ${named.slice(0, shown).map(render).join(', ')}${more(shown)}`)
  return [...variants, `${label}: материалов — ${named.length}`]
}

/**
 * Строка «О посетителе» для подсказки: страны и число собственных статей, затем короткие списки названий
 * «хочет посетить / запланировано / ближайшие поездки / в избранном / уже посещено». Части добавляются по
 * порядку важности для вопроса «куда поехать», пока строка укладывается в `maxTokens`: сначала каждая с
 * одним названием, затем, если место осталось, со вторым; не влезла и так — остаётся числом либо
 * пропускается. Пустая строка — сказать нечего.
 */
export const formatVisitorBlock = (context: VisitorContext | null | undefined, now: Date = new Date(), maxTokens: number = VISITOR_BLOCK_MAX_TOKENS): string => {
  if (!hasVisitorData(context)) return ''
  const shown = new Set<number>()
  const fresh = (places: readonly VisitorPlace[]): VisitorPlace[] => places.filter((place) => !shown.has(place.id))
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const withDate = (place: VisitorPlace): string => {
    const month = monthOf(place.date)
    return month && month.time >= monthStart ? `${quoted(place)} (${month.label})` : quoted(place)
  }
  const countries = context.own.countries.map((country) => cleanVisitorText(country, MAX_PLACE_CHARS)).filter(Boolean).slice(0, MAX_COUNTRIES)
  const trips = upcomingTrips(context.trips, now)
    .map((trip) => ({ place: cleanVisitorText(trip.place, MAX_PLACE_CHARS), month: monthOf(trip.start) }))
    .filter((trip) => trip.place)
  const tripText = (count: number): string => trips.slice(0, count).map((trip) => (trip.month ? `${trip.place} (${trip.month.label})` : trip.place)).join(', ')

  // Варианты части — от полного к короткому. `compact` — с какого варианта часть встаёт в первом проходе:
  // список — с одного названия (последний вариант у него — только число), поездки — с одной поездки, а
  // статьи посетителя — сразу со странами (они важнее вторых названий).
  const listed = (segment: Segment): number => Math.max(0, segment.length - 2)
  const last = (segment: Segment): number => Math.max(0, segment.length - 1)
  const parts: Array<{ variants: () => Segment; places?: readonly VisitorPlace[]; compact: (segment: Segment) => number }> = [
    {
      compact: () => 0,
      variants: () =>
        context.own.count > 0 ? [...(countries.length ? [`Статей на сайте: ${context.own.count} (${countries.join(', ')})`] : []), `Статей на сайте: ${context.own.count}`] : [],
    },
    { variants: () => listVariants('Хочет посетить', fresh(context.wishlist)), places: context.wishlist, compact: listed },
    { variants: () => listVariants('Запланировано', fresh(context.planned), withDate), places: context.planned, compact: listed },
    { variants: () => (trips.length ? [...new Set([`Ближайшие поездки: ${tripText(MAX_LISTED)}`, `Ближайшие поездки: ${tripText(1)}`])] : []), compact: last },
    { variants: () => listVariants('В избранном', fresh(context.favorites)), places: context.favorites, compact: listed },
    { variants: () => listVariants('Уже посещено', fresh(context.visited)), places: context.visited, compact: listed },
  ]

  const lineOf = (segments: readonly string[]): string => `${VISITOR_BLOCK_LABEL_RU}: ${segments.join('. ')}.`
  const fits = (segments: readonly string[]): boolean => estimateTokens(lineOf(segments)) <= maxTokens
  // Сначала ширина: каждая часть встаёт коротким вариантом (одно название), чтобы «уже посещено» не вытеснялось
  // вторым названием из «хочет посетить». Затем, пока есть место, части по порядку важности разворачиваются.
  const chosen: Array<{ variants: Segment; index: number }> = []
  const current = (): string[] => chosen.map((entry) => entry.variants[entry.index])
  for (const part of parts) {
    const variants = part.variants()
    const from = part.compact(variants)
    const index = variants.findIndex((variant, position) => position >= from && fits([...current(), variant]))
    if (index < 0) continue
    chosen.push({ variants, index })
    // Материал назван один раз: избранное не повторяет то, что уже стоит в «хочет посетить».
    for (const place of part.places ?? []) shown.add(place.id)
  }
  for (const entry of chosen) {
    while (entry.index > 0) {
      const wider = current()
      wider[chosen.indexOf(entry)] = entry.variants[entry.index - 1]
      if (!fits(wider)) break
      entry.index -= 1
    }
  }
  return chosen.length ? lineOf(current()) : ''
}

/** Что именно из своего спрашивает посетитель: сохранённое и желаемое либо планы. */
export type OwnPlacesKind = 'saved' | 'plans'

const WORD_START = '(?<![\\p{L}\\p{N}])'
const WORD_END = '(?![\\p{L}\\p{N}])'
const word = (pattern: string): string => `${WORD_START}(?:${pattern})${WORD_END}`
/** До двух слов между подлежащим и глаголом: «я когда-то хотела», «I have always wanted». */
const GAP = "(?:[\\p{L}'’-]+\\s+){0,2}?"

/**
 * Вопрос о планах. Рассказ о намерении — «я планирую поездку в Краков, что посмотреть?», «у меня в планах
 * Гданьск», «планы на выходные в Минске» — сюда не относится: это обычный вопрос о месте. Узнаётся только
 * вопрос о самих планах, с притяжательной формой: «мои планы», «какие у меня планы», «что у меня в планах»,
 * «что я запланировала», «куда я собиралась».
 */
const PLAN_RE = new RegExp(
  [
    // RU
    word('что|куда|где|какие') + '\\s+' + word('я|мы') + `\\s+${GAP}` + word('запланировал[аи]?|планировал[аи]?|собирал(?:ся|ась|ись)'),
    word('мо[иёейюя]\\p{L}*') + '\\s+' + word('план(?:ы|ов|ах|ам|ами)?|запланированн\\p{L}+'),
    word('что|какие|куда') + '\\s+(?:там\\s+)?' + word('у\\s+меня|у\\s+нас') + `\\s+${GAP}(?:в\\s+)?` + word('планах|планы|запланирован\\p{L}*'),
    word('из|среди') + '\\s+(?:мо(?:его|их)\\s+)?' + word('запланированн\\p{L}+'),
    // BE
    word('што|куды|дзе|якія') + '\\s+' + word('я|мы') + `\\s+${GAP}` + word('запланавал[аі]?|запланаваў|планавал[аі]?|планаваў|збірал(?:ася|іся)|збіраўся'),
    word('ма[еёіяйю]\\p{L}*') + '\\s+' + word('план(?:ы|аў|ах|ам|амі)?|запланаван\\p{L}+'),
    word('што|якія|куды') + '\\s+(?:там\\s+)?' + word('[уў]\\s+мяне|[уў]\\s+нас') + `\\s+${GAP}(?:[уў]\\s+)?` + word('планах|планы|запланаван\\p{L}*'),
    // UK
    word('що|куди|де|які') + '\\s+' + word('я|ми') + `\\s+${GAP}` + word('запланувал[аи]?|запланував|планувал[аи]?|планував|збирал(?:ася|ися)|збирався'),
    word('мо[їєяює]\\p{L}*') + '\\s+' + word('план(?:и|ів|ах|ам|ами)?|запланован\\p{L}+'),
    word('що|які|куди') + '\\s+(?:там\\s+)?' + word('[ув]\\s+мене|[ув]\\s+нас') + `\\s+${GAP}(?:[ув]\\s+)?` + word('планах|плани|запланован\\p{L}*'),
    // PL
    word('co|dokąd|gdzie|jakie') + `\\s+${GAP}` + word('zaplanował[ae]m|zaplanowaliśmy|zaplanowałyśmy|planował[ae]m'),
    word('moj[eaą]|moich|moimi?') + '\\s+' + word('plan(?:y|ów|ach)?|zaplanowan\\p{L}+'),
    word('co|jakie') + '\\s+' + word('mam|mamy') + `\\s+${GAP}(?:w\\s+)?` + word('plan(?:y|ach)|zaplanowan\\p{L}+'),
    // EN
    word('what|where|which') + `\\s+${GAP}` + word('have|did') + '\\s+' + word('I|we') + `\\s+${GAP}` + word('planned|plan'),
    word('my|our') + '\\s+' + word('plans?|planned\\s+\\p{L}+'),
  ].join('|'),
  'iu',
)

const SAVED_RE = new RegExp(
  [
    // RU
    word('я|мы') + `\\s+${GAP}` + word('сохранил[аи]?|сохранял[аи]?|отложил[аи]?|добавил[аи]?\\s+в\\s+избранное'),
    word('куда|что|где') + '\\s+' + word('я|мы') + `\\s+${GAP}` + word('хотел[аи]?|мечтал[аи]?'),
    word('из|среди') + '\\s+(?:мо(?:его|их)\\s+)?' + word('сохран[её]нн\\p{L}+|избранн\\p{L}+|закладок|отложенн\\p{L}+'),
    word('мо[иёейюя]\\p{L}*') + '\\s+' + word('сохран[её]нн\\p{L}+|избранн\\p{L}+|закладк\\p{L}+|списк\\p{L}+\\s+желани\\p{L}+|отметк\\p{L}+'),
    word('в') + '\\s+(?:мо[её]м|моих)\\s+' + word('избранном|сохран[её]нн\\p{L}+|закладках'),
    word('у\\s+меня|у\\s+нас') + `\\s+${GAP}(?:в\\s+)?` + word('избранном|закладках|сохранен\\p{L}*|сохран[её]нн\\p{L}+'),
    // BE
    word('я|мы') + `\\s+${GAP}` + word('захавал[аі]?|захаваў|захоўвал[аі]?|адклал[аі]?|адклаў'),
    word('куды|што|дзе') + '\\s+' + word('я|мы') + `\\s+${GAP}` + word('хацел[аі]?|хацеў|марыл[аі]?|марыў'),
    word('з|са|сярод') + '\\s+(?:май?го\\s+|маіх\\s+)?' + word('захаван\\p{L}+|абран\\p{L}+|закладак'),
    word('ма[еёіяйю]\\p{L}*') + '\\s+' + word('захаван\\p{L}+|абран\\p{L}+|закладк\\p{L}+'),
    word('[уў]\\s+мяне|[уў]\\s+нас') + `\\s+${GAP}(?:[уў]\\s+)?` + word('абраным|закладках|захаван\\p{L}+'),
    // UK
    word('я|ми') + `\\s+${GAP}` + word('зберегла|зберегли|зберіг|зберігал[аи]?|зберігав|відклал[аи]?|відклав'),
    word('куди|що|де') + '\\s+' + word('я|ми') + `\\s+${GAP}` + word('хотіл[аи]?|хотів|мріял[аи]?|мріяв'),
    word('з|із|зі|серед') + '\\s+(?:мого\\s+|моїх\\s+)?' + word('збережен\\p{L}+|обран\\p{L}+|вподобан\\p{L}+|закладок'),
    word('мо[їєяює]\\p{L}*') + '\\s+' + word('збережен\\p{L}+|обран\\p{L}+|вподобан\\p{L}+|закладк\\p{L}+'),
    word('[ув]\\s+мене|[ув]\\s+нас') + `\\s+${GAP}(?:[ув]\\s+)?` + word('обраному|закладках|збережен\\p{L}+'),
    // PL
    word('zapisał[ae]m|zapisaliśmy|zapisałyśmy|odłożył[ae]m'),
    word('dokąd|gdzie|co') + `\\s+${GAP}` + word('chciał[ae]m|chcieliśmy|chciałyśmy|marzył[ae]m'),
    word('z|spośród|wśród') + '\\s+(?:moich\\s+)?' + word('zapisanych|ulubionych|zakładek'),
    word('moj[eaą]|moich|moimi?') + '\\s+' + word('zapisan\\p{L}+|ulubion\\p{L}+|zakładk\\p{L}+'),
    word('mam|mamy') + `\\s+${GAP}(?:w\\s+)?` + word('zapisan\\p{L}+|ulubion\\p{L}+|zakładkach'),
    // EN
    word("I(?:'ve|’ve)?|we(?:'ve|’ve)?") + `\\s+(?:have\\s+)?${GAP}` + word('saved|bookmarked|favou?rited'),
    word("I(?:'ve|’ve)?|we(?:'ve|’ve)?") + `\\s+(?:have\\s+)?${GAP}` + word('wanted') + '\\s+to\\s+' + word('go|visit|see|travel'),
    word('have|did') + '\\s+' + word('I|we') + `\\s+${GAP}` + word('saved?|bookmark(?:ed)?'),
    word('did') + '\\s+' + word('I|we') + `\\s+${GAP}` + word('want') + '\\s+to\\s+' + word('go|visit|see|travel'),
    word('my|our') + '\\s+' + word('saved|favou?rites?|bookmarks?|wish\\s?list'),
    word('from|among') + '\\s+(?:my\\s+|our\\s+)?' + word('saved|favou?rites|bookmarks'),
  ].join('|'),
  'iu',
)

/**
 * Вопрос о собственных местах посетителя: «Куда мне поехать из того, что я сохранила?», «мои планы»,
 * «куды я хацела паехаць», «що в мене заплановано», «z moich zapisanych», «my saved places». Узнаётся по
 * первому лицу рядом со словом сохранённого или планов: «что сохранилось от замка» и «планы города»
 * сюда не относятся. `null` — вопрос не о своём.
 */
export const detectOwnPlacesQuestion = (question: string | null | undefined): OwnPlacesKind | null => {
  const text = String(question ?? '')
  if (PLAN_RE.test(text)) return 'plans'
  return SAVED_RE.test(text) ? 'saved' : null
}

/** До трёх слов между «куда» и глаголом: «куда мне лучше поехать», «where should I go». */
const WIDE_GAP = "(?:[\\p{L}'’-]+\\s+){0,3}?"

const WHERE_TO_GO_RE = new RegExp(
  [
    word('куда') + `\\s+${WIDE_GAP}` + word('поехать|съездить|сходить|отправиться|махнуть|выбраться|поедем|ехать|пойти'),
    word('куда') + '\\s+на\\s+' + word('выходные|праздники|каникулы|отпуск'),
    word('что') + `\\s+${WIDE_GAP}` + word('посмотреть|посетить|увидеть'),
    word('посовету\\p{L}+|порекоменду\\p{L}+|подскаж\\p{L}+'),
    word('куды') + `\\s+${WIDE_GAP}` + word("паехаць|з['’ʼ]?ездзіць|схадзіць|выправіцца|пайсці|ехаць"),
    word('што') + `\\s+${WIDE_GAP}` + word('паглядзець|наведаць|пабачыць'),
    word('парай\\p{L}*|падкаж\\p{L}+'),
    word('куди') + `\\s+${WIDE_GAP}` + word("поїхати|з['’ʼ]?їздити|сходити|вирушити|піти|їхати"),
    word('що') + `\\s+${WIDE_GAP}` + word('подивитися|подивитись|відвідати|побачити'),
    word('порад\\p{L}+|підкаж\\p{L}+'),
    word('dokąd|gdzie') + `\\s+${WIDE_GAP}` + word('pojechać|jechać|wybrać\\s+się|pójść|wyjechać'),
    word('co') + `\\s+${WIDE_GAP}` + word('zobaczyć|zwiedzić|odwiedzić'),
    word('pole[ćc]\\p{L}*|doradź\\p{L}*'),
    word('where') + `\\s+${WIDE_GAP}` + word('go|travel|visit|head'),
    word('what') + `\\s+${WIDE_GAP}` + word('see|visit|do'),
    word('recommend|suggest'),
  ].join('|'),
  'iu',
)

/** Вопрос-просьба о рекомендации: «куда поехать», «что посмотреть», «where should I go» — на пяти языках. */
export const asksWhereToGo = (question: string | null | undefined): boolean => WHERE_TO_GO_RE.test(String(question ?? ''))

const uniqueIds = (places: readonly VisitorPlace[]): number[] => [...new Set(places.map((place) => place.id))]

/**
 * Материалы посетителя — кандидаты в карточки на вопрос о своём. На «мои планы» — только запланированные,
 * ранняя дата первой: у карточки нет пометки отметки, и «хочу посетить» рядом с запланированным модель
 * называла планом (живой замер 15.11.2026: «Что у меня в планах?» — 0 из 3). На «из сохранённого» — «хочу
 * посетить», избранное и запланированное. Посещённое и собственные статьи кандидатами не становятся:
 * вопрос о том, куда поехать.
 */
export const visitorCandidateIds = (context: VisitorContext, kind: OwnPlacesKind): number[] => {
  const dated = [...context.planned].sort((a, b) => (monthOf(a.date)?.time ?? Number.MAX_SAFE_INTEGER) - (monthOf(b.date)?.time ?? Number.MAX_SAFE_INTEGER))
  const saved = [...context.wishlist, ...context.favorites]
  return uniqueIds(kind === 'plans' ? dated : [...saved, ...dated])
}

const travelKey = (id: number | string): string => `travel:${id}`
const keyOf = (source: Pick<AiSource, 'type' | 'source_id'>): string => `${source.type}:${source.source_id}`

/** Ключи материалов, которые посетитель уже видел: отмечены «был» либо написаны им самим. */
export const seenSourceKeys = (context: VisitorContext): Set<string> => new Set([...context.visited.map((place) => place.id), ...context.own.ids].map(travelKey))

/**
 * Порядок подбора с понижением уже виденного: такие карточки встают после остальных, сохраняя свой
 * порядок между собой. Ни одна карточка не удаляется; нечего понижать — возвращается тот же массив.
 */
export const demoteSeen = <T extends Pick<AiSource, 'type' | 'source_id'>>(sources: readonly T[], seen: ReadonlySet<string>): readonly T[] => {
  if (!seen.size || !sources.some((source) => seen.has(keyOf(source)))) return sources
  return [...sources.filter((source) => !seen.has(keyOf(source))), ...sources.filter((source) => seen.has(keyOf(source)))]
}

const MIN_TITLE_KEY_CHARS = 12
/** Часть названия до подзаголовка: «Минск за выходные: путеводитель…» → «Минск за выходные». */
const headOf = (title: string): string => title.split(/\s*[:(]|\s+[—–-]\s+/u)[0].trim()

/**
 * Названия материалов сводки, которых нет среди карточек ответа, — как модель могла их увидеть и повторить:
 * полное название, его вид в строке «О посетителе» (обрезанный) и часть до подзаголовка. Слишком короткие
 * ключи («Гомель») не берутся: город из сводки упоминать можно, а название чужого материала — нет. Ключ,
 * который входит в название карточки ответа («Минск за выходные» при карточке «Минск за выходные зимой»),
 * тоже не берётся: иначе страж вырезал бы упоминание самой карточки.
 */
export const visitorTitlesOutside = (context: VisitorContext | null | undefined, sources: ReadonlyArray<Pick<AiSource, 'type' | 'source_id' | 'title'>>): string[] => {
  if (!context) return []
  const listed = new Set(sources.map(keyOf))
  const folded = (text: string): string => text.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
  const cardTitles = sources.map((source) => folded(String(source.title ?? '')))
  const keys = new Set<string>()
  for (const place of [...context.wishlist, ...context.planned, ...context.favorites, ...context.visited]) {
    if (listed.has(travelKey(place.id))) continue
    const full = cleanVisitorText(place.title, 200)
    const shown = cleanVisitorText(place.title, MAX_TITLE_CHARS).replace(/…$/u, '')
    const head = headOf(full)
    for (const key of [full, shown, /\s/.test(head) ? head : '']) {
      if ([...key].length >= MIN_TITLE_KEY_CHARS && !cardTitles.some((title) => title.includes(folded(key)))) keys.add(key)
    }
  }
  return [...keys].sort((a, b) => b.length - a.length)
}
