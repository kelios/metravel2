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
 *      режиме: место называет слово с заглавной буквы, а в вопросе без заглавных («пеший маршрут в
 *      шотландии») — слово после предлога места. Страна узнаётся на любом из пяти языков и в любом падеже
 *      («w Niemczech», «in Poland») по таблице `placeCountries.ts`. Общий список предлогов места
 *      (`topicGate.ts`) не расширяется: «на выходные» и «на два дня» местом не становятся.
 *      Вопрос называет место, которого газеттир не знает («в Беларуси», «в беларуси»), — блока нет: чужие
 *      маршруты на вопрос о конкретном месте не показываются. Месяц после предлога местом не считается.
 *      Часть света («в Европе», «in Asia», «w Ameryce Południowej») — отбор по странам этой части света
 *      (`namedContinents`, таблица `placeCountries.ts`): маршрут, чью страну таблица не знает, не проходит.
 *      В газеттир слово части света не идёт.
 *   3. Условия вопроса сверяет тот же `judgeCard`, что у материалов сайта: длиннее названной границы, вне
 *      расчётного сезона, заметно дольше названного числа дней — карточка в блок не идёт.
 *   4. Порядок: сколько условий совпало, затем смешанный ранг смысловой близости к вопросу и известности
 *      маршрута (число вики-статей) — тем же правилом слияния рангов, что гибрид «вектор + лексика».
 * В блок идут первые `AI_MAX_RECOMMENDATIONS`.
 *
 * Модуль общий для службы и тестов, без `@/`-импортов.
 */

import { AI_MAX_RECOMMENDATIONS } from '../../api/aiAssist/policy.ts'
import { continentsOfCodes, countryCodesOf, isContinentSide, isContinentWord, isPlaceForm, matchPlaceSources, namedContinents, namedCountryCodes, sameCountryWord, samePlaceWord } from '../../api/aiAssist/promptPlace.ts'
import { judgeCard, parseConditions, type QuestionConditions } from '../../api/aiAssist/questionConditions.ts'
import { namedDestinations } from '../../api/aiAssist/topicGate.ts'
import type { AiWorldTrail } from '../../api/aiAssist/trailFacts.ts'
import type { AiSource, AiSourcePlace } from '../../api/aiAssist/types.ts'

export type WorldCandidate = {
  card: AiWorldTrail
  /** Близость вопроса к лучшему фрагменту маршрута, косинус. */
  similarity: number
  /** Число статей Википедии и Wikivoyage о маршруте — мера известности. */
  fame: number
  /**
   * Место маршрута для газеттира (`gazetteerPlace`): `cities` — места ниже страны (регион, остров, горная
   * система), `countries` — страны; названия на всех языках индекса. `codes` — коды стран маршрута по
   * таблице `placeCountries.ts`; пусто или нет поля — страну определить нельзя.
   */
  place: WorldPlace
  /** Ключи названий и псевдонимов маршрута (`titleKeys`): по ним вопрос называет сам маршрут. */
  titles: readonly string[]
}

export type WorldPlace = AiSourcePlace & { codes?: readonly string[] }

/** Внешний подбор нужен: вопрос о пешем маршруте. */
export const asksForWorldTrails = (conditions: QuestionConditions): boolean => conditions.route === 'foot'

/** Константа слияния рангов — та же, что у гибрида подбора (`RRF_K`, `scripts/ai-assist/search.ts`). */
const RANK_K = 60

/**
 * Часть света и «весь мир» — не место, которого газеттир не знает: блок они не закрывают. Часть света
 * отбирает маршруты по странам (`namedContinents`; её падежные формы — `isContinentWord`), «в мире» — вопрос
 * без места.
 */
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
    // Вопрос без заглавных букв читается по предлогу (#3416): «по дороге на юг» находил место «Дорога», «по
    // острову» — «Острів» (замер на наборах контура оценки, 316 вопросов).
    'дорог\\p{L}*', 'остр[іо]в\\p{L}*', 'drog\\p{L}*', 'road',
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

/** Названия одного места на языках индекса: язык → название. */
export type PlaceNames = Readonly<Record<string, string | undefined>>

const nameWords = (name: string | undefined): string[] => gazetteerWords([name]).map(fold)

/**
 * Чужие слова в названиях мест (#3357, D1): слово, которым называется другое место индекса, а в названии
 * этого стоит не на всех языках. «Прованс — Альпы — Лазурный Берег» по-английски — «Provence-Alpes-Côte
 * d'Azur», «Dinaric Alps» по-русски — «Динарское нагорье», «Новая Шотландия» — «Nova Scotia»: слово «Альпы»
 * или «Шотландия» здесь — особенность перевода, а не принадлежность месту, и маршрут вокруг Марселя (GR
 * 2013) на вопрос об Альпах идти не должен. У «Грайских Альп» и «Высоких Татр» слово стоит на всех языках —
 * оно остаётся.
 *
 * «Другое место» — то, чьё название на каждом языке — одно слово газеттира («Альпы», «Alps», «Alpy»); общие
 * слова («Новая», «Восточная») в счёт не идут, поэтому «Восточная Англия» согласована с Англией, а «Новая
 * Шотландия» с Шотландией — нет. Мест с одним названием в индексе бывает несколько — слово остаётся, если
 * согласуется хотя бы с одним.
 * Возвращает по идентификатору места слова, которые у него не считаются; считается один раз при загрузке.
 */
export const borrowedPlaceWords = (places: ReadonlyArray<{ qid: string; names: PlaceNames }>): Map<string, Set<string>> => {
  const unique = new Map(places.map((place) => [place.qid, place]))
  type Head = { qid: string; words: Map<string, string> }
  const headsByWord = new Map<string, Head[]>()
  const wordsOfPlace = new Map<string, Map<string, string[]>>()
  for (const place of unique.values()) {
    const byLocale = new Map(Object.entries(place.names).map(([locale, name]) => [locale, nameWords(name)] as const))
    wordsOfPlace.set(place.qid, byLocale)
    if (!byLocale.size || [...byLocale.values()].some((words) => words.length !== 1)) continue
    const head: Head = { qid: place.qid, words: new Map([...byLocale].map(([locale, words]) => [locale, words[0]])) }
    for (const word of new Set(head.words.values())) headsByWord.set(word, [...(headsByWord.get(word) ?? []), head])
  }
  // Место согласовано с «другим местом»: на каждом общем языке его название несёт слово того места.
  const agrees = (byLocale: ReadonlyMap<string, string[]>, head: Head): boolean =>
    [...byLocale].every(([locale, words]) => {
      const own = head.words.get(locale)
      return own === undefined || words.some((word) => word === own || isPlaceForm(word, own) || isPlaceForm(own, word))
    })
  // Тёзки — два элемента с одним и тем же названием целиком («Татры» и «Татры», «Уэльс» и «Уэльс»): разница
  // в написании на другом языке («Tatra Mountains» и «Tatras») чужим слово не делает.
  const wholeNames = (place: { names: PlaceNames }): Set<string> =>
    new Set(Object.values(place.names).flatMap((name) => (name && !/[^\p{L}\p{N}]/u.test(name.trim()) ? [fold(name.trim())] : [])))
  const namesake = (qid: string, head: Head): boolean => {
    const whole = wholeNames(unique.get(qid)!)
    return [...head.words.values()].some((word) => whole.has(word))
  }
  const borrowed = new Map<string, Set<string>>()
  for (const [qid, byLocale] of wordsOfPlace) {
    for (const words of byLocale.values()) {
      for (const word of words) {
        const heads = (headsByWord.get(word) ?? []).filter((head) => head.qid !== qid)
        if (!heads.length || heads.some((head) => namesake(qid, head) || agrees(byLocale, head))) continue
        const own = borrowed.get(qid) ?? new Set<string>()
        for (const head of heads) for (const other of head.words.values()) own.add(other)
        borrowed.set(qid, own)
      }
    }
  }
  return borrowed
}

/** Названия места без чужих слов (`borrowedPlaceWords`) — вход `gazetteerPlace`. */
export const ownPlaceNames = (place: { qid: string; names: PlaceNames }, borrowed: ReadonlyMap<string, ReadonlySet<string>>): string[] => {
  const skip = borrowed.get(place.qid)
  const names = Object.values(place.names).filter((name): name is string => Boolean(name))
  if (!skip?.size) return names
  return names.map((name) => name.split(/([^\p{L}\p{N}]+)/u).filter((part) => !skip.has(fold(part))).join(''))
}

/**
 * Место маршрута для сверки: слова газеттира мест ниже страны и стран. Слово, которым названа и страна
 * маршрута — в любом падеже и на любом языке (остров «Великобритания», «метрополия Франции», «Jura
 * Szwabska w Niemczech»), — остаётся только у страны: иначе вопрос о стране находил бы лишь маршруты, у
 * которых названо такое место («w Niemczech» — 24 маршрута из всех немецких, #3416).
 *
 * Слово части света в газеттир не идёт (#3357, D2) — ни из места («Северная Европа» у одного маршрута на
 * 2 733 км: вопрос о Европе получал пустой блок), ни из названия страны («Сполучені Штати Америки»,
 * «Południowa Afryka»: «в Южной Америке» находил бы маршруты США). Часть света считается по кодам стран
 * `codes`: их даёт название страны целиком, до разбора на слова («Новая Зеландия», «United States», «ЮАР»).
 */
export const gazetteerPlace = (places: ReadonlyArray<string | null | undefined>, countries: ReadonlyArray<string | null | undefined>): WorldPlace => {
  const countryWords = gazetteerWords(countries).filter((word) => !isContinentWord(fold(word)))
  const taken = countryWords.map(fold)
  const ofCountry = (word: string): boolean => taken.some((country) => samePlaceWord(country, word) || sameCountryWord(country, word))
  return { cities: gazetteerWords(places).filter((word) => !isContinentWord(fold(word)) && !ofCountry(fold(word))), countries: countryWords, codes: countryCodesOf(countries) }
}

const titleKey = (value: unknown): string => fold(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/**
 * Ключи названий маршрута: без диакритики, регистра и знаков. Названием вопроса служит только достаточно
 * длинное: от двух слов (не короче семи букв) либо от восьми букв — «E4», «Camino» и «The Way» в вопросе
 * маршрут не называют. Исключение — название-шифр из букв и номера («GR 20», «GR20», «TMB 1», #3431): оно
 * короткое, но своё; в вопросе засчитывается только написанное заглавными («Расскажи про GR 20»), как
 * любое название короче трёх слов (`namesTrail`). Шифр из одной буквы («E4») по-прежнему не название.
 */
const CODE_TITLE_RE = /^\p{L}{2,5} ?\d{1,4}$/u
export const titleKeys = (titles: ReadonlyArray<string | null | undefined>): string[] => [
  ...new Set(
    titles.map(titleKey).filter((key) => {
      const letters = key.replace(/ /g, '').length
      return letters >= 8 || (key.includes(' ') && letters >= 7) || CODE_TITLE_RE.test(key)
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
  // Страна названа на другом языке, чем в индексе («в Угорщині» при «Венгрия», «Hungary»): первые буквы не
  // совпадут, карточку оставляет код страны из общей таблицы.
  const askedCountries = namedCountryCodes(placeText)
  const ofLevel = (level: keyof AiSourcePlace): WorldCandidate[] | null => {
    const countries = level === 'countries'
    const near = candidates.filter(
      (candidate) =>
        candidate.place[level]?.some((word) => heads.has(fold(word).slice(0, 2))) ||
        (countries && askedCountries.length > 0 && countryCodesOf(candidate.place.countries).some((code) => askedCountries.includes(code))),
    )
    // Названия стран на остальных языках добавляются только настоящим странам: уровень мест ниже страны
    // передаётся тем же полем, и штат Джорджия Грузией стать не должен.
    return near.length
      ? (matchPlaceSources(placeText, near.map((candidate) => asPlaceSource(candidate, candidate.place[level])), ['countries'], { strict: true, lowercase: true, countryForms: countries })?.map((source) => source.candidate) ?? null)
      : null
  }
  const inPlace = ofLevel('cities')
  // Страна, чьё название газеттир на слова не раскладывает («США», «ЮАР»), находится по коду таблицы.
  const byCode = askedCountries.length ? candidates.filter((candidate) => candidate.place.codes?.some((code) => askedCountries.includes(code))) : []
  const byWord = ofLevel('countries')
  const inCountry = byCode.length ? [...new Set([...(byWord ?? []), ...byCode])] : byWord
  const both = inPlace && inCountry ? inPlace.filter((candidate) => inCountry.includes(candidate)) : null
  // Названы и место, и страна, а общих маршрутов нет — слово вопроса называет страну, а место лишь носит её
  // имя (#3357): «в Швейцарии» — это Швейцария, а не три маршрута Саксонской Швейцарии.
  const ofPlace = both?.length ? both : (inCountry ?? inPlace)
  // Часть света — отбор по странам (#3357): «в Европе» — маршруты стран Европы, а не весь индекс.
  const continents = namedContinents(placeText)
  let pool: readonly WorldCandidate[]
  if (ofPlace) pool = ofPlace
  else {
    // «in June», «w lipcu»: название месяца после предлога места — условие сезона, а не место. «Северной» перед
    // «Америке» — уточнение части света; у остальных («в Северной Европе») — место, которого газеттир не знает.
    const narrowed = continents?.length === 1 && (continents[0] === 'north-america' || continents[0] === 'south-america')
    const unknown = namedDestinations(placeText).filter(
      (place) => !BROAD_PLACE_RE.test(place) && !isContinentWord(fold(place)) && !(narrowed && isContinentSide(place)) && !parseConditions(place).months?.length,
    )
    // Страна из общей таблицы названа и со строчной буквы («в беларуси»): её маршрутов в индексе нет.
    if (unknown.length || askedCountries.length) return namedCards.slice(0, limit)
    pool = candidates
  }
  // Маршрут, чью страну таблица не знает, под отбор по части света не проходит.
  if (continents) pool = pool.filter((candidate) => continentsOfCodes(candidate.place.codes ?? []).some((continent) => continents.includes(continent)))

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
