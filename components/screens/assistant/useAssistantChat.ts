/**
 * Состояние диалога ассистента (#2460): один вопрос за раз, экран только рисует
 * `turns` и зовёт `ask/stop/retry`. Путь ответа один (#3297) — серверный `POST /ai/ask`
 * службы metravel-assist (#2713): фильтр тем, лимит и блок «не по теме» на IP, подбор по
 * индексу, промпт, модель и страж живут на сервере; клиент показывает поток
 * `sources → text* → done`, а «осталось вопросов» и номер предупреждения берёт из ответа
 * сервера. Хранилище устройства для счётчиков и журнала не используется.
 *
 * Контекстный вход (#2897): с `source` (страница статьи или квеста) карточку этой
 * страницы первой в промпт ставит сервер по `source` в теле запроса; экран показывает
 * её заголовок и примеры вопросов под контекст.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { resolveAskAuth } from '@/api/aiAssist/askAuth'
import { detectPlanIntent } from '@/api/aiAssist/planIntent'
import { createPlanClient, type AiTripPlan, type PlanClient } from '@/api/aiAssist/planProvider'
import { createAskClient, isAskError, type AskClient, type AskFeedbackReason, type AskFeedbackVote } from '@/api/aiAssist/askProvider'
import { AI_OFFTOPIC_STRIKES_TO_BLOCK, ASK_NO_MATERIAL_REASON, MAX_QUESTION_LENGTH, secondsToDayEnd } from '@/api/aiAssist/policy'
import { loadSourceCard } from '@/api/aiAssist/sourceCard'
import type { AiSourceRef } from '@/api/aiAssist/sourceRef'
import type { AiWorldTrail } from '@/api/aiAssist/trailFacts'
import type { AiHistoryItem, AiSource, AiUsage } from '@/api/aiAssist/types'
import { getAiPicksBaseUrl } from '@/utils/aiPicksConfig'

export type AssistantTurnStatus =
  | 'searching'
  | 'streaming'
  | 'done'
  | 'no_sources'
  | 'off_topic'
  | 'unavailable'
  | 'busy'
  | 'error'
  | 'aborted'

export type AssistantTurn = {
  id: string
  question: string
  answer: string
  sources: AiSource[]
  status: AssistantTurnStatus
  /** Сколько адресов страж вырезал из ответа модели. */
  removedLinks: number
  retryAfterSec: number | null
  usage: AiUsage | null
  /** Какой по счёту за день вопрос не по теме (только у `off_topic`). */
  offTopicStrikes: number | null
  /**
   * Страж содержания (#3291): ответ модели пустой (повтор вопроса, фраза без ссылки и признания) —
   * `answer` пуст, карточка хода показывает запасную фразу и источники. В историю такой ход не идёт.
   */
  fallback?: boolean
  /**
   * Пустая подсказка (#3345): подбор нашёл карточки, но ни одна не прошла отбор — модель не вызывалась.
   * Ход тоже `fallback`, но карточка показывает «на сайте пока нет материалов» и найденное рядом.
   */
  noMaterial?: boolean
  /**
   * Оценка ответа (#3296). `feedbackId` — идентификатор хода от службы: есть — под ответом стоят кнопки
   * «Помогло» и «Не помогло». `vote` — отданный голос, `voteReason` — причина у «Не помогло»; один голос на ход.
   */
  feedbackId?: string | null
  vote?: AskFeedbackVote | null
  voteReason?: AskFeedbackReason | null
  /**
   * Маршруты мира (#3357) — второй ярус ответа службы: блок «Ещё в мире» под материалами сайта. Приходят
   * в подсказку модели и в историю диалога не идут.
   */
  world?: AiWorldTrail[]
  /** Адрес файла слоя OpenStreetMap под ODbL — ссылка под блоком «Ещё в мире»; служба отдаёт его, когда файл выложен. */
  worldLayerUrl?: string | null
  /**
   * План по дням (#3298): вопрос с намерением «план» служба `/ai/plan` отвечает днями с материалами сайта.
   * Ход с планом текста ответа не несёт и в историю диалога не идёт.
   */
  plan?: AiTripPlan | null
}

export type AssistantInputError = 'tooLong' | 'limit' | 'offTopicBlocked' | null

export type UseAssistantChatOptions = {
  locale: string
  /** Подмена клиента `/ai/ask` в тестах. */
  askClient?: AskClient
  /**
   * Клиент плана по дням (#3298) в тестах. С подменённым `askClient` и без него плана нет: такие тесты
   * не ходят в `/ai/plan` настоящим `fetch`.
   */
  planClient?: PlanClient | null
  /** Страница, с которой открыт ассистент (#2897); `null`/нет — обычный вход. */
  source?: AiSourceRef | null
  /** Подмена загрузки карточки источника в тестах. */
  loadSource?: (ref: AiSourceRef, locale: string, signal?: AbortSignal) => Promise<AiSource | null>
}

/** Пар вопрос-ответ в истории для модели (по 2 сообщения на пару, лимит 6). */
const HISTORY_TURNS = 3

const makeTurnId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** История для промпта: только завершённые ответы, не длиннее трёх пар. */
export const buildHistoryFromTurns = (turns: readonly AssistantTurn[]): AiHistoryItem[] =>
  turns
    .filter((turn) => turn.status === 'done' && turn.answer.trim().length > 0)
    .slice(-HISTORY_TURNS)
    .flatMap((turn) => [
      { role: 'user' as const, text: turn.question },
      { role: 'assistant' as const, text: turn.answer },
    ])

type ResolvedClients = { client: AskClient; plan: PlanClient | null }

const resolveClients = (options: Pick<UseAssistantChatOptions, 'askClient' | 'planClient'>): ResolvedClients => {
  if (options.askClient) return { client: options.askClient, plan: options.planClient ?? null }
  const baseUrl = getAiPicksBaseUrl()
  // Личный контекст (#3354): заголовок входа отдаёт `resolveAskAuth`. План по дням (#3298) собирает служба.
  return { client: createAskClient(baseUrl, { auth: () => resolveAskAuth(baseUrl) }), plan: options.planClient === undefined ? createPlanClient(baseUrl) : options.planClient }
}

export function useAssistantChat(options: UseAssistantChatOptions) {
  const { locale, loadSource = loadSourceCard } = options
  const sourceRef = options.source ?? null
  const [turns, setTurns] = useState<AssistantTurn[]>([])
  /** Карточка страницы-источника (#2897); `null` — нет источника или материал не нашёлся. */
  const [sourceCard, setSourceCard] = useState<AiSource | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [offTopicBlocked, setOffTopicBlocked] = useState(false)
  // #3354: служба подтвердила в последнем ходе, что учла статьи и сохранённое вошедшего посетителя.
  const [profileActive, setProfileActive] = useState(false)
  const [inputError, setInputError] = useState<AssistantInputError>(null)
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null)
  const turnsRef = useRef<AssistantTurn[]>([])
  const remainingRef = useRef<number | null>(null)
  const offTopicBlockedRef = useRef(false)
  /**
   * Лимит и блок, полученные с сервера, держатся до срока
   * (`Retry-After` или конец дня по зоне сервера) и снимаются таймером. Экран может
   * жить дольше суток (native), а сервер к тому времени уже обнулил счётчики —
   * после срока следующий вопрос снова уходит на сервер.
   */
  const limitResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  // Клиенты фиксируются подменами из тестов, иначе — адресом службы из конфигурации сборки.
  const { askClient: askClientOverride, planClient: planClientOverride } = options
  const clients = useMemo<ResolvedClients>(
    () => resolveClients({ askClient: askClientOverride, planClient: planClientOverride }),
    [askClientOverride, planClientOverride],
  )

  const updateRemaining = useCallback((left: number | null) => {
    if (left === null) return
    remainingRef.current = left
    if (mountedRef.current) setRemaining(left)
  }, [])

  const updateOffTopicBlocked = useCallback((blocked: boolean) => {
    offTopicBlockedRef.current = blocked
    if (mountedRef.current) setOffTopicBlocked(blocked)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    // Счётчики на IP приходят с ответом сервера: до первого ответа «осталось вопросов» неизвестно.
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      if (limitResetRef.current) clearTimeout(limitResetRef.current)
      if (blockResetRef.current) clearTimeout(blockResetRef.current)
    }
  }, [])

  // Ссылка сравнивается по значению: объект `source` экран может собирать на каждый рендер.
  const sourceType = sourceRef?.type ?? null
  const sourceId = sourceRef?.id ?? null
  useEffect(() => {
    if (!sourceType || sourceId === null) {
      setSourceCard(null)
      return
    }
    const controller = new AbortController()
    void loadSource({ type: sourceType, id: sourceId }, locale, controller.signal).catch(() => null).then((card) => {
      if (!controller.signal.aborted && mountedRef.current) setSourceCard(card)
    })
    return () => controller.abort()
  }, [loadSource, locale, sourceId, sourceType])

  const commitTurns = useCallback((updater: (prev: AssistantTurn[]) => AssistantTurn[]) => {
    turnsRef.current = updater(turnsRef.current)
    if (mountedRef.current) setTurns(turnsRef.current)
  }, [])

  const patchTurn = useCallback(
    (id: string, patch: Partial<AssistantTurn>) => {
      commitTurns((prev) => prev.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)))
    },
    [commitTurns],
  )

  /** Остаток лимита перед вопросом — последний ответ сервера; до первого ответа ограничения нет. */
  const readRemaining = useCallback((): number => remainingRef.current ?? Number.POSITIVE_INFINITY, [])

  /** Через `retryAfterSec` (или к концу дня сервера) снимает лимит: счётчик снова неизвестен до ответа сервера. */
  const scheduleLimitReset = useCallback((retryAfterSec: number | null) => {
    if (limitResetRef.current) clearTimeout(limitResetRef.current)
    const seconds = retryAfterSec !== null && retryAfterSec > 0 ? retryAfterSec : secondsToDayEnd()
    limitResetRef.current = setTimeout(() => {
      limitResetRef.current = null
      remainingRef.current = null
      if (!mountedRef.current) return
      setRemaining(null)
      setInputError((current) => (current === 'limit' ? null : current))
    }, seconds * 1000)
  }, [])

  const scheduleBlockReset = useCallback(
    (retryAfterSec: number | null) => {
      if (blockResetRef.current) clearTimeout(blockResetRef.current)
      const seconds = retryAfterSec !== null && retryAfterSec > 0 ? retryAfterSec : secondsToDayEnd()
      blockResetRef.current = setTimeout(() => {
        blockResetRef.current = null
        updateOffTopicBlocked(false)
        if (mountedRef.current) setInputError((current) => (current === 'offTopicBlocked' ? null : current))
      }, seconds * 1000)
    },
    [updateOffTopicBlocked],
  )

  /** Остаток с сервера; ноль — лимит исчерпан до конца дня сервера (без `Retry-After` в событиях потока). */
  const applyServerRemaining = useCallback(
    (left: number | null) => {
      updateRemaining(left)
      if (left === 0) scheduleLimitReset(null)
    },
    [scheduleLimitReset, updateRemaining],
  )

  /** Один `POST /ai/ask`: состояния хода — из событий и кодов сервера. */
  const askViaServer = useCallback(
    async (client: AskClient, id: string, question: string, controller: AbortController, history: AiHistoryItem[]) => {
      try {
        const result = await client.ask({
          question,
          locale,
          history,
          source: sourceRef,
          signal: controller.signal,
          onSources: (event) => {
            applyServerRemaining(event.remaining)
            if (event.sources.length) patchTurn(id, { sources: event.sources, status: 'streaming', world: event.world ?? [], worldLayerUrl: event.worldLayerUrl ?? null })
          },
          onText: (text) => patchTurn(id, { answer: text }),
        })
        const { done } = result
        applyServerRemaining(done.remaining)
        if (mountedRef.current) setProfileActive(done.profile === true)
        switch (done.status) {
          case 'done':
            patchTurn(id, {
              answer: result.text,
              sources: result.sources,
              removedLinks: done.removedLinks,
              status: 'done',
              usage: done.usage,
              fallback: done.fallback,
              noMaterial: done.fallback && done.reason === ASK_NO_MATERIAL_REASON,
              // Оценку принимает только клиент, который умеет её отправить.
              feedbackId: client.feedback ? done.turnId : null,
              world: result.world ?? [],
              worldLayerUrl: result.worldLayerUrl ?? null,
            })
            if (__DEV__) {
              console.info('[ai-assist] usage', { ...done.usage, removedLinks: done.removedLinks, sources: result.sources.length })
            }
            return
          case 'off_topic':
            // Отказ модели (`model_refusal`) в счётчик не идёт — без номера предупреждения.
            patchTurn(id, {
              status: 'off_topic',
              answer: '',
              sources: [],
              removedLinks: 0,
              offTopicStrikes: done.reason === 'offtopic_warning' ? done.strikes : null,
            })
            return
          case 'no_sources':
            // На сайте материала нет, а маршруты мира служба нашла (#3357): блок «Ещё в мире» остаётся.
            patchTurn(id, { status: 'no_sources', answer: '', sources: [], world: result.world ?? [], worldLayerUrl: result.worldLayerUrl ?? null })
            return
          case 'unavailable':
            patchTurn(id, { status: 'unavailable' })
            return
          default:
            patchTurn(id, { status: 'error' })
        }
      } catch (error) {
        // Ход без ответа службы личный контекст не подтверждает (#3431, Б1): отказ 429, обрыв и исключение
        // оставляли строку «Ассистент учитывает…» от прошлого хода до следующего `done`.
        if (mountedRef.current) setProfileActive(false)
        if (isAskError(error)) {
          switch (error.kind) {
            case 'aborted':
              patchTurn(id, { status: 'aborted' })
              return
            case 'busy':
              patchTurn(id, { status: 'busy', retryAfterSec: error.retryAfterSec })
              return
            case 'limit':
              // Сервер отказал до ответа: вопрос не занимает место на ленте; счётчик на сегодня — ноль.
              commitTurns((prev) => prev.filter((turn) => turn.id !== id))
              updateRemaining(0)
              scheduleLimitReset(error.retryAfterSec)
              setInputError('limit')
              return
            case 'offtopic_blocked':
              // Блок на IP держит сервер; после обновления страницы о нём узнаём отсюда.
              patchTurn(id, {
                status: 'off_topic',
                answer: '',
                sources: [],
                removedLinks: 0,
                offTopicStrikes: error.strikes ?? AI_OFFTOPIC_STRIKES_TO_BLOCK,
              })
              updateOffTopicBlocked(true)
              scheduleBlockReset(error.retryAfterSec)
              return
            default:
              patchTurn(id, { status: 'unavailable' })
              return
          }
        }
        patchTurn(id, { status: controller.signal.aborted ? 'aborted' : 'error' })
      }
    },
    [applyServerRemaining, commitTurns, locale, patchTurn, scheduleBlockReset, scheduleLimitReset, sourceRef, updateOffTopicBlocked, updateRemaining],
  )

  /**
   * План по дням (#3298). `true` — ход закрыт: план показан либо вопрос отменён посетителем; `false` — плана
   * нет (место не названо, материалов мало, служба отказала): вопрос идёт обычным путём `/ai/ask`.
   */
  const askPlan = useCallback(
    async (client: PlanClient, id: string, question: string, controller: AbortController): Promise<boolean> => {
      const outcome = await client.plan({ question, locale, signal: controller.signal })
      if (outcome.aborted) {
        patchTurn(id, { status: 'aborted' })
        return true
      }
      if (!outcome.plan) return false
      patchTurn(id, { status: 'done', answer: '', sources: [], removedLinks: 0, plan: outcome.plan })
      return true
    },
    [locale, patchTurn],
  )

  const ask = useCallback(
    async (rawQuestion: string): Promise<void> => {
      const question = String(rawQuestion ?? '').replace(/\s+/g, ' ').trim()
      if (!question || abortRef.current) return
      if (question.length > MAX_QUESTION_LENGTH) {
        setInputError('tooLong')
        return
      }
      if (offTopicBlockedRef.current) {
        setInputError('offTopicBlocked')
        return
      }
      if (readRemaining() <= 0) {
        updateRemaining(0)
        setInputError('limit')
        return
      }
      // Очередь занимается синхронно: двойное нажатие иначе запустило бы второй вопрос, который
      // перетёр бы `abortRef` (кнопка «Остановить» отменяла бы чужой запрос).
      const controller = new AbortController()
      abortRef.current = controller
      setInputError(null)

      const id = makeTurnId()
      setActiveTurnId(id)
      const history = buildHistoryFromTurns(turnsRef.current)
      commitTurns((prev) => [
        ...prev,
        { id, question, answer: '', sources: [], status: 'searching', removedLinks: 0, retryAfterSec: null, usage: null, offTopicStrikes: null },
      ])

      try {
        // Намерение «план» (#3298): сначала `/ai/plan`; любой его отказ — тот же вопрос обычным путём, без
        // ошибки на экране. Со страницы материала (#2897) плана нет: вопрос читается как вопрос о странице.
        const planned = clients.plan && !sourceRef && detectPlanIntent(question) ? await askPlan(clients.plan, id, question, controller) : false
        if (!planned) await askViaServer(clients.client, id, question, controller, history)
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        if (mountedRef.current) setActiveTurnId((current) => (current === id ? null : current))
      }
    },
    [askPlan, askViaServer, clients, commitTurns, readRemaining, sourceRef, updateRemaining],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const retry = useCallback(
    async (turnId: string): Promise<void> => {
      const turn = turnsRef.current.find((item) => item.id === turnId)
      if (!turn || abortRef.current) return
      // Ход снимается с ленты только когда повтор действительно стартует: при
      // исчерпанном лимите вопрос остаётся на экране вместе с подписью лимита.
      const left = readRemaining()
      if (left <= 0 || abortRef.current) {
        if (left <= 0) {
          updateRemaining(0)
          setInputError('limit')
        }
        return
      }
      commitTurns((prev) => prev.filter((item) => item.id !== turnId))
      await ask(turn.question)
    },
    [ask, commitTurns, readRemaining, updateRemaining],
  )

  /**
   * Оценка ответа (#3296): голос уходит службе, кнопки под ответом сменяются благодарностью сразу — оценка
   * необязательна, отказ службы посетителю не показывается. Один голос на ход; после «Не помогло» причину
   * можно назвать один раз.
   */
  const rate = useCallback(
    (turnId: string, vote: AskFeedbackVote, reason: AskFeedbackReason | null = null): void => {
      const turn = turnsRef.current.find((item) => item.id === turnId)
      if (!turn?.feedbackId || !clients.client.feedback) return
      const refines = turn.vote === 'down' && vote === 'down' && !turn.voteReason && reason !== null
      if (turn.vote && !refines) return
      patchTurn(turnId, { vote, voteReason: vote === 'down' ? reason : null })
      void clients.client.feedback({ turnId: turn.feedbackId, vote, reason })
    },
    [clients, patchTurn],
  )

  const clearInputError = useCallback(() => setInputError(null), [])

  return {
    turns,
    sourceRef,
    sourceCard,
    remaining,
    offTopicBlocked,
    /** Служба учла личный контекст в последнем ходе (#3354); строку под лентой экран показывает только вошедшему. */
    profileActive,
    inputError,
    busy: activeTurnId !== null,
    ask,
    stop,
    retry,
    rate,
    clearInputError,
  }
}

export type AssistantChat = ReturnType<typeof useAssistantChat>
