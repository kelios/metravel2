/**
 * Подбор карточек сайта под вопрос (#2460).
 *
 * Оценка модели v0 (#2462): ответы по форме держит, но ССЫЛКИ И НАЗВАНИЯ
 * ВЫДУМЫВАЕТ (57 несуществующих URL в 40 ответах). Поэтому ссылки даёт только
 * подбор: статьи — поиском бэкенда `/api/travels/?query=`, квесты — по
 * каталогу (у `/api/quests/` поиска нет, каталог компактный и кэшируется);
 * модель лишь формулирует ответ по подставленным карточкам. Смысловой индекс
 * (#2454/#2456) заменит этот слой тем же контрактом `AiSource[]`.
 */

import { getActiveQueryClient } from '@/api/activeQueryClient'
import { queryKeys } from '@/api/queryKeys'
import { fetchQuestsCompactCatalog, type ApiQuestMeta } from '@/api/quests'
import { fetchTravel } from '@/api/travelDetailsQueries'
import { fetchTravels } from '@/api/travelListQueries'
import { QUESTS_LIST_GC_TIME, QUESTS_LIST_STALE_TIME } from '@/hooks/questsListCachePolicy'
import { useAuthStore } from '@/stores/authStore'
import type { Travel } from '@/types/types'
import { enabledQuestTags } from '@/utils/questTags'
import { buildQuestPath, buildTravelPathFromTravel } from '@/utils/routePaths'
import { buildCanonicalUrl } from '@/utils/seo'

import { AI_SOURCES_LIMIT } from './policy'
import { routeOriginMatcher } from './promptPlace'
import { asksAboutChildren, childrenRank } from './questAudience'
import { detectIntent, type AiSourceIntent } from './retrievalQuery'
import { questFactsLine, questFactsOf, travelFactsLine, travelFactsOf } from './sourceFacts'
import type { AiSourceRef } from './sourceRef'
import type { AiSource } from './types'

export { AI_SOURCES_LIMIT }
/**
 * Статей у бэкенда берётся вдвое больше лимита карточек: порядок бэкенда ставит
 * «Краков: путеводитель» пятым, «Что посмотреть вокруг Кракова» — восьмым, и
 * переранжирование по словам вопроса («посмотреть») поднимает их наверх (#2709).
 */
const TRAVELS_PAGE_SIZE = 16
const SNIPPET_MAX_LENGTH = 320
const MIN_TOKEN_LENGTH = 3
/** `fetchTravels` считает страницы с нуля (`buildWhereQueryParams` шлёт `page + 1`). */
const TRAVELS_FIRST_PAGE = 0

/**
 * Те же служебные слова на BE/UK/PL/EN (#3315). Список был только русским, и на остальных языках
 * слово вопроса выбирало чужую карточку: PL «trzy» — «…trzynaste źródło» (Карловы Вары) и «…trzy
 * stulecia» (Кобрин), «questy» — слово «Quest» в названии любого квеста, UK «які» — «гноми, які
 * пішли» (Кёльн); приёмка 11.11.2026, v5ln03 и h29. Слова записаны как после `normalizeText`
 * (строчные, «ё» → «е»); короче трёх букв токенами не становятся и здесь не нужны.
 */
const OTHER_LOCALE_STOPWORDS = [
  // BE
  'якія', 'які', 'якая', 'якое', 'якіх', 'што', 'дзе', 'куды', 'калі', 'есць', 'можна', 'трэба', 'хачу', 'хочам',
  'паехаць', 'схадзіць', 'прайсці', 'мяне', 'мне', 'нам', 'нас', 'вам', 'вас', 'дзень', 'дня', 'дзен', 'дні',
  'два', 'дзве', 'тры', 'пару', 'вельмі', 'падкажы', 'падкажыце', 'параі', 'парай', 'параіце', 'лепш', 'зараз', 'каб',
  'для', 'або', 'пад', 'пры', 'пра', 'гэта', 'гэты', 'гэтая', 'там', 'тут', 'яшчэ', 'іх', 'яго', 'гэтых', 'гэтага', 'туды', 'адтуль',
  'двух', 'трох', 'чатырох', 'пяці', 'больш', 'менш', 'варыянт', 'варыянта', 'варыянтаў', 'варыянты',
  'квэст', 'квэсты', 'квэста', 'квэстаў', 'квэсту', 'квэстам', 'квэстах', 'маршруты', 'маршрутаў',
  'артыкул', 'артыкулы', 'артыкула', 'артыкулаў', 'матэрыял', 'матэрыялы', 'матэрыялаў', 'сайце',
  'спасылка', 'спасылку', 'спасылкі', 'спасылкай', 'спасылак',
  'дайце', 'назаві', 'назавіце', 'кожны', 'кожная', 'кожнага',
  'гадоў', 'гады', 'гадкоў',
  // UK
  'яка', 'яке', 'який', 'яких', 'що', 'куди', 'коли', 'треба', 'хочемо', 'поїхати', 'сходити', 'мене', 'мені',
  'днів', 'дві', 'дуже', 'підкажи', 'підкажіть', 'порадь', 'порадьте', 'краще', 'щоб', 'якщо', 'під', 'цей', 'ця',
  'ще', 'нього', 'неї', 'цих', 'цього', 'цієї', 'туди', 'звідти', 'двох', 'трьох', 'чотирьох', 'більше', 'менше',
  'варіант', 'варіанта', 'варіантів', 'варіанти', 'квести', 'квестів', 'квесті', 'маршрути', 'маршрутів',
  'стаття', 'статті', 'статтю', 'матеріал', 'матеріали', 'матеріалів', 'сайті',
  'посилання', 'посиланням', 'посилань',
  'назви', 'назвіть', 'кожен', 'кожна', 'кожного',
  'років', 'роки', 'рочків',
  // PL
  'jakie', 'jaki', 'jaka', 'jakich', 'które', 'który', 'która', 'których', 'gdzie', 'dokąd', 'kiedy', 'jak', 'jest', 'czy',
  'można', 'trzeba', 'chcę', 'chcemy', 'pojechać', 'pójść', 'przejść', 'mnie', 'nam', 'nas', 'wam', 'was',
  'dzień', 'dnia', 'dni', 'dwa', 'dwie', 'trzy', 'kilka', 'bardzo', 'podpowiedz', 'podaj', 'poleć', 'lepiej', 'teraz',
  'żeby', 'jeśli', 'dla', 'lub', 'albo', 'pod', 'przy', 'ten', 'tam', 'tutaj', 'jeszcze', 'nich', 'niego', 'niej',
  'tych', 'tego', 'tej', 'dwóch', 'trzech', 'czterech', 'pięciu', 'więcej', 'mniej', 'najwyżej', 'najmniej',
  'każdy', 'każda', 'każde', 'wariant', 'warianty', 'wariantów',
  'quest', 'questy', 'questów', 'questu', 'queście', 'questach', 'kwest', 'kwesty', 'kwestów',
  'trasa', 'trasy', 'tras', 'trasę', 'artykuł', 'artykuły', 'artykułów', 'materiał', 'materiały', 'materiałów', 'stronie',
  'lat', 'lata', 'latka', 'roku',
  'odnośnik', 'odnośniki', 'odnośnikiem', 'odnośnikami', 'link', 'linki', 'linkiem', 'linkami',
  // EN
  'which', 'what', 'where', 'when', 'how', 'are', 'there', 'the', 'can', 'could', 'should', 'would', 'want', 'need',
  'have', 'has', 'for', 'and', 'with', 'from', 'this', 'that', 'these', 'those', 'any', 'some', 'our', 'your', 'you',
  'them', 'they', 'their', 'its', 'not', 'one', 'two', 'three', 'four', 'five', 'more', 'less', 'than', 'most', 'least',
  'each', 'option', 'options', 'please', 'tell', 'show', 'give', 'suggest', 'recommend', 'day', 'days',
  'year', 'years', 'old', 'name', 'every', 'quests', 'routes', 'route', 'article', 'articles', 'material', 'materials', 'site', 'links',
]

/**
 * Слова вопроса, которые есть почти в каждой карточке и не выбирают её: вопросительные,
 * «поехать/сходить» и сами слова «квест»/«маршрут»/«статья». Без этого «Какие
 * квесты есть в Минске?» подтягивал квест по Бресту — он тоже «квест».
 */
const QUERY_STOPWORDS = new Set([
  'какие', 'какой', 'какая', 'какое', 'каких', 'что', 'где', 'куда', 'когда', 'как', 'есть', 'ли',
  'можно', 'нужно', 'хочу', 'хотим', 'поехать', 'съездить', 'сходить', 'пройти',
  // Местоимения и слова о сроке поездки: бэкенд ищет подстрокой, «меня мне» находит 105 статей
  // и выносит в топ Рысы и Бытом на вопрос про Краков (#2709). «посмотреть» не здесь: оно
  // выделяет путеводители «что посмотреть» при ранжировании (см. RERANK_ONLY_WORDS).
  'меня', 'мне', 'мной', 'нам', 'нас', 'нами', 'вам', 'вас', 'вами', 'тебе', 'тебя', 'себе', 'себя',
  'мой', 'моя', 'мое', 'мои', 'наш', 'наша', 'наше', 'наши', 'ваш', 'ваша', 'ваше', 'ваши',
  'день', 'дня', 'дней', 'дни', 'два', 'две', 'три', 'пару', 'очень', 'буду', 'будем', 'был', 'была', 'были',
  'подскажи', 'подскажите', 'посоветуй', 'посоветуйте', 'лучше', 'сейчас', 'нибудь', 'чтобы', 'если',
  'для', 'или', 'под', 'при', 'про', 'это', 'этот', 'эта', 'там', 'тут', 'ещё', 'еще',
  // Маркеры уточнения (#2719): в склеенном запросе бэкенд требует все слова, «несвиж них» → 5 из 13.
  'них', 'него', 'неё', 'нее', 'этих', 'этого', 'этой', 'этим', 'туда', 'оттуда', 'какую', 'каком',
  // Сколько вариантов просят: «не больше двух вариантов» поднимало «…на двух реках» и «…между двух озёр»
  // в ответ про Дрезден (приёмка 11.11.2026, h13).
  'двух', 'трех', 'четырех', 'пяти', 'больше', 'меньше', 'вариант', 'варианта', 'вариантов', 'варианты',
  'квест', 'квесты', 'квеста', 'квестов', 'квесту', 'квестом', 'квестах',
  'маршрут', 'маршруты', 'маршрута', 'маршрутов', 'маршруту',
  'статья', 'статьи', 'статью', 'статей', 'материал', 'материалы', 'сайт', 'сайте', 'metravel',
  // Просьба о форме ответа («дай ссылку», «каждый со ссылкой») карточку не выбирает.
  'ссылка', 'ссылку', 'ссылки', 'ссылкой', 'ссылок', 'ссылками',
  'дай', 'дайте', 'назови', 'назовите', 'каждый', 'каждая', 'каждое', 'каждого', 'каждому',
  // Возраст ребёнка («девяти лет», «nine-year-old»): «old» поднимало все квесты «…Old Town» над квестами города.
  'лет', 'года', 'годик', 'годика',
  ...OTHER_LOCALE_STOPWORDS,
])

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Явное намерение вопроса: «квесты в Минске» хочет квесты, «статья/маршрут по
 * Гродно» — статьи. Слово-тип само по себе стоп-слово (оно есть в каждой карточке
 * типа), поэтому вместо совпадения по тексту оно даёт бонус всему типу: иначе
 * вопрос про квесты заполняли статьи с базовым баллом поиска.
 */
const INTENT_BONUS = 2

// Опора уточнений (#2719) и намерение вопроса живут в общем с сервером модуле `retrievalQuery.ts` (#2884, #3276).
export { buildRetrievalQuery, detectIntent, isFollowUpQuestion, type AiSourceIntent } from './retrievalQuery'

/** Слова вопроса длиной от трёх знаков, без повторов; порядок сохраняется. */
export const tokenizeQuery = (query: string): string[] => {
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const token of normalizeText(query).split(' ')) {
    if (token.length < MIN_TOKEN_LENGTH || seen.has(token) || QUERY_STOPWORDS.has(token)) continue
    seen.add(token)
    tokens.push(token)
  }
  return tokens
}

/**
 * Грубый стем для славянских окончаний: у слова длиннее пяти знаков отрезаем
 * два последних («Гродно» ≈ «Гродне», «квесты» ≈ «квест»). Этого хватает для
 * подбора по названию и городу; полноценный поиск — задача индекса (#2454).
 */
const stemToken = (token: string): string => (token.length > 5 ? token.slice(0, -2) : token)

/**
 * Сколько слов вопроса встречается в тексте карточки. Стем сверяется с НАЧАЛОМ
 * слова карточки, а не с подстрокой: «детьми» → «деть» иначе ловил «увидеть»
 * (квест по Хайфе в ответе про Гродно).
 */
export const scoreText = (haystack: string, tokens: readonly string[]): number => {
  if (!tokens.length) return 0
  const words = normalizeText(haystack).split(' ').filter(Boolean)
  if (!words.length) return 0
  let score = 0
  for (const token of tokens) {
    const stem = stemToken(token)
    const short = shortCaseStem(token)
    if (words.some((word) => word.startsWith(stem) || (short !== null && word.length <= token.length && word.startsWith(short)))) score += 1
  }
  return score
}

/** Гласные падежных окончаний — кириллица и латиница («в Лиду», «do Rygi», «w Pragę»). */
const CASE_VOWEL_RE = /[аяеиыуюоіaeiouyąę]$/
const SHORT_TOKEN_MIN = 4
const SHORT_TOKEN_MAX = 5

/**
 * Основа короткого слова (#3277): `stemToken` слова до пяти букв не режет, и «в Лиду», «в Ригу», «в
 * Прагу» не находили «Лида», «Рига», «Прага» — название в другом падеже той же длины. У слова из
 * четырёх-пяти букв с гласной на конце основа — без неё; совпадает слово карточки не длиннее самого
 * слова вопроса («лиду» — «лида», «лиде», но не «лидер» и не «лидский»).
 */
const shortCaseStem = (token: string): string | null =>
  token.length >= SHORT_TOKEN_MIN && token.length <= SHORT_TOKEN_MAX && CASE_VOWEL_RE.test(token) ? token.slice(0, -1) : null

/** Падежные окончания, длинные раньше коротких: срезается одно, основа — не короче четырёх букв. */
const CASE_ENDINGS = [
  'ыми', 'ими', 'ого', 'его', 'ому', 'ему', 'ами', 'ями',
  'ые', 'ие', 'ая', 'яя', 'ую', 'юю', 'ой', 'ей', 'ий', 'ый', 'ом', 'ем', 'ам', 'ям', 'ах', 'ях', 'ов', 'ев', 'ых', 'их',
  'а', 'я', 'е', 'и', 'ы', 'у', 'ю', 'о',
]
const MIN_SEARCH_STEM_LENGTH = 4

/**
 * Основа слова для подстрочного поиска бэкенда: «кракове» → «краков» находит «Краков:
 * путеводитель», которого «кракове» не находит (#2709). Мягче `stemToken`: тот режет
 * две буквы, и «польше» → «поль» ловил бы «пользу». Латиница не трогается.
 */
export const searchStem = (token: string): string => {
  if (!/^[а-я]+$/.test(token)) return token
  // Винительный падеж короткого названия (#3277): «лиду», «ригу» — основа из трёх букв для подстрочного
  // поиска слишком коротка («лид» — и «лидер»), поэтому слово возвращается в именительный: «лида», «рига».
  if (token.length === MIN_SEARCH_STEM_LENGTH && /[ую]$/.test(token)) return `${token.slice(0, -1)}${token.endsWith('у') ? 'а' : 'я'}`
  for (const ending of CASE_ENDINGS) {
    if (token.endsWith(ending) && token.length - ending.length >= MIN_SEARCH_STEM_LENGTH) {
      return token.slice(0, -ending.length)
    }
  }
  return token
}

/**
 * Слова, которые поднимают карточку при ранжировании, но не уходят в запрос бэкенду:
 * бэкенд требует от статьи все слова запроса, и «несвиж посмотр» терял «Несвижский
 * замок Радзивиллов» (13 статей → 4, проба 25.10.2026).
 */
const RERANK_ONLY_WORDS = new Set(['посмотреть'])

/**
 * Строка поиска для бэкенда: основы значимых слов вопроса без `RERANK_ONLY_WORDS`. Полная фраза «Куда поехать
 * на выходные под Гродно с детьми?» у `/api/travels/?query=` даёт ноль, слова
 * «выходные Гродно детьми» — статьи по Гродно (проба 18.10.2026); падеж «в Кракове»
 * — основой «краков» (#2709).
 */
export const buildTravelsSearchQuery = (query: string, tokens: readonly string[]): string => {
  const searchable = tokens.filter((token) => !RERANK_ONLY_WORDS.has(token))
  const words = searchable.length ? searchable : tokens
  return words.length ? [...new Set(words.map(searchStem))].join(' ') : query.trim()
}

/**
 * Квесты, прошедшие только на бонусе намерения (без совпадений по словам),
 * нужны лишь когда совпадений нет вовсе («Какие квесты есть на сайте?»); иначе
 * они занимали бы свободные слоты из восьми квестами других городов.
 */
const RESCUED_QUESTS_WITH_TOKENS_LIMIT = 3

export const dropRescuedQuestsWhenMatched = (
  quests: readonly AiSource[],
  intent: AiSourceIntent,
  hasTokens = false,
): AiSource[] => {
  if (intent !== 'quest') return [...quests]
  const hasMatched = quests.some((source) => source.score > INTENT_BONUS)
  if (hasMatched) return quests.filter((source) => source.score > INTENT_BONUS)
  // «Какие квесты есть в Исландии?»: слова есть, совпадений нет — пара квестов
  // как «ближайшее из того, что есть», а не весь каталог поверх статей.
  return hasTokens ? quests.slice(0, RESCUED_QUESTS_WITH_TOKENS_LIMIT) : [...quests]
}

/** HTML описания → один абзац данных для промпта. Без i18n-фолбэка и DOMPurify. */
export const htmlToSnippet = (html: unknown, maxLength = SNIPPET_MAX_LENGTH): string => {
  const text = String(html ?? '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut}…`
}

const joinParts = (parts: Array<string | null | undefined>): string =>
  parts.map((part) => String(part ?? '').trim()).filter(Boolean).join('. ')

export const travelToSource = (travel: Travel, tokens: readonly string[], intent: AiSourceIntent = null): AiSource | null => {
  const path = buildTravelPathFromTravel(travel)
  const title = String(travel?.name ?? '').trim()
  if (!path || !title) return null
  const place = [travel.countryName, travel.cityName].map((v) => String(v ?? '').trim()).filter(Boolean).join(', ')
  const body = htmlToSnippet(travel.description)
  // Строка фактов (#3287) — тем же построителем, что у службы и слепка обучения: страна, число дней, месяцы.
  // `cityName` статьи — подпись первой точки маршрута, в строку фактов она не идёт (#3347).
  // Список статей отдаёт `month` номерами (`[6, 7, 8]`), в типе `Travel` его нет.
  const facts = travelFactsOf(Number(travel.id), { number_days: travel.number_days, month: (travel as { month?: unknown }).month })
  const snippet = joinParts([travelFactsLine(facts, { country: travel.countryName }), body])
  // Бэкенд уже отобрал статью по вопросу — базовый балл 1, совпадения слов сверху. Балл считается по
  // месту и описанию: слова фактов («дней», название месяца) статью под вопрос не выбирают.
  const score = 1 + scoreText(`${title} ${place} ${joinParts([place, body])}`, tokens) + (intent === 'travel' ? INTENT_BONUS : 0)
  return {
    type: 'travel',
    source_id: String(travel.id),
    title,
    url: buildCanonicalUrl(path),
    path,
    snippet,
    score,
    // Город статьи в каталоге — точка маршрута, а не город; месту карточки служит только страна (#3315).
    place: { countries: [travel.countryName] },
    // Запись фактов — для проверки условий вопроса (#3289, `arrangeSources`).
    facts,
  }
}

export const questToSource = (quest: ApiQuestMeta, tokens: readonly string[], intent: AiSourceIntent = null): AiSource | null => {
  const path = buildQuestPath(quest.city_alias || quest.city_id, quest.quest_id)
  const title = String(quest?.title ?? '').trim()
  if (!path || !title) return null
  const city = String(quest.city_name_localized || quest.city_name || '').trim()
  const country = String(quest.country_name ?? '').trim()
  const score = scoreText(
    [title, city, quest.city_name, quest.city_name_canonical, country].filter(Boolean).join(' '),
    tokens,
  )
  // Бонус намерения — до отсечки: «Какие квесты есть на сайте?» без топонима
  // иначе не находил ни одного квеста и честно, но ложно отвечал «материалов нет».
  const boosted = score + (intent === 'quest' ? INTENT_BONUS : 0)
  if (boosted <= 0) return null
  // Строка фактов (#3276, #3287): вид квеста, возраст и «Со взрослым» по тегам каталога, число точек,
  // длительность, сложность, «Можно с собакой». Тот же построитель у службы `/ai/ask` и слепка обучения.
  const facts = questFactsOf(Number(quest.id), {
    points: quest.points,
    duration_min: quest.duration_min,
    difficulty: quest.difficulty,
    pet_friendly: quest.pet_friendly,
    tags: enabledQuestTags(quest.tags),
  })
  const snippet = questFactsLine(facts, { city, country })
  return {
    type: 'quest',
    source_id: quest.quest_id,
    title,
    url: buildCanonicalUrl(path),
    path,
    snippet,
    score: boosted,
    place: { cities: [quest.city_name_localized, quest.city_name, quest.city_name_canonical], countries: [country] },
    facts,
  }
}

/**
 * Мест для квестов с совпадением по словам, когда намерения нет: у статьи базовый
 * балл за отбор бэкендом, и квест «по Кракову» (1) проигрывал каждой статье с
 * «Кракове» (2+) — восемь мест уходили статьям, квесты города пропадали (#2709).
 */
export const QUEST_RESERVED_SLOTS = 3

/**
 * Балл детского (место 2) и семейного (место 1) квеста города при вопросе о детях (#3276) — выше любого
 * совпадения по словам: у статьи балл не больше `1 + слова вопроса`, у квеста — `слова + INTENT_BONUS`.
 * В подсказку модели уходят первые карточки подбора (`AI_PROMPT_SOURCES_LIMIT`), и при равном балле
 * детский квест Минска оставался за восемью другими квестами города.
 */
const childrenLift = (tokens: readonly string[], rank: number): number => tokens.length + INTENT_BONUS + rank

/**
 * Слияние: по убыванию балла, при равенстве статьи раньше квестов; без дублей URL.
 * `reserved` — сколько мест держать за типом среди карточек, прошедших `isReservable`;
 * остальные места — по баллу. Порядок результата — по баллу.
 */
export const mergeSources = (
  sources: readonly AiSource[],
  limit = AI_SOURCES_LIMIT,
  reserved: Partial<Record<AiSource['type'], number>> = {},
  isReservable: (source: AiSource) => boolean = () => true,
): AiSource[] => {
  const ranked = [...sources].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.type !== b.type) return a.type === 'travel' ? -1 : 1
    return 0
  })
  const seen = new Set<string>()
  const unique = ranked.filter((source) => {
    if (seen.has(source.url)) return false
    seen.add(source.url)
    return true
  })
  const picked = new Set<AiSource>()
  for (const [type, slots] of Object.entries(reserved)) {
    const own = unique.filter((s) => s.type === type && isReservable(s))
    for (const source of own.slice(0, Math.min(slots ?? 0, limit))) picked.add(source)
  }
  for (const source of unique) {
    if (picked.size >= limit) break
    picked.add(source)
  }
  return unique.filter((source) => picked.has(source)).slice(0, limit)
}

/**
 * Компактный каталог квестов — из того же кэша React Query, что у
 * `useQuestsCompactCatalog` (`hooks/useQuestCityCollection.ts`): посетитель,
 * уже открывавший `/quests`, не тянет каталог заново, и свежесть у экранов и
 * ассистента одна. Без смонтированного клиента (тесты, ранний boot) — прямой
 * запрос. Сигнал одного вопроса каталог не отменяет: его переиспользуют
 * следующие вопросы.
 */
const loadQuestCatalog = (locale: string): Promise<ApiQuestMeta[]> => {
  const client = getActiveQueryClient()
  if (!client) return fetchQuestsCompactCatalog({ locale })
  const userId = useAuthStore.getState().userId
  const identity = userId == null ? null : String(userId)
  return client.fetchQuery<ApiQuestMeta[]>({
    queryKey: queryKeys.questsCompactCatalog(identity, locale),
    queryFn: ({ signal }) => fetchQuestsCompactCatalog({ signal, locale }),
    staleTime: QUESTS_LIST_STALE_TIME,
    gcTime: QUESTS_LIST_GC_TIME,
  })
}

/**
 * Карточка страницы, с которой открыт ассистент (#2897): статья — из того же кэша
 * React Query, что у экрана статьи (`queryKeys.travel(id)`, посетитель пришёл
 * оттуда и повторного запроса обычно нет), квест — из компактного каталога по
 * числовому `id` (бандл ради заголовка и длительности не нужен). Нет материала
 * (404, снят с публикации) — `null`: диалог идёт без закреплённой карточки.
 */
export async function loadSourceCard(ref: AiSourceRef, locale: string, signal?: AbortSignal): Promise<AiSource | null> {
  try {
    if (ref.type === 'travel') {
      const client = getActiveQueryClient()
      const travel = client
        ? await client.fetchQuery<Travel>({ queryKey: queryKeys.travel(ref.id), queryFn: ({ signal: querySignal }) => fetchTravel(ref.id, { signal: querySignal }) })
        : await fetchTravel(ref.id, signal ? { signal } : undefined)
      return travel ? travelToSource(travel, []) : null
    }
    const quest = (await loadQuestCatalog(locale)).find((item) => Number(item.id) === ref.id)
    // Балл закреплённой карточке не нужен: бонус намерения лишь проводит её через отсечку.
    return quest ? questToSource(quest, [], 'quest') : null
  } catch {
    return null
  }
}

export type SearchSiteMaterialsOptions = {
  query: string
  locale: string
  signal?: AbortSignal
  limit?: number
}

/**
 * Карточки под вопрос. Ошибка одного источника не роняет подбор: статьи и квесты
 * запрашиваются независимо, пустой результат — честный «материалов нет».
 */
export async function searchSiteMaterials({
  query,
  locale,
  signal,
  limit = AI_SOURCES_LIMIT,
}: SearchSiteMaterialsOptions): Promise<AiSource[]> {
  const tokens = tokenizeQuery(query)
  const intent = detectIntent(query)
  // Вопрос из одних стоп-слов про квесты («Какие квесты есть на сайте?») статьи
  // не ищет: полная фраза у бэкенда даёт ноль, а свежие статьи тут не нужны.
  const skipTravels = intent === 'quest' && tokens.length === 0
  // «Статья про Несвиж с детьми» просит статью: квесты наверх не поднимаются.
  const forChildren = intent !== 'travel' && asksAboutChildren(query)
  const [travelsResult, questsResult] = await Promise.allSettled([
    skipTravels
      ? Promise.resolve({ data: [] as Travel[], total: 0 })
      : fetchTravels(TRAVELS_FIRST_PAGE, TRAVELS_PAGE_SIZE, buildTravelsSearchQuery(query, tokens), {}, signal ? { signal } : undefined),
    loadQuestCatalog(locale),
  ])

  const candidates: AiSource[] = []
  const localQuestUrls = new Set<string>()
  if (travelsResult.status === 'fulfilled') {
    for (const travel of travelsResult.value?.data ?? []) {
      const source = travelToSource(travel, tokens, intent)
      if (source) candidates.push(source)
    }
  }
  if (questsResult.status === 'fulfilled') {
    const questSources: AiSource[] = []
    const catalog = questsResult.value ?? []
    // Маршрут «из Минска в Заславль» (#3277): слово города отправления квест не выбирает — иначе восемь
    // квестов Минска занимали все места и квест Заславля в подбор не попадал.
    const isOrigin = routeOriginMatcher(
      query,
      catalog.map((quest) => ({ place: { cities: [quest.city_name_localized, quest.city_name, quest.city_name_canonical], countries: [quest.country_name] } })),
    )
    const questTokens = tokens.filter((token) => !isOrigin(token))
    for (const quest of catalog) {
      const source = questToSource(quest, questTokens, intent)
      if (!source) continue
      if (forChildren) {
        const rank = childrenRank(query, enabledQuestTags(quest.tags), [quest.city_name_localized, quest.city_name, quest.city_name_canonical])
        if (rank) source.score += childrenLift(questTokens, rank)
      }
      questSources.push(source)
      // Место в резерве — только квесту про город или объект вопроса: совпадение по одной
      // стране («Замки Беларуси») отдавало бы три места квестам случайных городов.
      const local = [quest.title, quest.city_name_localized, quest.city_name, quest.city_name_canonical].filter(Boolean).join(' ')
      if (scoreText(local, questTokens) > 0) localQuestUrls.add(source.url)
    }
    candidates.push(...dropRescuedQuestsWhenMatched(questSources, intent, questTokens.length > 0))
  }
  return mergeSources(
    candidates,
    limit,
    intent === null ? { quest: QUEST_RESERVED_SLOTS } : {},
    (source) => source.type !== 'quest' || localQuestUrls.has(source.url),
  )
}
