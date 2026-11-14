/**
 * Подбор маршрутов мира под вопрос (#3357) — второй ярус ответа, блок «Ещё в мире».
 *
 * Внешний подбор идёт после материалов сайта и включается двумя способами: вопрос о пешем маршруте
 * (условие `route: 'foot'`, #3353) либо вопрос называет сам маршрут («West Highland Way», «Тур дю
 * Монблан»). Кандидаты — все карточки внешнего индекса (их сотни, перебор дешёвый):
 *   1. Название. Маршрут, чьё название или псевдоним стоит в вопросе дословно, встаёт первым и условиями
 *      вопроса не отсеивается: спросили именно о нём.
 *   2. Место — по газеттиру самого внешнего индекса: страны и места маршрутов (регион, остров, горная
 *      система) на пяти языках. Вопрос называет место из газеттира («в Шотландии», «на Корсике», «w
 *      Polsce») — в блок идут только маршруты этого места. Падежные формы и омонимы обычных слов разбирает
 *      тот же код, что отбирает карточки сайта по месту (`matchPlaceSources`, `promptPlace.ts`), в строгом
 *      режиме: место называет только слово с заглавной буквы. Общий список предлогов места (`topicGate.ts`)
 *      не расширяется: «на выходные» и «на два дня» местом не становятся.
 *      Вопрос называет место, которого газеттир не знает («в Беларуси»), — блока нет: чужие маршруты на
 *      вопрос о конкретном месте не показываются. Часть света и месяц после предлога местом не считаются.
 *   3. Условия вопроса сверяет тот же `judgeCard`, что у материалов сайта: длиннее названной границы, вне
 *      расчётного сезона, заметно дольше названного числа дней — карточка в блок не идёт.
 *   4. Порядок: сколько условий совпало, затем смешанный ранг смысловой близости к вопросу и известности
 *      маршрута (число вики-статей) — тем же правилом слияния рангов, что гибрид «вектор + лексика».
 * В блок идут первые `AI_MAX_RECOMMENDATIONS`.
 *
 * Модуль общий для службы и тестов, без `@/`-импортов.
 */

import { AI_MAX_RECOMMENDATIONS } from './policy.ts'
import { matchPlaceSources, samePlaceWord } from './promptPlace.ts'
import { judgeCard, parseConditions, type QuestionConditions } from './questionConditions.ts'
import { namedDestinations } from './topicGate.ts'
import type { AiWorldTrail } from './trailFacts.ts'
import type { AiSource, AiSourcePlace } from './types'

export type WorldCandidate = {
  card: AiWorldTrail
  /** Близость вопроса к лучшему фрагменту маршрута, косинус. */
  similarity: number
  /** Число статей Википедии и Wikivoyage о маршруте — мера известности. */
  fame: number
  /**
   * Место маршрута для газеттира (`gazetteerPlace`): `cities` — места ниже страны (регион, остров, горная
   * система), `countries` — страны; названия на всех языках индекса.
   */
  place: AiSourcePlace
  /** Ключи названий и псевдонимов маршрута (`titleKeys`): по ним вопрос называет сам маршрут. */
  titles: readonly string[]
}

/** Внешний подбор нужен: вопрос о пешем маршруте. */
export const asksForWorldTrails = (conditions: QuestionConditions): boolean => conditions.route === 'foot'

/** Константа слияния рангов — та же, что у гибрида подбора (`RRF_K`, `scripts/ai-assist/search.ts`). */
const RANK_K = 60

/** Часть света и «весь мир» местом отбора не служат: «пеший маршрут в Европе» — вопрос без места. */
const BROAD_PLACE_RE = /^(?:европ|еўроп|європ|europ|ази|азі|asia|azj|америк|амерык|americ|ameryk|африк|афрык|afri|afry|мир|свет|світ|world|świat|swiat)/iu

const fold = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()

/**
 * Слова названий, которые сами места не называют: стороны света, «новый», «остров», «национальный парк»,
 * «провинция». Без них «Новая тропа…» находила бы Новую Зеландию, а «North of Spain» — Северный остров.
 * Записаны без диакритики и в нижнем регистре; прилагательные — основой.
 */
const GENERIC_PLACE_WORD_RE = new RegExp(
  `^(?:${[
    'нов(?:ая|ыи|ое|ые|ои|ую|а|ы|и)', 'северн\\p{L}*', 'южн\\p{L}*', 'восточн\\p{L}*', 'западн\\p{L}*', 'центральн\\p{L}*', 'верхн\\p{L}*', 'нижн\\p{L}*', 'больш(?:ои|ая|ое|ие|ого|ую)', 'мал(?:ая|ыи|ое|ые)',
    'пауночн\\p{L}*', 'пауднев\\p{L}*', 'усходн\\p{L}*', 'заходн\\p{L}*', 'північн\\p{L}*', 'південн\\p{L}*', 'східн\\p{L}*', 'західн\\p{L}*',
    // Только прилагательное: «Великобритания» и «Вялікабрытанія» — названия, а не «великий».
    'велик(?:ии|ая|ое|ие|ого|ую|а|е|і)', 'вялік(?:і|ая|ае|ія)', 'wielk(?:i|a|ie|iej)',
    'остров\\p{L}*', 'востра\\p{L}*', 'гор(?:а|ы)', 'долин\\p{L}*', 'побереж\\p{L}*', 'рек(?:а|и)', 'парк\\p{L}*', 'национальн\\p{L}*', 'нацыянальн\\p{L}*', 'національн\\p{L}*', 'раион\\p{L}*', 'област\\p{L}*', 'округ\\p{L}*',
    'краи', 'провинци\\p{L}*', 'штат', 'кантон\\p{L}*', 'регион\\p{L}*', 'рэгіен\\p{L}*', 'регіон\\p{L}*', 'метропол\\p{L}*', 'метрапол\\p{L}*', 'озер\\p{L}*', 'возер\\p{L}*', 'республик\\p{L}*', 'соединенн\\p{L}*', 'федера\\p{L}*', 'массив\\p{L}*', 'хребет', 'полуостров\\p{L}*', 'автономн\\p{L}*', 'сообществ\\p{L}*',
    'new', 'north(?:ern)?', 'south(?:ern)?', 'east(?:ern)?', 'west(?:ern)?', 'central', 'upper', 'lower', 'great(?:er)?', 'little', 'national', 'park', 'islands?', 'isle', 'mount', 'mountains?', 'valley', 'coast',
    'river', 'county', 'province', 'state', 'region', 'district', 'forest', 'peninsula', 'range', 'massif', 'republic', 'united', 'federal', 'community', 'council', 'area', 'city', 'san', 'santa', 'sankt', 'canton', 'lake', 'bay', 'the', 'and',
    // «ł» после `fold` остаётся «ł»: «Północna», «Południowo», «Półwysep», «Łańcuch».
    'now(?:a|y|e)', 'po[lł]nocn\\p{L}*', 'po[lł]udniow\\p{L}*', 'wschodn\\p{L}*', 'zachodn\\p{L}*', 'wysp(?:a|y)', 'gor(?:a|y)', 'dolina', 'narodow\\p{L}*', 'wojewodztwo', 'powiat', 'gmina', 'republika', 'zjednoczon\\p{L}*', 'po[lł]wysep',
    'pasmo', 'masyw', 'wspolnota', 'autonomiczn\\p{L}*', 'okreg', 'prowincja', 'hrabstwo', 'jezioro', 'kanton\\p{L}*', 'metropolitaln\\p{L}*', 'metropolitarn\\p{L}*',
    // Частые общие слова мест слоя (замер 14.11.2026): «Trenčiansky kraj», «Юго-Восточная Англия», «Dolny Śląsk»,
    // «Grand Canyon», «Святого …», «Middle …», «Landkreis …» — вопрос «near Grand Canyon» или «Middle East» иначе
    // находил бы чужие маршруты.
    'kraj', 'municipality', 'government', 'voivodeship', 'landkreis', 'rejencja', 'раен\\p{L}*', 'юго', 'северо', 'middle', 'средн\\p{L}*', 'сярэдн\\p{L}*', 'середн\\p{L}*', 'ніжн\\p{L}*',
    'srodkow\\p{L}*', 'doln\\p{L}*', 'gorn\\p{L}*', '[lł]ancuch\\p{L}*', 'american\\p{L}*', 'американ\\p{L}*', 'амерыкан\\p{L}*', 'gran(?:d|de)?', 'canyon', 'свят\\p{L}*', 'swiet\\p{L}*', 'sainte?',
    // Складчатый пояс через всю Евразию (Q847514, «часть от» Альп и Гималаев у 42 маршрутов): по нему «в Альпах»
    // находил Annapurna Circuit.
    'alpide', 'альп[иі]и?с\\p{L}*', 'гімалаи?ск\\p{L}*', 'гималаи?ск\\p{L}*', 'средиземноморск\\p{L}*', 'середземноморськ\\p{L}*',
  ].join('|')})$`,
  'u',
)

/**
 * Слова газеттира из названий мест: каждое слово с заглавной буквы — отдельной записью, без общих слов и
 * без названий месяцев («May» после «in» — условие сезона, а не место). Так «West Highland Way» находится
 * по региону «Highland», а «Северный остров» местом не становится. Считается один раз при загрузке индекса.
 */
export const gazetteerWords = (names: ReadonlyArray<string | null | undefined>): string[] => {
  const words = new Set<string>()
  for (const name of names) {
    for (const raw of String(name ?? '').split(/[^\p{L}\p{N}]+/u)) {
      // Слово из трёх букв («Мар», «Las», «Uri») совпадало бы с началом обычных слов: «Марии», «Las Vegas».
      if (raw.length < 4 || !/^\p{Lu}/u.test(raw)) continue
      // «May» разбор условий месяцем без предлога не считает (это ещё и глагол) — проверяется и «in May».
      if (GENERIC_PLACE_WORD_RE.test(fold(raw)) || parseConditions(raw).months?.length || parseConditions(`in ${raw}`).months?.length) continue
      words.add(raw)
    }
  }
  return [...words]
}

/**
 * Место маршрута для сверки: слова газеттира мест ниже страны и стран. Слово, которым названа и страна
 * маршрута — в любом падеже (остров «Великобритания», «метрополия Франции»), — остаётся только у страны:
 * иначе вопрос о стране находил бы лишь маршруты, у которых названо такое место.
 */
export const gazetteerPlace = (places: ReadonlyArray<string | null | undefined>, countries: ReadonlyArray<string | null | undefined>): AiSourcePlace => {
  const countryWords = gazetteerWords(countries)
  const taken = countryWords.map(fold)
  return { cities: gazetteerWords(places).filter((word) => !taken.some((country) => samePlaceWord(country, fold(word)))), countries: countryWords }
}

const titleKey = (value: unknown): string => fold(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/**
 * Ключи названий маршрута: без диакритики, регистра и знаков. Названием вопроса служит только достаточно
 * длинное: от двух слов (не короче семи букв) либо от восьми букв — «E4», «GR 20», «Camino» и «The Way» в
 * вопросе маршрут не называют.
 */
export const titleKeys = (titles: ReadonlyArray<string | null | undefined>): string[] => [
  ...new Set(
    titles.map(titleKey).filter((key) => {
      const letters = key.replace(/ /g, '').length
      return letters >= 8 || (key.includes(' ') && letters >= 7)
    }),
  ),
]

/**
 * Название короче трёх слов бывает нарицательным: «Long Trail», «River Trail», «French Way», «Тропа
 * мира» — «a long trail in Poland» маршрут Вермонта не называет. Такое название засчитывается, только
 * когда каждое его слово в вопросе с заглавной буквы.
 */
const CASE_FREE_TITLE_WORDS = 3

/** Вопрос дословно называет маршрут: одно из его названий стоит в вопросе целыми словами. */
export const namesTrail = (query: string | null | undefined, keys: readonly string[]): boolean => {
  if (!keys.length) return false
  const cased = ` ${String(query ?? '').normalize('NFD').replace(/\p{M}+/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `
  const text = cased.toLowerCase()
  return keys.some((key) => {
    const needle = ` ${key} `
    if (key.split(' ').length >= CASE_FREE_TITLE_WORDS) return text.includes(needle)
    for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
      if (cased.slice(at + 1, at + needle.length - 1).split(' ').every((word) => /^[\p{Lu}\p{N}]/u.test(word))) return true
    }
    return false
  })
}

/** Вопрос без названий маршрутов: регистр остальных слов сохраняется — по нему узнаётся место. */
const withoutTitles = (query: string, keys: readonly string[]): string => {
  let text = query.normalize('NFD').replace(/\p{M}+/gu, '')
  for (const key of [...keys].sort((a, b) => b.length - a.length)) {
    const phrase = key.split(' ').map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^\\p{L}\\p{N}]+')
    text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, 'giu'), ' ')
  }
  return text
}

const rankOf = <T>(items: readonly T[], value: (item: T) => number): Map<T, number> => {
  const sorted = [...items].sort((a, b) => value(b) - value(a))
  return new Map(sorted.map((item, index) => [item, index]))
}

/**
 * Кандидат в виде, который понимает отбор по месту сайта: вид `quest` — место сверяется только по полю
 * `place`. Слова идут уровнем `countries`: на уровне `cities` отбор сайта считает все названия карточки
 * написаниями одного города и расширяет ими названное место — у маршрута же мест много («Альпы», «Овернь —
 * Рона — Альпы», «Canton of Valais»), и через общее слово «Canton» вопрос об Альпах находил бы Weg der
 * Schweiz, а через «Метраполія Францыі» — GR 20.
 */
const asPlaceSource = (candidate: WorldCandidate, words: AiSourcePlace['countries']): AiSource & { candidate: WorldCandidate } => ({
  type: 'quest',
  source_id: candidate.card.source_id,
  title: '',
  url: '',
  path: '',
  snippet: '',
  score: 0,
  place: { countries: words },
  candidate,
})

export const selectWorldTrails = (query: string | null | undefined, candidates: readonly WorldCandidate[], limit: number = AI_MAX_RECOMMENDATIONS): AiWorldTrail[] => {
  const text = String(query ?? '')
  const conditions = parseConditions(text)
  if (!candidates.length) return []
  // 1. Вопрос называет сам маршрут — он первым и без сверки условий.
  const named = candidates.filter((candidate) => namesTrail(text, candidate.titles))
  const foot = asksForWorldTrails(conditions)
  if (!foot && !named.length) return []
  const namedCards = named.sort((a, b) => b.fame - a.fame).map((candidate) => candidate.card)
  // Вопрос только о названном маршруте («West Highland Way») — другие маршруты к нему не добавляются.
  if (!foot) return namedCards.slice(0, limit)

  // 2. Место — по газеттиру индекса; место, которого газеттир не знает, блок закрывает.
  // Слова названного маршрута место не называют: «West Highland Way за 5 дней» — не вопрос о регионе Хайленд.
  const placeText = named.length ? withoutTitles(text, named.flatMap((candidate) => candidate.titles)) : text
  // Названы и место, и страна («в Шотландии, Великобритания») — берётся более узкое: пересечение.
  // Отбор сайта по месту разбирает слова всех переданных карточек; передаются только карточки, у которых
  // слово места начинается с тех же двух букв, что слово вопроса: две первые буквы названия сохраняет любая
  // его основа (`stemsOf`, «Київ — Києва»), а общее начало совпадения не короче трёх букв (`promptPlace.ts`).
  // Так перебор не идёт по тысячам слов на каждый вопрос.
  const heads = new Set(fold(placeText).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3).map((word) => word.slice(0, 2)))
  const ofLevel = (level: keyof AiSourcePlace): WorldCandidate[] | null => {
    const near = candidates.filter((candidate) => candidate.place[level]?.some((word) => heads.has(fold(word).slice(0, 2))))
    return near.length ? (matchPlaceSources(placeText, near.map((candidate) => asPlaceSource(candidate, candidate.place[level])), ['countries'], { strict: true })?.map((source) => source.candidate) ?? null) : null
  }
  const inPlace = ofLevel('cities')
  const inCountry = ofLevel('countries')
  const both = inPlace && inCountry ? inPlace.filter((candidate) => inCountry.includes(candidate)) : null
  const ofPlace = both?.length ? both : (inPlace ?? inCountry)
  let pool: readonly WorldCandidate[]
  if (ofPlace) pool = ofPlace
  else {
    // «in June», «w lipcu»: название месяца после предлога места — условие сезона, а не место.
    const unknown = namedDestinations(placeText).filter((place) => !BROAD_PLACE_RE.test(place) && !parseConditions(place).months?.length)
    if (unknown.length) return namedCards.slice(0, limit)
    pool = candidates
  }

  // 3–4. Условия и порядок.
  const taken = new Set(named)
  const passed = pool
    .filter((candidate) => !taken.has(candidate))
    .map((candidate) => ({ candidate, verdict: judgeCard(conditions, { type: candidate.card.type, trail: candidate.card }) }))
    .filter((entry) => !entry.verdict.dropped && !entry.verdict.unfit)
  const bySimilarity = rankOf(passed, (entry) => entry.candidate.similarity)
  const byFame = rankOf(passed, (entry) => entry.candidate.fame)
  const blended = (entry: (typeof passed)[number]): number => 1 / (RANK_K + (bySimilarity.get(entry) ?? 0)) + 1 / (RANK_K + (byFame.get(entry) ?? 0))
  const rest = passed
    .sort((a, b) => b.verdict.score - a.verdict.score || blended(b) - blended(a) || a.candidate.card.source_id.localeCompare(b.candidate.card.source_id, 'en', { numeric: true }))
    .map((entry) => entry.candidate.card)
  return [...namedCards, ...rest].slice(0, limit)
}
