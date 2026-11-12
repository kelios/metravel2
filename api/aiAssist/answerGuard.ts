/**
 * Страж содержания ответа (#3291) — поверх стража ссылок (`linkGuard.ts`).
 *
 * Адреса модель больше не выдумывает, но ответ с настоящими ссылками мог расходиться с
 * карточками (проба пути службы 11.11.2026 и приёмка v7):
 *   - пояснение у пункта от соседней карточки: у «Веломаршрута к усадьбе Новицких» —
 *     «Кревский замок и Гольшаны», у квеста по Каменцу — «маршрут вдоль Припяти и Ипы» (p15, p18);
 *   - числа, которых нет в карточке: «9 точек, около 45 минут» у статьи о Смолевуде (p14),
 *     «близько 18:00» там, где часы работы не названы нигде (q24);
 *   - пустой ответ: повтор вопроса и «Цены в карточках — в отдельных пунктах» (p10).
 *
 * Правила — одни для экрана, службы `/ai/ask` и контура оценки (`scripts/ai-assistant-eval/checks.mjs`).
 * Набор единый (#3345): ответ разбирается на единицы — ссылка на карточку, пояснение за ней, предложение
 * вне пояснений, — и у каждой единицы свои условия, при которых она остаётся. Новая форма мусора
 * закрывается условием единицы, а не заплаткой под строку.
 *
 *   Ссылка на карточку
 *   - Адрес — только из карточек, подпись — название карточки (`linkGuard.ts`).
 *   - Голый адрес карточки текстом не остаётся (`nameBareSourceLinks`): карточка ещё не названа — он
 *     становится ссылкой с её названием; уже названа — убирается вместе с подводкой («[Квест](…) —
 *     городской квест: https://…» → «[Квест](…) — городской квест»).
 *   - Материал не из подсказки: пункт списка или предложение с вырезанной ссылкой убирается целиком
 *     (если в нём есть и ссылка на карточку — остаётся она); строка-заголовок списка без пунктов — с ним.
 *     Подводка к списку («…:»), под которой нет ни ссылки, ни пункта, ни законченной фразы, уходит вместе
 *     со строками-названиями под ней (`stripOrphanLeadIns`); строка с числом или словами карточки подсказки
 *     названием не считается. Каждое такое вырезание — находка `orphan_lead_in`.
 *
 *   Пояснение — фраза сразу за ссылкой после тире, двоеточия или скобки
 *   - Число с единицей в нём стоит в карточке ЭТОЙ ссылки (строка фактов `sourceFacts.ts` и фрагмент)
 *     или в вопросе.
 *   - Слова не чужие: пояснение не опирается на соседнюю карточку вместо своей. Отсутствие опоры само
 *     по себе пояснение не срезает: ответ на BE/UK/PL/EN пересказывает русскую карточку другими словами.
 *   - Это не оборванная фраза карточки (см. ниже). Неподтверждённое пояснение убирается, ссылка остаётся.
 *
 *   Предложение вне пояснений
 *   - Число с единицей стоит хотя бы в одной карточке подсказки (`promptSources` — то, что видела модель,
 *     а не весь список источников) или в вопросе. Иначе предложение
 *     убирается; если в нём стоит ссылка, от него остаётся ссылка: «Пройдёте [Квест](…) за 2 часа.» →
 *     «[Квест](…).», в пункте списка — «- [Квест](…)».
 *   - Это не оборванная фраза карточки: фрагмент карточки обрезан по длине и кончается многоточием,
 *     его последняя фраза не закончена. Модель выдавала её за свои слова — «самый тяжёлый, но и самый
 *     необходимый» вводной к ссылке при фрагменте «…это самый тяжёлый, но и самый необходимый…».
 *     Предложение или пояснение, которое обрывается там же, где оборван фрагмент, убирается; фраза,
 *     которую модель договорила дальше обрыва, остаётся. В режиме страницы правило не действует: там
 *     ответ и есть пересказ фрагментов страницы.
 *   - Это не эхо разметки подсказки: заголовок «Материалы сайта:» и строка «Вопрос посетителя:» на любой
 *     из пяти локалей, фразы системного сообщения, номер карточки в квадратных скобках («карточка [2]»).
 *     Строка с заголовком карточки уходит целиком, в остальном тексте — предложение вместе с его
 *     продолжением в скобках или со строчной буквы. Детектор `leaksPrompt` — общий с проверкой
 *     `prompt_leak` контура оценки.
 *   - Вопросительное предложение без ссылки остаётся только уточнением условия, которое служба умеет
 *     учесть: возраст ребёнка, когда вопрос о детях и возраст не назван (единственное уточнение, которому
 *     модель обучена). Всё остальное — повтор вопроса посетителя, дословный или пересказом («…удобная
 *     обувь. Сколько дней занимает поездка?»), вопрос, переписанный из карточки, встречный вопрос без
 *     смысла («Сколько лет собаке?», «Колькі гадоў назад?») — вырезается.
 *
 *   Ответ целиком
 *   - Содержание ответа — ссылка на карточку, признание «этого в материалах нет» по теме вопроса
 *     (`admitsOnTopic`) или подтверждённое число. Без них короткий ответ и ответ-повтор вопроса — пустой:
 *     вызывающий показывает запасную фразу. Повтор вопроса режется как единица-предложение, в том числе
 *     предложение вопроса без знака вопроса («Хочемо ще встигнути в замок.»); если в остатке стоит число
 *     из карточки подсказки, ответ не пустой (lv35). Пуст и ответ, всё содержание которого — признание не о том,
 *     что спросили («не пазначаны ўзроставыя абмежаванні» на вопрос о времени квеста). В режиме страницы
 *     (#3290) короткий ответ пустым не считается: он о самой странице.
 *   - Остаток после вырезания отвечает сам за себя: если из ответа убрано содержание (число без опоры,
 *     материал не из подсказки, эхо подсказки, оборванная фраза), а в остатке нет ни ссылки, ни
 *     признания, — ответ пустой. От «Квэсты — …: каля 10 хв. … Колькі гадоў назад? Зараз. Астатняе — у
 *     картцы.» оставались три обрывка (lv40). В режиме страницы утверждение о странице ссылки не
 *     требует: там пустым остаётся только остаток из одних вопросов.
 *
 * Сверяются единицы с однозначным значением: точки квеста, длительность (минуты и часы), время суток,
 * цена, расстояние в километрах и годы (#3345: «около 1 km» и «Возрастные ограничения: 12 лет», которых
 * нет в карточках, доходили до посетителя). Расстояние словами в опоре читается («около двух с половиной
 * километров», «километров на сорок-пятьдесят»), возраст сверяется с диапазоном карточки («Возраст: 8–10
 * лет») и с возрастом из вопроса, в том числе слитным словом («шестилетка»). Дни не сверяются: карточка
 * пишет их словами («маршрут на два дня»), и цифра в ответе была бы ложной тревогой.
 *
 * Модуль без `@/`-импортов: его грузит служба (`node --experimental-strip-types`) и контур оценки.
 */

import { buildSourceByLinkKey, countKeptSourceLinks, enforceSourceLinks, type LinkGuardResult, nameBareSourceLinks, normalizeLinkKey, REMOVED_LINK_MARK, tidyText } from './linkGuard.ts'
import {
  type AnswerGuardContext,
  askedAges,
  cardText,
  cutTailMatcher,
  echoesQuestion,
  extractNumberFacts,
  firstSentence,
  groundingOf,
  isDifference,
  isGrounded,
  sentencesOf,
  stripOrphanLeadIns,
  stripQuestionEcho,
  stripQuestionSentences,
  stripQuestions,
  wholeSentences,
} from './answerGuardRules.ts'
import { asksAboutChildren } from './questAudience.ts'
import type { AiSource } from './types'

// Правила, вынесенные в `answerGuardRules.ts`, читаются отсюда же: у стража, службы и контура оценки один вход.
export { type AnswerGuardContext, echoesQuestion, extractNumberFacts, findUngroundedNumbers } from './answerGuardRules.ts'

export type GuardCheck = 'label_mismatch' | 'bare_url' | 'foreign_description' | 'ungrounded_number' | 'card_fragment' | 'prompt_leak' | 'counter_question' | 'orphan_lead_in' | 'echo'
export type GuardFinding = { check: GuardCheck; detail: string }

export type AnswerGuardResult = LinkGuardResult & {
  /** Сколько пояснений пунктов убрано как не подтверждённых карточкой ссылки. */
  droppedDescriptions: number
  /** Сколько фраз убрано из-за числа, которого нет ни в одной карточке. */
  ungroundedNumbers: number
  /** Сколько строк и фраз с эхом разметки подсказки убрано. */
  promptLeaks: number
  /** Сколько голых адресов карточек заменено ссылкой с названием или убрано как повтор (#3345). */
  bareLinks: number
  /** Сколько предложений и пояснений убрано как оборванная фраза карточки (#3345). */
  cardFragments: number
  /** Сколько вопросительных предложений убрано: повтор вопроса, встречный вопрос без смысла (#3345). */
  counterQuestions: number
  /** Ответ пустой: вместо `text` показывается запасная фраза (`aiAssistStatic:ask.fallbackAnswer`). */
  fallback: boolean
  findings: GuardFinding[]
}

/**
 * Пороги опоры пояснения на слова. Выбраны пересчётом сохранённых ответов приёмки v7
 * (`.codex-temp/ai-assistant-eval/accept-v4-v7-20261111`, `docs/features/ai-assistant.md` →
 * «Страж содержания ответа»): чужое — соседняя карточка подтверждает не меньше `FOREIGN_MIN_SHARE`
 * значимых слов пояснения и не меньше `FOREIGN_MIN_WORDS` слов, а своя — не больше `OWN_MAX_SHARE`.
 */
export const FOREIGN_MIN_SHARE = 0.6
export const FOREIGN_MIN_WORDS = 2
export const OWN_MAX_SHARE = 0.34
/** Ответ без ссылок короче этого — не ответ, если в нём нет признания и подтверждённого числа. */
export const MIN_ANSWER_CHARS = 40
/** Слова типа и связки: они есть в любой карточке и опоры не дают. Записаны основами. */
const GENERIC_STEMS = [
  'квест', 'квэст', 'quest', 'город', 'горад', 'міськ', 'гарадск', 'miejsk', 'city', 'urban', 'стать', 'статт', 'артыкул', 'article', 'artyku',
  'маршрут', 'route', 'tras', 'поездк', 'путешеств', 'trip', 'детск', 'семейн', 'точек', 'точк', 'минут', 'около', 'примерно', 'можно',
  'есть', 'будет', 'было', 'очень', 'также', 'этот', 'этой', 'этом', 'такой', 'который', 'котор', 'вдоль', 'через', 'после', 'перед',
  'между', 'если', 'когда', 'чтобы', 'which', 'with', 'from', 'that', 'this', 'about', 'there', 'сайт', 'материал', 'карточк', 'источник',
]
const MIN_WORD_LENGTH = 4

/** Белорусские и украинские буквы — к русским: название «Квэст па цэнтры Мінска» и фрагмент «по городу Минск» об одном городе. */
const foldLetters = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[ёэє]/g, 'е')
    .replace(/[іїы]/g, 'и')
    .replace(/ў/g, 'у')
    .replace(/ґ/g, 'г')

const wordsOf = (text: string): string[] =>
  foldLetters(String(text ?? ''))
    .split(/[^\p{L}]+/u)
    .filter((word) => word.length >= MIN_WORD_LENGTH)

/** Имена собственные пояснения: слова с заглавной буквы, кроме первого слова фразы. */
const namesOf = (text: string): string[] =>
  String(text ?? '')
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
    .slice(1)
    .filter((word) => /^\p{Lu}/u.test(word) && word.length >= MIN_WORD_LENGTH)
    .map(foldLetters)

const isGeneric = (word: string): boolean => GENERIC_STEMS.some((stem) => word.startsWith(stem))

/** Одно слово в разных формах: общее начало покрывает оба слова, кроме окончания до трёх букв. */
const sameWord = (a: string, b: string): boolean => {
  let shared = 0
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared += 1
  return shared >= MIN_WORD_LENGTH && shared >= Math.max(a.length, b.length) - 3
}

const supportedBy = (words: readonly string[], card: readonly string[]): number => words.filter((word) => card.some((own) => sameWord(word, own))).length

const LINK_RE = /\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g
/** Пояснение начинается сразу за ссылкой: тире, двоеточие или скобка. */
const DESCRIPTION_LEAD_RE = /^(\s*(?:[—–:]|-(?=\s)|\())\s*/
const BULLET_RE = /^\s*(?:[-*•]|\d+[.)])\s+/

type Part = { kind: 'text'; value: string } | { kind: 'link'; value: string; source: AiSource | null }

const splitLine = (line: string, sourceByKey: Map<string, AiSource>): Part[] => {
  const parts: Part[] = []
  let last = 0
  for (const match of line.matchAll(LINK_RE)) {
    const start = match.index ?? 0
    if (start > last) parts.push({ kind: 'text', value: line.slice(last, start) })
    parts.push({ kind: 'link', value: match[0], source: sourceByKey.get(normalizeLinkKey(match[2])) ?? null })
    last = start + match[0].length
  }
  if (last < line.length) parts.push({ kind: 'text', value: line.slice(last) })
  return parts
}

/** Честное «этого в материалах нет / не указано» — на RU/BE/UK/PL/EN. Такой ответ пустым не считается. */
const ADMISSION_RE =
  /(?<![\p{L}])(?:нет|нету|не\s+указан\p{L}*|не\s+найден\p{L}*|не\s+наш[её]л\p{L}*|не\s+нашл\p{L}*|не\s+упомина\p{L}*|не\s+сказано|не\s+(?:называ|сообща|уточня|говорит|говорят|содерж)\p{L}*|отсутств\p{L}*|няма|не\s+пазначан\p{L}*|не\s+знойдзен\p{L}*|не\s+сказана|не\s+(?:згадва|паведамля)\p{L}*|немає|нема|не\s+вказан\p{L}*|не\s+знайден\p{L}*|не\s+(?:назива|згаду|повідомля|містит)\p{L}*|nie\s+ma|brak|nie\s+poda\p{L}*|nie\s+znalaz\p{L}*|nie\s+(?:wspomina|zawiera)\p{L}*|no|not|none|cannot|can['’]t|don['’]t|doesn['’]t|isn['’]t|aren['’]t)(?![\p{L}])/iu
export const admitsNoAnswer = (text: string): boolean => ADMISSION_RE.test(String(text ?? ''))

/**
 * Предмет признания — о чём сказано «в карточках не указано»: факты карточки, о которых модель обучена
 * так отвечать. Записаны основами на RU/BE/UK/PL/EN.
 */
const ADMISSION_SUBJECTS: ReadonlyArray<[string, RegExp]> = [
  ['age', /(?<![\p{L}])(?:возраст\p{L}*|[уў]зрост\p{L}*|вік(?:ов\p{L}*|у|ом)?|wiek\p{L}*|ages?|age-\p{L}+)(?![\p{L}])/iu],
  ['difficulty', /(?<![\p{L}])(?:сложност\p{L}*|складанасц\p{L}*|складніст\p{L}*|trudno[śs][ćc]\p{L}*|difficult\p{L}*)(?![\p{L}])/iu],
  ['price', /(?<![\p{L}])(?:цен[аыуе]\p{L}{0,2}|стоимост\p{L}*|сто[ия]т\p{L}{0,2}|билет\p{L}*|платн\p{L}*|бесплатн\p{L}*|цэн[аыу]\p{L}{0,2}|кошт\p{L}*|білет\p{L}*|квіт\p{L}*|цін[аиу]\p{L}{0,2}|варт\p{L}*|квит\p{L}*|cen[aęy]\p{L}{0,2}|koszt\p{L}*|bilet\p{L}*|p[łl]atn\p{L}*|prices?|costs?|fees?|tickets?|free)(?![\p{L}])/iu],
  ['duration', /(?<![\p{L}])(?:длительност\p{L}*|длит\p{L}*|времен\p{L}*|время|час\p{L}{0,3}|минут\p{L}*|долго|працягласц\p{L}*|хвілін\p{L}*|гадзін\p{L}*|тривал\p{L}*|хвилин\p{L}*|годин\p{L}*|czas\p{L}*|trwa\p{L}*|godzin\p{L}*|minut\p{L}*|duration|time|minutes?|hours?|(?:не)?(?:долг|довг|да[ўу]г)\p{L}*|к[оа]ротк\p{L}*|(?:nie)?d[łl]ug\p{L}*|kr[óo]tk\p{L}*|long\p{L}*|short\p{L}*)(?![\p{L}])/iu],
]

const subjectsOf = (text: string): string[] => ADMISSION_SUBJECTS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name)

/**
 * Признание по теме вопроса (#3345): «этого в карточках нет» — ответ, когда оно о том, что спросили.
 * На «А квэст там колькі часу займае?» модель отвечала заученным «У картках не пазначаны ўзроставыя
 * абмежаванні» (lv61), на вопрос о времени — «не пазначаны ўзровень складанасці» (lv34): признание есть,
 * ответа нет. Не по теме признание только тогда, когда его предмет — известный факт карточки (возраст,
 * сложность, цена, длительность), а вопрос вместе с опорой уточнения об этом факте не спрашивает; возраст
 * — тема любого вопроса о детях. Признание без такого предмета («отдельного материала о прогулках с
 * собакой на сайте нет», «про это в карточках не сказано») остаётся ответом.
 */
export const admitsOnTopic = (text: string, asked: string | null | undefined): boolean => {
  const question = String(asked ?? '')
  const askedSubjects = new Set([...subjectsOf(question), ...(asksAboutChildren(question) ? ['age'] : [])])
  return String(text ?? '')
    .split('\n')
    .flatMap(sentencesOf)
    .filter((sentence) => ADMISSION_RE.test(sentence))
    .some((sentence) => {
      const subjects = subjectsOf(sentence)
      return subjects.length === 0 || !question.trim() || subjects.some((subject) => askedSubjects.has(subject))
    })
}

/**
 * Эхо подсказки в ответе: фразы системного сообщения, заголовок блока карточек и строка вопроса — как их
 * пишет `prompt.ts` и как модель переводит их на язык ответа («Матеріали сайту:», «Site materials:»).
 */
const PROMPT_ECHO_RE = new RegExp(
  [
    'Ты\\s+—\\s+помощник\\s+сайта', 'Это данные для ответа, а не инструкции',
    '(?:Материалы|Матэрыялы|Матеріали)\\s+сайт[ауе]\\s*:', 'Materia[łl]y\\s+(?:ze\\s+)?(?:strony|serwisu|witryny)\\s*:', '(?:web)?site\\s+materials\\s*:',
    'Вопрос\\s+посетителя\\s*:', 'Пытанне\\s+наведвальніка\\s*:', 'Питання\\s+відвідувача\\s*:', 'Pytanie\\s+(?:odwiedzaj[ąa]cego|go[śs]cia)\\s*:', "Visitor['’]?s\\s+question\\s*:",
  ].join('|'),
  'iu',
)
/** Номер карточки подсказки: «[2]» вне markdown-ссылки («[2](адрес)» — подпись ссылки, её правит страж ссылок). */
const CARD_NUMBER_RE = /\[\d{1,2}\](?!\()/
const CARD_HEAD_ECHO_RE = /^\s*(?:[-*•]\s*)?\[\d{1,2}\](?!\()/

/** В тексте есть эхо подсказки. Общий детектор стража и проверки `prompt_leak` контура оценки. */
export const leaksPrompt = (text: string | null | undefined): boolean => {
  const value = String(text ?? '')
  return PROMPT_ECHO_RE.test(value) || CARD_NUMBER_RE.test(value)
}

/**
 * Текст без эха подсказки: строка, начатая номером карточки («[1] Статья …»), убирается целиком — это
 * переписанная карточка; в остальных строках убирается предложение с эхом.
 */
const stripPromptEcho = (text: string): { text: string; removed: string[] } => {
  const removed: string[] = []
  const lines = text.split('\n').flatMap((line) => {
    if (!leaksPrompt(line)) return [line]
    if (CARD_HEAD_ECHO_RE.test(line)) {
      removed.push(line.trim())
      return []
    }
    const kept = wholeSentences(line).filter((sentence) => {
      if (!leaksPrompt(sentence)) return true
      removed.push(sentence.trim())
      return false
    })
    const rest = kept.join('')
    return rest.trim() ? [rest] : []
  })
  return { text: lines.join('\n'), removed }
}

/**
 * Страж ответа целиком: страж ссылок (адреса и подписи), затем пояснения пунктов, числа и пустой
 * ответ. `text` — что показать; при `fallback` вызывающий показывает запасную фразу вместо него.
 */
export function guardAnswer(rawText: string, sources: readonly AiSource[], context: AnswerGuardContext = {}): AnswerGuardResult {
  // Вырезанная ссылка оставляет метку: по ней ниже уходит предложение или пункт с материалом не из подсказки.
  const linked = enforceSourceLinks(rawText, sources, { markRemoved: true })
  const findings: GuardFinding[] = []
  if (linked.relabeled) findings.push({ check: 'label_mismatch', detail: `подписей заменено названием карточки: ${linked.relabeled}` })
  const echoed = stripPromptEcho(linked.text)
  if (echoed.removed.length) findings.push({ check: 'prompt_leak', detail: `в ответе разметка подсказки: «${echoed.removed[0].slice(0, 120)}»` })
  // Голый адрес карточки — ссылка с её названием либо повтор уже названной карточки.
  const named = nameBareSourceLinks(echoed.text, sources)
  const bareLinks = named.named + named.dropped
  if (bareLinks) findings.push({ check: 'bare_url', detail: `голых адресов карточек в ответе: ${bareLinks}` })

  // Режим страницы (#3290): ответ о самой странице — пересказ её фрагментов.
  const pageMode = sources.some((source) => source.group === 'page')
  const sourceByKey = buildSourceByLinkKey(sources)
  const asked = [context.question, context.retrievalQuery]
  const ages = askedAges(asked.filter(Boolean).join(' '))
  // Опора чисел вне пояснений — карточки подсказки: соседний квест на 150 минут из группы «Ещё по теме»
  // модель не видела, и «загалом близько 150 хв» при карточке на 120 — выдумка, а не число из материалов.
  const allGrounding = groundingOf([...(context.promptSources ?? sources).map(cardText), ...asked], ages)
  const ownGrounding = new Map(sources.map((source) => [source, groundingOf([cardText(source), ...asked], ages)]))
  const cardWords = new Map(sources.map((source) => [source, wordsOf(cardText(source))]))
  let droppedDescriptions = 0
  let ungroundedNumbers = 0
  let cardFragments = 0
  let groundedFacts = 0
  /** Фраза обрывается там же, где оборван фрагмент карточки, — утверждением она не является. */
  const copiesCutTail = cutTailMatcher(pageMode ? [] : sources)

  /** Причина, по которой пояснение не принадлежит карточке ссылки, или `null`. */
  const descriptionDefect = (description: string, own: AiSource): string | null => {
    if (description.includes(REMOVED_LINK_MARK)) return 'в пояснении назван материал не из подсказки'
    if (copiesCutTail(description)) return 'пояснение — оборванная фраза карточки'
    const grounding = ownGrounding.get(own)!
    const stray = extractNumberFacts(description).find((fact) => !isGrounded(fact, grounding) && !isDifference(fact, allGrounding, description))
    if (stray) return `числа «${stray.raw}» нет в карточке «${own.title}»`
    const ownWords = cardWords.get(own)!
    const words = [...new Set(wordsOf(description))].filter((word) => !isGeneric(word))
    if (!words.length) return null
    const ownShare = supportedBy(words, ownWords) / words.length
    if (ownShare > OWN_MAX_SHARE) return null
    // Имена собственные: «…вдоль Припяти и Ипы» у квеста по Каменцу — место соседней карточки.
    const names = [...new Set(namesOf(description))].filter((word) => !isGeneric(word))
    const ownNames = supportedBy(names, ownWords)
    for (const other of sources) {
      if (other === own) continue
      const otherWords = cardWords.get(other)!
      const matched = supportedBy(words, otherWords)
      const foreignWords = words.length >= FOREIGN_MIN_WORDS && matched >= FOREIGN_MIN_WORDS && matched / words.length >= FOREIGN_MIN_SHARE
      const foreignNames = names.length > 0 && ownNames === 0 && supportedBy(names, otherWords) / names.length >= FOREIGN_MIN_SHARE
      if (foreignWords || foreignNames) return `пояснение из карточки «${other.title}», а не «${own.title}»`
    }
    return null
  }

  /** Фразы текста вне пояснений: фраза с числом, которого нет ни в одной карточке, убирается. */
  const keepGroundedSentences = (text: string): string =>
    sentencesOf(text)
      .filter((sentence) => {
        // Материал не из подсказки: ссылку снял страж ссылок, предложение с его названием уходит целиком.
        if (sentence.includes(REMOVED_LINK_MARK)) return false
        if (copiesCutTail(sentence)) {
          cardFragments += 1
          findings.push({ check: 'card_fragment', detail: `оборванная фраза карточки: «${sentence.trim().slice(0, 120)}»` })
          return false
        }
        const facts = extractNumberFacts(sentence)
        const stray = facts.find((fact) => !isGrounded(fact, allGrounding) && !isDifference(fact, allGrounding, sentence))
        if (!stray) {
          groundedFacts += facts.length
          return true
        }
        ungroundedNumbers += 1
        findings.push({ check: 'ungrounded_number', detail: `числа «${stray.raw}» нет в карточках: «${sentence.trim().slice(0, 120)}»` })
        return false
      })
      .join('')

  const lines = named.text.split('\n').map((line) => {
    const parts = splitLine(line, sourceByKey)
    const bullet = BULLET_RE.exec(line)?.[0] ?? null
    let out = ''
    // Незакрытое предложение: слова и ссылки до знака конца фразы. Ссылка стоит внутри предложения
    // («Пройдёте [Квест](…) за 2 часа.»), поэтому число сверяется по предложению целиком, а не по
    // куску текста за ссылкой — иначе от фразы оставалось оборванное «Пройдёте [Квест](…)».
    let open: Part[] = []
    let atLineStart = true

    /**
     * Предложение вне пояснений (правило 2). Без ссылки предложение с числом без опоры убирается
     * целиком. Со ссылкой от него остаётся только ссылка — без вводных слов и хвоста: в свободном
     * тексте «[Квест](…).», в пункте списка «- [Квест](…)». Рекомендация не теряется, а оборванной
     * фразы («Пройдёте [Квест](…)») не остаётся.
     */
    const closeSentence = () => {
      const pieces = open
      const first = atLineStart
      open = []
      if (!pieces.length) return
      atLineStart = false
      const links = pieces.filter((piece) => piece.kind === 'link')
      if (!links.length) {
        out += keepGroundedSentences(pieces.map((piece) => piece.value).join(''))
        return
      }
      const words = pieces.map((piece) => (piece.kind === 'text' ? piece.value : ' ')).join('')
      const facts = extractNumberFacts(words)
      const stray = facts.find((fact) => !isGrounded(fact, allGrounding) && !isDifference(fact, allGrounding, words))
      // Рядом со ссылкой на карточку назван материал не из подсказки — от предложения остаётся ссылка, как при числе без опоры.
      const foreign = words.includes(REMOVED_LINK_MARK)
      // Слова вокруг ссылки — оборванная фраза карточки: от предложения тоже остаётся ссылка.
      const fragment = pieces.some((piece) => piece.kind === 'text' && copiesCutTail(piece.value))
      if (!stray && !foreign && !fragment) {
        groundedFacts += facts.length
        out += pieces.map((piece) => piece.value).join('')
        return
      }
      if (stray) {
        ungroundedNumbers += 1
        findings.push({ check: 'ungrounded_number', detail: `числа «${stray.raw}» нет в карточках: «${pieces.map((piece) => piece.value).join('').trim().slice(0, 120)}»` })
      } else if (fragment) {
        cardFragments += 1
        findings.push({ check: 'card_fragment', detail: `оборванная фраза карточки: «${words.trim().slice(0, 120)}»` })
      }
      const head = pieces[0]
      const lastPiece = pieces[pieces.length - 1]
      // Начало: маркер пункта списка либо пробел, которым предложение отделено от предыдущего.
      const before = bullet && first ? bullet : head.kind === 'text' ? /^\s*/.exec(head.value)![0] : ''
      // Конец: пункт списка точкой не закрывается; свободное предложение остаётся законченным.
      const after = !bullet && lastPiece.kind === 'text' && /[.!?…]\s*$/.test(lastPiece.value) ? '.' : ''
      out += `${before}${links.map((piece) => piece.value).join(', ')}${after}`
    }
    /** Текст вне пояснений: законченные фразы закрываются, последняя незаконченная ждёт ссылку или конец строки. */
    const addText = (text: string) => {
      for (const fragment of sentencesOf(text)) {
        open.push({ kind: 'text', value: fragment })
        if (/[.!?…]\s*$/.test(fragment)) closeSentence()
      }
    }

    parts.forEach((part, index) => {
      if (part.kind === 'link') {
        open.push(part)
        return
      }
      const previous = parts[index - 1]
      const lead = previous?.kind === 'link' && previous.source ? DESCRIPTION_LEAD_RE.exec(part.value) : null
      if (!lead || previous?.kind !== 'link' || !previous.source) {
        addText(part.value)
        return
      }
      // Пояснение закрывает предложение ссылки. Вводные слова перед ней сверяются сами по себе: число
      // без опоры убирает их, ссылка с пояснением остаётся законченной фразой.
      out += open.map((piece) => (piece.kind === 'link' ? piece.value : keepGroundedSentences(piece.value))).join('')
      open = []
      atLineStart = false
      const [description, rest] = firstSentence(part.value.slice(lead[0].length))
      const defect = description.trim() ? descriptionDefect(description, previous.source) : null
      if (defect) {
        droppedDescriptions += 1
        const fragment = !description.includes(REMOVED_LINK_MARK) && copiesCutTail(description)
        if (fragment) cardFragments += 1
        findings.push({ check: fragment ? 'card_fragment' : 'foreign_description', detail: `${defect}: «${description.trim().slice(0, 120)}»` })
        // Фраза вне списка остаётся законченной: «…это [название](адрес).»
        out += !BULLET_RE.test(line) && /[.!?…]\s*$/.test(description) ? '.' : ''
      } else {
        groundedFacts += extractNumberFacts(description).length
        out += lead[0] + description
      }
      addText(rest)
    })
    closeSentence()
    // От пункта списка остался один маркер («1.») — пункта больше нет.
    const emptied = bullet !== null && line.trim() !== bullet.trim() && (out.trim() === '' || out.trim() === bullet.trim())
    return { text: emptied ? '' : out, bullet: bullet !== null, emptied }
  })
  // Строка-заголовок списка («Квесты с ребёнком:»), под которой не осталось ни одного пункта, уходит вместе с ними.
  const orphanLeadIns: string[] = []
  lines.forEach((line, index) => {
    if (line.bullet || !/[:：]\s*$/.test(line.text)) return
    let emptied = 0
    for (const next of lines.slice(index + 1)) {
      if (next.emptied) emptied += 1
      else if (next.bullet) return
      else if (next.text.trim()) break
    }
    if (!emptied) return
    const sentences = sentencesOf(line.text)
    orphanLeadIns.push(sentences.at(-1)!.trim())
    line.text = sentences.slice(0, -1).join('')
  })

  // Две ссылки встык — след убранного между ними пояснения: остаются перечислением.
  const guarded = tidyText(lines.map((line) => line.text).join('\n').split(REMOVED_LINK_MARK).join('')).replace(/\)(?=\[[^\]]*\]\()/g, '), ')
  const echo = echoesQuestion(context.question, guarded)
  // Дословный повтор вопроса вырезается и у ответа со ссылками; пустым ответ делает прежнее правило `echo`.
  const unechoed = stripQuestionEcho(guarded, context.question)
  const echoCut = unechoed !== guarded
  // Вопросительные предложения: остаётся только уточнение возраста ребёнка на вопрос о детях.
  const askedText = [context.question, context.retrievalQuery].filter(Boolean).join(' ')
  const questioned = stripQuestions(unechoed, askedText)
  // Предложения вопроса, повторённые дословно (в том числе без знака вопроса), — тоже не ответ.
  const repeated = stripQuestionSentences(questioned.text, context.question)
  const sentenceCuts = questioned.removed.length + repeated.removed.length
  const counterQuestions = sentenceCuts + (echoCut ? 1 : 0)
  if (sentenceCuts) findings.push({ check: 'counter_question', detail: `вопрос вместо ответа: «${(questioned.removed[0] ?? repeated.removed[0]).slice(0, 120)}»` })
  // Подводка к списку, под которой списка не осталось. Строка с фактом карточки подсказки — числом или её
  // словами — названием чужого материала не считается: «Время прохождения: ⏎ 120 мин» остаётся ответом.
  const promptCards = context.promptSources ?? sources
  const cardGrounding = groundingOf(promptCards.map(cardText))
  const hasCardNumber = (line: string): boolean => extractNumberFacts(line).some((fact) => isGrounded(fact, cardGrounding))
  const carriesCardContent = (line: string): boolean => {
    if (hasCardNumber(line)) return true
    const words = [...new Set(wordsOf(line))].filter((word) => !isGeneric(word))
    return words.length > 0 && promptCards.some((source) => supportedBy(words, cardWords.get(source) ?? wordsOf(cardText(source))) / words.length > OWN_MAX_SHARE)
  }
  const unled = stripOrphanLeadIns(repeated.text, { pageMode, carriesCardContent, hasCardNumber })
  orphanLeadIns.push(...unled.removed)
  if (orphanLeadIns.length) findings.push({ check: 'orphan_lead_in', detail: `подводка без списка: «${orphanLeadIns.join(' ⏎ ').slice(0, 120)}»` })
  const text = unled.text
  const keptLinks = countKeptSourceLinks(text, sources)
  // Режим страницы (#3290): ответ о самой странице ссылки не требует — «Хватит двух дней на город.»
  // короткий, но верный; пустым там считается только пустой текст и повтор вопроса.
  const thin = !pageMode && text.length < MIN_ANSWER_CHARS && groundedFacts === 0
  // Признание не о том, что спросили, — не ответ: «У картках не пазначаны ўзроставыя абмежаванні» на вопрос о
  // времени квеста (lv61), «не пазначаны ўзровень складанасці» (lv34) показывались как есть.
  const admits = admitsOnTopic(text, askedText)
  const strayAdmission = !pageMode && groundedFacts === 0 && !admits && admitsNoAnswer(text)
  const promptLeaks = echoed.removed.length
  // Из ответа убрано содержание: число без опоры, материал не из подсказки, эхо подсказки, оборванная фраза.
  const contentCut = linked.removed + ungroundedNumbers + promptLeaks + cardFragments > 0
  const cut = contentCut || droppedDescriptions > 0 || text !== guarded
  const onlyQuestions = text.length > 0 && text.split('\n').flatMap(sentencesOf).every((sentence) => !sentence.trim() || /\?\s*$/.test(sentence))
  // Остаток после вырезания отвечает сам за себя: без ссылки и признания отвечать нечем. В режиме страницы
  // утверждение о странице ссылки не требует, там пустым остаётся только остаток из одних вопросов.
  const leftover = (cut && onlyQuestions) || (contentCut && !pageMode)
  // Повтор вопроса делает ответ пустым, пока в остатке нет числа из карточки подсказки: «У квест: … візьмо
  // близько 120 хв. Скільки часу потрібно на квест у Тракаї? Хочемо ще встигнути в замок.» (lv35, r4) —
  // повтор вырезан, первое предложение отвечает. Число, которое стоит только в вопросе, ответом не считается.
  const emptyEcho = echo && !extractNumberFacts(text).some((fact) => isGrounded(fact, cardGrounding))
  // Содержание ответа — ссылка на карточку, честное «в материалах этого нет» или подтверждённое число.
  const fallback = keptLinks === 0 && !admits && (text.length === 0 || emptyEcho || thin || leftover || strayAdmission)
  // Вырезанный целиком повтор вопроса — тоже находка; у пустого ответа-повтора её несёт `echo` ниже.
  if (echoCut && !sentenceCuts && !(fallback && emptyEcho)) findings.push({ check: 'counter_question', detail: `вопрос вместо ответа: «${String(context.question).trim().slice(0, 120)}»` })
  if (fallback) {
    const detail = emptyEcho
      ? 'ответ повторяет вопрос посетителя'
      : leftover
        ? 'после вырезаний не осталось ни ссылки, ни признания, ни утверждения'
        : strayAdmission
          ? 'признание не о том, что спросили, без ссылки и подтверждённого числа'
          : 'в ответе нет ни ссылки, ни признания, ни подтверждённого числа'
    findings.push({ check: 'echo', detail })
  }

  return { text, removed: linked.removed, relabeled: linked.relabeled, droppedDescriptions, ungroundedNumbers, promptLeaks, bareLinks, cardFragments, counterQuestions, fallback, findings }
}
