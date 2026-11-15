/**
 * POST /ai/plan (#3298): «Спланируй два дня в Кракове» → план по дням из материалов сайта.
 *
 *   {q, locale?} → 200 {days: [{items: [{type, source_id, title, url, path, hours, lat, lng, cover, city, country}]}],
 *                       note, days_requested, assembled: 'model' | 'code', remaining}
 *   400 bad_request — кривой `q` или `locale`
 *   404 no_material — вопрос не о поездке, место не названо либо материалов этого места нет: экран задаёт тот
 *     же вопрос обычному `/ai/ask`; запрос в квоту возвращается
 *   422 invalid_plan — у места один материал: плана из него не собрать ни модели, ни коду
 *   429 limit — свой суточный счётчик на IP (`AskLimits` с префиксом `ai-plan:v1`) · 429 offtopic_blocked —
 *     ассистент закрыт для этого адреса до полуночи (блок `/ai/ask`)
 *   503 busy — очередь к эмбеддингу подбора
 *
 * Конвейер: число дней — из вопроса кодом (`planDaysOf`) → карточки одного места и региона с фактами
 * (`AppDeps.planCandidates`) → модель выбирает из них по `source` и `id` и отвечает JSON → проверка схемы
 * (`planSchema.ts`) → доводка кодом (`planBuild.ts`: часы из фактов, порядок по карте, предел часов дня).
 *
 * План собирается всегда. Путь модели выключен (по умолчанию; включает `AI_PLAN_MODEL=1`), модель не настроена, занята, не ответила или
 * ответила не по схеме — план из тех же карточек собирает код (`assemblePlan`), ответ несёт
 * `assembled: 'code'`. Навыка «план по дням» у модели продукта пока нет — отказ `422` на каждый её сбой
 * оставлял бы посетителя без плана. `422` остаётся одному случаю: карточек меньше двух.
 *
 * `note` — фраза к плану, которую пишет код; сейчас она всегда пуста. Фраза модели посетителю не уходит —
 * это непроверенный текст: она остаётся только в `trace` контура оценки (`model_note`). Фразу о нехватке
 * материалов и подписи дней экран строит сам через i18n — по `days_requested` и числу дней ответа.
 *
 * Журнал спроса получает запись плана без IP: вопрос, язык, кто собрал и идентификаторы материалов по дням.
 * Контур оценки (`AI_ASSIST_EVAL_TRACE=1`) получает в ответе поле `trace`: карточки подсказки, сырой ответ
 * модели, ошибки схемы и кто собрал план.
 */
import type http from 'node:http'

import { type Generator, isAiGeneratorError } from '../../api/aiAssist/generator.ts'
import { planDaysOf, requestedDaysOf } from '../../api/aiAssist/planIntent.ts'
import { ASSISTANT_SYSTEM_PROMPT, resolveAnswerLanguage, sanitizeFragment } from '../../api/aiAssist/prompt.ts'
import { classifyQuestion } from '../../api/aiAssist/topicGate.ts'
import type { AiChatMessage } from '../../api/aiAssist/types.ts'
import { clientIp } from './ask.ts'
import type { DemandLog } from './demandLog.ts'
import type { AskLimits } from './limits.ts'
import { HttpError, parseLocale, parseQuery } from './params.ts'
import { assemblePlan, candidateKey, PLAN_DAY_MAX_HOURS, PLAN_MAX_ITEMS_PER_DAY, type PlanCandidate, type PlanDay, refinePlan } from './planBuild.ts'
import { parsePlanAnswer } from './planSchema.ts'
import { BusyError, type SingleFlight } from './queue.ts'
import type { Locale } from './search.ts'

export const PLAN_LIMITS_PREFIX = 'ai-plan:v1'
/** Ответ — JSON до семи дней по четыре материала и короткая фраза. */
export const PLAN_MAX_TOKENS = 500

export type PlanAssembled = 'model' | 'code'

export interface PlanCandidates {
  cards: PlanCandidate[]
  /** В вопросе названо место, и подбор его узнал. */
  place: boolean
}

export interface PlanTrace {
  candidates: Array<{ type: string; source_id: number; title: string; facts_line: string }>
  model_called: boolean
  raw_text: string
  /** Фраза модели из годного ответа — посетителю не показывается. */
  model_note: string
  errors: string[]
  assembled: PlanAssembled
}

export interface PlanResponse {
  days: PlanDay[]
  note: string
  days_requested: number
  assembled: PlanAssembled
  remaining: number
  trace?: PlanTrace
}

export interface PlanDeps {
  /** Карточки одного места и региона под вопрос; бросает `HttpError` 503 busy при занятой модели эмбеддинга. */
  candidates: (q: string, locale: Locale) => Promise<PlanCandidates>
  /** `null` — `AI_LLM_URL` не задан: план собирает код. */
  generator: Generator | null
  /** Путь модели включён (`AI_PLAN_MODEL=1`); по умолчанию выключен — план сразу собирает код. */
  modelEnabled: boolean
  llmQueue: SingleFlight
  queueTimeoutMs: number
  /** Счётчик планов на IP — с префиксом `PLAN_LIMITS_PREFIX`. */
  limits: AskLimits
  /** Счётчики `/ai/ask`: блок «вопросы не по теме» закрывает для адреса и план. */
  askLimits: AskLimits
  demandLog: DemandLog
  trustProxy: boolean
  /** `AI_ASSIST_EVAL_TRACE=1`: поле `trace` в ответе. */
  evalTrace?: boolean
  log: (line: string) => void
  now?: () => Date
}

/** `null` — посетитель закрыл соединение до ответа. */
export type PlanHandler = (request: http.IncomingMessage, response: http.ServerResponse, body: unknown) => Promise<PlanResponse | null>

/** Карточка в подсказке: пара `source`/`id`, по которой модель выбирает, название и строка фактов. */
export const formatPlanCard = (card: PlanCandidate): string =>
  `- source: ${card.type}, id: ${card.source_id} — «${sanitizeFragment(card.title, 120)}»${card.facts_line ? ` — ${sanitizeFragment(card.facts_line, 160)}` : ''}`

/**
 * Подсказка плана. Образец ответа и два уточнения появились после первой пробы на модели продукта
 * (15.11.2026, 54 ответа): модель повторяла поле `note` в каждом дне (35 ответов) и писала часы минутами из
 * строки фактов — «120» у квеста на 120 мин (15 ответов).
 */
export const buildPlanPrompt = (q: string, locale: string, days: number, cards: readonly PlanCandidate[]): string =>
  `Составь план поездки по дням в JSON для запроса:\n«${sanitizeFragment(q, 500)}»\n` +
  'Форма ответа: {"days": [{"items": [{"source": "quest", "id": ID, "hours": 2}, {"source": "travel", "id": ID, "hours": 4}]}, {"items": [{"source": "travel", "id": ID, "hours": 5}]}], "note": "фраза"} — ' +
  'у дня только поле items, у материала только source, id и hours, поле note одно — в конце.\n' +
  `Дней в плане: ${days}; если материалов мало — дней меньше. В одном дне от 1 до ${PLAN_MAX_ITEMS_PER_DAY} материалов, вместе не больше ${PLAN_DAY_MAX_HOURS} часов; ` +
  'места рядом ставь в один день. Бери материалы только из списка ниже по их source и id, каждый не больше одного раза. ' +
  'hours — число часов, не минут: квест на 120 мин — это 2, на 90 мин — 1.5. ' +
  `note — одна короткая фраза на ${resolveAnswerLanguage(locale)} языке, без ссылок. Ответь только JSON.\n` +
  `Материалы:\n${cards.map(formatPlanCard).join('\n')}`

export const buildPlanMessages = (q: string, locale: string, days: number, cards: readonly PlanCandidate[]): AiChatMessage[] => [
  { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
  { role: 'user', content: buildPlanPrompt(q, locale, days, cards) },
]

export function createPlanHandler(deps: PlanDeps): PlanHandler {
  const { limits, askLimits, demandLog, log } = deps
  const nowFn = deps.now ?? (() => new Date())

  return async (request, response, body) => {
    const now = nowFn()
    const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const q = parseQuery(input.q)
    const locale = parseLocale(input.locale)
    const ip = clientIp(request, deps.trustProxy)

    // Блок «вопросы не по теме» держит служба: закрытый для адреса ассистент плана тоже не строит.
    const offTopic = await askLimits.offTopicState(ip, now)
    if (offTopic.blocked) {
      throw new HttpError(429, 'offtopic_blocked', {
        detail: 'ассистент закрыт до полуночи: вопросы не по теме',
        retryAfterSec: askLimits.retryAfterSeconds(now),
        extra: { retry_after_sec: askLimits.retryAfterSeconds(now), strikes: offTopic.strikes, strikes_to_block: askLimits.strikesToBlock },
      })
    }
    // Чужую тему считает `/ai/ask` (предупреждения и блок): экран задаст вопрос ему.
    if (classifyQuestion(q).offTopic) throw new HttpError(404, 'no_material', 'вопрос не о поездке')

    const quota = await limits.consumeQuestion(ip, now)
    const refund = () => limits.refundQuestion(ip, now)
    if (quota.exceeded) {
      await refund()
      throw new HttpError(429, 'limit', {
        detail: `дневной лимит ${limits.dailyLimit} планов исчерпан`,
        retryAfterSec: limits.retryAfterSeconds(now),
        extra: { retry_after_sec: limits.retryAfterSeconds(now), limit: limits.dailyLimit },
      })
    }

    let found: PlanCandidates
    try {
      found = await deps.candidates(q, locale)
    } catch (error) {
      await refund()
      throw error
    }
    const { cards } = found
    if (!found.place || cards.length === 0) {
      await refund()
      throw new HttpError(404, 'no_material', found.place ? 'материалов этого места на сайте нет' : 'в вопросе не названо место')
    }
    if (cards.length < 2) {
      await refund()
      throw new HttpError(422, 'invalid_plan', { detail: 'у места один материал: плана по дням из него не собрать' })
    }

    const days = planDaysOf(q)
    const allowed = new Set(cards.map(candidateKey))
    let rawText = ''
    let errors: string[] = []
    let modelCalled = false
    let planDays: PlanDay[] = []
    let modelNote = ''
    let assembled: PlanAssembled = 'code'

    const generator = deps.modelEnabled ? deps.generator : null
    if (generator) {
      const controller = new AbortController()
      response.once('close', () => {
        if (!response.writableFinished) controller.abort()
      })
      if (response.destroyed) controller.abort()
      try {
        modelCalled = true
        const answer = await deps.llmQueue.run(deps.queueTimeoutMs, () =>
          generator.generate({ messages: buildPlanMessages(q, locale, days, cards), signal: controller.signal, maxTokens: PLAN_MAX_TOKENS }),
        )
        rawText = answer.text
        const parsed = parsePlanAnswer(rawText, { allowed, maxDays: days })
        errors = parsed.errors
        if (parsed.plan) {
          planDays = refinePlan(parsed.plan, cards, { days })
          modelNote = parsed.plan.note
          if (planDays.length) assembled = 'model'
        }
      } catch (error) {
        if (isAiGeneratorError(error) && error.kind === 'aborted') {
          // Соединение закрыл посетитель: отвечать некому.
          await refund()
          response.destroy()
          return null
        }
        // Модель занята, недоступна или упала — план соберёт код.
        if (error instanceof BusyError || isAiGeneratorError(error)) errors = [`model: ${error instanceof BusyError ? 'busy' : error.kind}`]
        else {
          errors = ['model: error']
          log(`POST /ai/plan: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
        }
      }
    }
    if (assembled === 'code') planDays = assemblePlan(cards, { days })
    if (!planDays.length) {
      await refund()
      throw new HttpError(422, 'invalid_plan', { detail: 'план не собрался' })
    }

    const daysRequested = requestedDaysOf(q)
    await demandLog.appendPlan({
      q,
      locale,
      plan: assembled,
      days_requested: daysRequested,
      day_ids: planDays.map((day) => day.items.map((item) => `${item.type}:${item.source_id}`)),
    })
    return {
      days: planDays,
      // Фразу к плану пишет только код; фраза модели — непроверенный текст и остаётся в `trace`.
      note: '',
      days_requested: daysRequested,
      assembled,
      remaining: quota.remaining,
      ...(deps.evalTrace
        ? {
            trace: {
              candidates: cards.map((card) => ({ type: card.type, source_id: card.source_id, title: card.title, facts_line: card.facts_line })),
              model_called: modelCalled,
              raw_text: rawText,
              model_note: modelNote,
              errors,
              assembled,
            },
          }
        : {}),
    }
  }
}
