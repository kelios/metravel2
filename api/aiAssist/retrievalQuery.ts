/**
 * Опора уточнений в диалоге (#2719, перенос #2884): уточнение без своего места
 * («А какой из них подойдёт детям?») ищется вместе с последним самостоятельным
 * вопросом, иначе подбор не знает, о каком городе речь, и отвечает «материалов
 * нет». Модуль общий для экрана (`useAssistantChat`) и сервера `/ai/ask`
 * (`scripts/ai-assist/ask.ts`), поэтому без `@/`-импортов: сервер собирается
 * `node --experimental-strip-types` без алиасов Metro.
 */

// Явное расширение: модуль грузит и `node --experimental-strip-types` (служба), которому без него не найти файл.
import { mentionsPlace } from './topicGate.ts'
import type { AiHistoryItem, AiSource } from './types'

export type AiSourceIntent = AiSource['type'] | null
// `\b` не знает кириллицы — граница слова через lookbehind по букве.
// Кириллица — по началу слова (квест/квесты/квестов), латиница — целым словом:
// иначе «question»/«kwestia» читались как намерение про квесты.
const QUEST_INTENT_RE = /(?<!\p{L})(?:квест|квэст|(?:quest(?:s|y|ów|u)?|kwest(?:y|ów|u)?)(?!\p{L}))/iu
const TRAVEL_INTENT_RE = /(?<!\p{L})(?:стать|артыкул|маршрут|путеводител|(?:articles?|artykuły?|trasy?|trasa|routes?)(?!\p{L}))/iu

/** Намерение вопроса: «квесты…» / «статья, маршрут…»; оба или ни одного — `null`. Общее с `/ai/ask` (#3276). */
export const detectIntent = (query: string): AiSourceIntent => {
  const text = String(query ?? '')
  const quest = QUEST_INTENT_RE.test(text)
  const travel = TRAVEL_INTENT_RE.test(text)
  if (quest && !travel) return 'quest'
  if (travel && !quest) return 'travel'
  return null
}

// Уточнение начинается с «А/И/Ещё…» или ссылается на прошлый вопрос («из них», «там»,
// «туда», «этот»…) — на RU/BE/UK/PL/EN. Польское «I …» — уточнение, английское
// местоимение «I want/I'm …» — нет; «there» в «is there / there are» — оборот, а не «там».
const FOLLOW_UP_START_RE =
  /^\s*(?:а|и|ещё|еще|і|ще|a(?=\s+co(?![\p{L}]))|i(?!['’]|\s+(?:am|was|want|need|would|will|wonder|have|had|plan|like|love|think|know|do|did|can|could|should|go|travel|visit)(?![\p{L}]))|and|also|what\s+about|how\s+about|a\s+co)(?![\p{L}])/iu
const FOLLOW_UP_REFERENCE_RE =
  /(?<![\p{L}])(?:из\s+(?:них|этих)|там|туда|оттуда|эт(?:от|а|о|и|ого|их|ой(?!\s+(?:зимой|весной|летом|осенью|ночью)))|него|неё|нее|них|з\s+(?:іх|них)|туды|туди|z\s+nich|tam|tego|tej|of\s+them|(?<!(?:is|are|was|were)\s+)there(?!\s+(?:is|are|was|were)(?![\p{L}])|['’]s)|those|these)(?![\p{L}])/iu

export const isFollowUpQuestion = (question: string): boolean =>
  FOLLOW_UP_START_RE.test(question) || FOLLOW_UP_REFERENCE_RE.test(question)

/**
 * Самостоятельный вопрос — опора для следующих уточнений. Своё место в уточнении
 * («А в Бресте?») важнее прошлого: такой вопрос ищется сам по себе.
 */
export const isStandaloneQuestion = (question: string): boolean =>
  mentionsPlace(question) || !isFollowUpQuestion(question)

/**
 * Запрос подбора с учётом диалога: уточнение ищется вместе с прошлым самостоятельным
 * вопросом; самостоятельный вопрос — сам по себе. Модель при этом получает исходный
 * вопрос и историю, склейка нужна только подбору.
 */
export const buildRetrievalQuery = (question: string, previousQuery?: string | null): string => {
  const previous = String(previousQuery ?? '').trim()
  if (!previous || isStandaloneQuestion(question)) return question
  return `${previous} ${question}`
}

/**
 * Опора уточнений из истории диалога — последний самостоятельный вопрос посетителя.
 * История несёт только завершённые ответы (`buildHistoryFromTurns`), поэтому вопрос,
 * на который модель отказала или сервер не ответил, опорой не становится. Склеенный
 * запрос опорой не считается: цепочка уточнений иначе копила бы все прошлые вопросы.
 */
export const resolveRetrievalAnchor = (history: readonly AiHistoryItem[]): string | null => {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index]
    if (item.role !== 'user') continue
    const text = String(item.text ?? '').replace(/\s+/g, ' ').trim()
    if (text && isStandaloneQuestion(text)) return text
  }
  return null
}
