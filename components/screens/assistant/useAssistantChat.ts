/**
 * Состояние диалога ассистента (#2460): один вопрос за раз, экран только рисует
 * `turns` и зовёт `ask/stop/retry`. Два провайдера (#2884, `utils/aiAssistantConfig.ts`):
 *
 * - `ask` (по умолчанию) — серверный `POST /ai/ask` службы metravel-assist (#2713):
 *   фильтр тем, лимит и блок «не по теме» на IP, подбор по индексу, промпт, модель и
 *   страж ссылок живут на сервере; клиент показывает поток `sources → text* → done`,
 *   а «осталось вопросов» и номер предупреждения берёт из ответа сервера;
 * - `llamacpp` — прямой `llama-server`: пайплайн «фильтр тем → подбор карточек →
 *   промпт → metravel-llm → страж ссылок» выполняется здесь, дневной лимит, счётчик
 *   вопросов не по теме (#2711) и журнал спроса — в хранилище устройства.
 *
 * Контекстный вход (#2897): с `source` (страница статьи или квеста) карточка этой
 * страницы стоит первой в промпте на каждом ходу — у `ask` её ставит сервер по
 * `source` в теле запроса, у `llamacpp` — `pinSourceFirst` перед подбором; экран
 * показывает её заголовок и примеры вопросов под контекст.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createAskClient, isAskError, type AskClient } from '@/api/aiAssist/askProvider'
import { logDemand } from '@/api/aiAssist/demandLog'
import { createGenerator, isAiGeneratorError, type Generator } from '@/api/aiAssist/generator'
import {
  AI_OFFTOPIC_STRIKES_TO_BLOCK,
  consumeQuestion,
  readOffTopicState,
  readRemainingQuestions,
  registerOffTopicStrike,
} from '@/api/aiAssist/limits'
import { guardAnswer } from '@/api/aiAssist/answerGuard'
import { countKeptSourceLinks, guardStreamingText } from '@/api/aiAssist/linkGuard'
import { AI_MAX_RECOMMENDATIONS, secondsToDayEnd } from '@/api/aiAssist/policy'
import { MAX_QUESTION_LENGTH, buildAssistantMessages } from '@/api/aiAssist/prompt'
import { buildRetrievalQuery, loadSourceCard, searchSiteMaterials } from '@/api/aiAssist/retrieval'
import { pinSourceFirst, type AiSourceRef } from '@/api/aiAssist/sourceRef'
import { arrangeSources } from '@/api/aiAssist/sourceSelection'
import { classifyQuestion, judgeModelReply } from '@/api/aiAssist/topicGate'
import type { AiHistoryItem, AiSource, AiUsage } from '@/api/aiAssist/types'
import { getAiAssistantBaseUrl, getAiAssistantProvider, type AiAssistantProvider } from '@/utils/aiAssistantConfig'
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
}

export type AssistantInputError = 'tooLong' | 'limit' | 'offTopicBlocked' | null

export type UseAssistantChatOptions = {
  locale: string
  /** Подмена провайдера `llamacpp` в тестах; `null` — модель не настроена. */
  generator?: Generator | null
  /** Подмена провайдера `ask` в тестах; задан — путь через сервер. */
  askClient?: AskClient
  /** Страница, с которой открыт ассистент (#2897); `null`/нет — обычный вход. */
  source?: AiSourceRef | null
  /** Подмена загрузки карточки источника в тестах. */
  loadSource?: (ref: AiSourceRef, locale: string, signal?: AbortSignal) => Promise<AiSource | null>
}

const STREAM_FLUSH_MS = 40
/** Пар вопрос-ответ в истории для модели (по 2 сообщения на пару, лимит 6). */
const HISTORY_TURNS = 3

const makeTurnId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export { guardStreamingText }

/** История для промпта: только завершённые ответы, не длиннее трёх пар. */
export const buildHistoryFromTurns = (turns: readonly AssistantTurn[]): AiHistoryItem[] =>
  turns
    .filter((turn) => turn.status === 'done' && turn.answer.trim().length > 0)
    .slice(-HISTORY_TURNS)
    .flatMap((turn) => [
      { role: 'user' as const, text: turn.question },
      { role: 'assistant' as const, text: turn.answer },
    ])

type ResolvedProvider =
  | { kind: 'ask'; client: AskClient }
  | { kind: 'llamacpp'; generator: Generator | null }

const resolveProvider = (options: Pick<UseAssistantChatOptions, 'generator' | 'askClient'>): ResolvedProvider => {
  if (options.askClient) return { kind: 'ask', client: options.askClient }
  if (options.generator !== undefined) return { kind: 'llamacpp', generator: options.generator }
  const provider: AiAssistantProvider = getAiAssistantProvider()
  if (provider === 'llamacpp') return { kind: 'llamacpp', generator: createGenerator(getAiAssistantBaseUrl()) }
  return { kind: 'ask', client: createAskClient(getAiPicksBaseUrl()) }
}

export function useAssistantChat(options: UseAssistantChatOptions) {
  const { locale, loadSource = loadSourceCard } = options
  const sourceRef = options.source ?? null
  const [turns, setTurns] = useState<AssistantTurn[]>([])
  /** Карточка страницы-источника (#2897); `null` — нет источника или материал не нашёлся. */
  const [sourceCard, setSourceCard] = useState<AiSource | null>(null)
  /** Загрузка карточки: вопрос, заданный до её прихода, дожидается её (`llamacpp`). */
  const sourceLoadRef = useRef<Promise<AiSource | null> | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [offTopicBlocked, setOffTopicBlocked] = useState(false)
  const [inputError, setInputError] = useState<AssistantInputError>(null)
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null)
  const turnsRef = useRef<AssistantTurn[]>([])
  const remainingRef = useRef<number | null>(null)
  const offTopicBlockedRef = useRef(false)
  /**
   * Провайдер `ask`: лимит и блок, полученные с сервера, держатся до срока
   * (`Retry-After` или конец дня по зоне сервера) и снимаются таймером. Экран может
   * жить дольше суток (native), а сервер к тому времени уже обнулил счётчики —
   * после срока следующий вопрос снова уходит на сервер.
   */
  const limitResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  /**
   * Провайдер `llamacpp`: последний самостоятельный вопрос по теме — опора уточнений
   * (#2719). Склеенный запрос опорой не становится: цепочка уточнений иначе копила бы все
   * прошлые вопросы, а бэкенд требует от статьи все слова запроса; повтор хода склеивал
   * бы вопрос сам с собой. Для `ask` ту же опору сервер берёт из истории диалога.
   */
  const lastSearchQueryRef = useRef<string | null>(null)

  // Провайдер фиксируется подменами из тестов, иначе — конфигурацией сборки.
  const { generator: generatorOverride, askClient: askClientOverride } = options
  const provider = useMemo<ResolvedProvider>(
    () => resolveProvider({ generator: generatorOverride, askClient: askClientOverride }),
    [generatorOverride, askClientOverride],
  )
  const serverSide = provider.kind === 'ask'

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
    // Серверный провайдер: счётчики на IP приходят с ответом, хранилище устройства
    // не читается — его очистка и так ничего не снимает.
    if (!serverSide) {
      void readRemainingQuestions().then(updateRemaining)
      void readOffTopicState().then((state) => updateOffTopicBlocked(state.blocked))
    }
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
      if (limitResetRef.current) clearTimeout(limitResetRef.current)
      if (blockResetRef.current) clearTimeout(blockResetRef.current)
    }
  }, [serverSide, updateOffTopicBlocked, updateRemaining])

  // Ссылка сравнивается по значению: объект `source` экран может собирать на каждый рендер.
  const sourceType = sourceRef?.type ?? null
  const sourceId = sourceRef?.id ?? null
  useEffect(() => {
    if (!sourceType || sourceId === null) {
      sourceLoadRef.current = null
      setSourceCard(null)
      return
    }
    const controller = new AbortController()
    const load = loadSource({ type: sourceType, id: sourceId }, locale, controller.signal).catch(() => null)
    sourceLoadRef.current = load
    void load.then((card) => {
      if (!controller.signal.aborted && mountedRef.current) setSourceCard(card)
    })
    return () => {
      controller.abort()
      if (sourceLoadRef.current === load) sourceLoadRef.current = null
    }
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

  const clearFlush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }, [])

  /** Остаток лимита перед вопросом: у `ask` — последний ответ сервера (до первого — без ограничения). */
  const readRemaining = useCallback(
    async (): Promise<number> => (serverSide ? (remainingRef.current ?? Number.POSITIVE_INFINITY) : readRemainingQuestions()),
    [serverSide],
  )

  const readBlocked = useCallback(
    async (): Promise<boolean> => (serverSide ? offTopicBlockedRef.current : (await readOffTopicState()).blocked),
    [serverSide],
  )

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

  const finishQuota = useCallback(async () => {
    updateRemaining(await consumeQuestion())
  }, [updateRemaining])

  /** Ход «не по теме» по фильтру тем: отказ без источников, счётчик за день; на третьем — журнал и блок до завтра. */
  const finishOffTopic = useCallback(
    async (id: string, question: string) => {
      const state = await registerOffTopicStrike()
      patchTurn(id, { status: 'off_topic', answer: '', sources: [], removedLinks: 0, offTopicStrikes: state.strikes })
      if (!state.blocked) return
      void logDemand({ q: question, locale, reason: 'offtopic_blocked' })
      updateOffTopicBlocked(true)
    },
    [locale, patchTurn, updateOffTopicBlocked],
  )

  /** Провайдер `ask`: один `POST /ai/ask`, состояния хода — из событий и кодов сервера. */
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
            if (event.sources.length) patchTurn(id, { sources: event.sources, status: 'streaming' })
          },
          onText: (text) => patchTurn(id, { answer: text }),
        })
        const { done } = result
        applyServerRemaining(done.remaining)
        switch (done.status) {
          case 'done':
            patchTurn(id, { answer: result.text, sources: result.sources, removedLinks: done.removedLinks, status: 'done', usage: done.usage, fallback: done.fallback })
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
            patchTurn(id, { status: 'no_sources', answer: '', sources: [] })
            return
          case 'unavailable':
            patchTurn(id, { status: 'unavailable' })
            return
          default:
            patchTurn(id, { status: 'error' })
        }
      } catch (error) {
        if (isAskError(error)) {
          switch (error.kind) {
            case 'aborted':
              patchTurn(id, { status: 'aborted' })
              return
            case 'busy':
              patchTurn(id, { status: 'busy', retryAfterSec: error.retryAfterSec })
              return
            case 'limit':
              // Сервер отказал до ответа: вопрос не занимает место на ленте, как и при
              // локальной проверке лимита; счётчик на сегодня — ноль.
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

  /** Провайдер `llamacpp`: подбор, промпт, модель и страж на клиенте, счётчики в хранилище. */
  const askViaLlamaCpp = useCallback(
    async (generator: Generator | null, id: string, question: string, controller: AbortController, history: AiHistoryItem[]) => {
      try {
        // Чужая тема не тратит ни подбор, ни модель, ни дневной лимит.
        if (classifyQuestion(question).offTopic) {
          await finishOffTopic(id, question)
          return
        }
        let sources: AiSource[] = []
        // Карточка страницы-источника (#2897) ждётся, если ещё грузится; до первого
        // самостоятельного вопроса её заголовок — опора уточнений («Что рядом?»).
        const pinned = sourceLoadRef.current ? await sourceLoadRef.current : null
        const previousAnchor = lastSearchQueryRef.current
        const searchQuery = buildRetrievalQuery(question, previousAnchor ?? pinned?.title ?? null)
        if (searchQuery === question) lastSearchQueryRef.current = question
        try {
          sources = await searchSiteMaterials({ query: searchQuery, locale, signal: controller.signal })
        } catch {
          sources = []
        }
        // Одна цепочка порядка со службой (#3289): место → условия → превосходная степень; не прошедшие
        // отбор карточки встают группой «Ещё по теме». У закреплённой страницы карточки уже выбраны.
        const arrangement = pinned ? null : arrangeSources(searchQuery, sources)
        sources = arrangement ? arrangement.sources : pinSourceFirst(pinned, sources)
        if (controller.signal.aborted) {
          patchTurn(id, { status: 'aborted' })
          return
        }
        if (!sources.length) {
          patchTurn(id, { status: 'no_sources' })
          void logDemand({ q: question, locale, reason: 'no_sources' })
          await finishQuota()
          return
        }
        patchTurn(id, { sources, status: 'streaming' })
        if (!generator) {
          patchTurn(id, { status: 'unavailable' })
          void logDemand({ q: question, locale, reason: 'generator_unavailable' })
          return
        }

        // Место вопроса — по запросу подбора (#3315); у закреплённой страницы карточки уже выбраны.
        const messages = buildAssistantMessages({
          question,
          locale,
          sources,
          history,
          retrievalQuery: pinned ? null : searchQuery,
          arranged: true,
          noPlace: arrangement?.noPlace === true,
        })
        let pendingFull = ''
        const flush = () => {
          flushTimerRef.current = null
          const guarded = guardStreamingText(pendingFull, sources)
          patchTurn(id, { answer: guarded.text, removedLinks: guarded.removed })
        }
        const result = await generator.generate({
          messages,
          signal: controller.signal,
          maxRecommendations: AI_MAX_RECOMMENDATIONS,
          onDelta: (_delta, full) => {
            pendingFull = full
            if (!flushTimerRef.current) flushTimerRef.current = setTimeout(flush, STREAM_FLUSH_MS)
          },
        })
        clearFlush()
        const guarded = guardAnswer(result.text, sources, { question, retrievalQuery: searchQuery })
        const verdict = judgeModelReply(searchQuery, guarded.text, countKeptSourceLinks(guarded.text, sources))
        if (verdict === 'no_material') {
          // #3216: модель отказала вопросу с признаком поездки — это «материала нет», а не чужая тема.
          patchTurn(id, { status: 'no_sources', answer: '', sources: [], removedLinks: 0 })
          void logDemand({ q: question, locale, reason: 'no_sources' })
          await finishQuota()
          return
        }
        if (verdict === 'off_topic') {
          // Второй рубеж: фильтр пропустил, модель узнала чужую тему по правилу промпта.
          // Вопрос не по теме опорой уточнений не становится. В эскалацию такой отказ не идёт:
          // модель ошибается и на вопросах о поездке («travel hacks», просьба о чужой ссылке —
          // замер #2710), и блок до завтра за её ошибку получил бы посетитель.
          lastSearchQueryRef.current = previousAnchor
          patchTurn(id, { status: 'off_topic', answer: '', sources: [], removedLinks: 0, offTopicStrikes: null })
          await finishQuota()
          return
        }
        // Пустой ответ (#3291): текста нет, карточка хода покажет запасную фразу и источники.
        patchTurn(id, { answer: guarded.fallback ? '' : guarded.text, removedLinks: guarded.removed, status: 'done', usage: result.usage, fallback: guarded.fallback })
        if (__DEV__) {
          console.info('[ai-assist] usage', { ...result.usage, removedLinks: guarded.removed, sources: sources.length })
        }
        await finishQuota()
      } catch (error) {
        clearFlush()
        if (isAiGeneratorError(error)) {
          if (error.kind === 'aborted') {
            patchTurn(id, { status: 'aborted' })
          } else if (error.kind === 'busy') {
            patchTurn(id, { status: 'busy', retryAfterSec: error.retryAfterSec })
          } else {
            patchTurn(id, { status: 'unavailable' })
            void logDemand({ q: question, locale, reason: 'generator_unavailable' })
          }
        } else if (controller.signal.aborted) {
          patchTurn(id, { status: 'aborted' })
        } else {
          patchTurn(id, { status: 'error' })
        }
      }
    },
    [clearFlush, finishOffTopic, finishQuota, locale, patchTurn],
  )

  const ask = useCallback(
    async (rawQuestion: string): Promise<void> => {
      const question = String(rawQuestion ?? '').replace(/\s+/g, ' ').trim()
      if (!question || abortRef.current) return
      if (question.length > MAX_QUESTION_LENGTH) {
        setInputError('tooLong')
        return
      }
      // Занимаем очередь синхронно: `busy` поднимется только после чтения
      // лимита, и двойное нажатие успело бы запустить второй вопрос, который
      // перетёр бы `abortRef` (кнопка «Остановить» отменяла бы чужой запрос).
      const controller = new AbortController()
      abortRef.current = controller
      if (await readBlocked()) {
        abortRef.current = null
        updateOffTopicBlocked(true)
        setInputError('offTopicBlocked')
        return
      }
      if ((await readRemaining()) <= 0) {
        abortRef.current = null
        updateRemaining(0)
        setInputError('limit')
        return
      }
      setInputError(null)

      const id = makeTurnId()
      setActiveTurnId(id)
      const history = buildHistoryFromTurns(turnsRef.current)
      commitTurns((prev) => [
        ...prev,
        { id, question, answer: '', sources: [], status: 'searching', removedLinks: 0, retryAfterSec: null, usage: null, offTopicStrikes: null },
      ])

      try {
        if (provider.kind === 'ask') await askViaServer(provider.client, id, question, controller, history)
        else await askViaLlamaCpp(provider.generator, id, question, controller, history)
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        if (mountedRef.current) setActiveTurnId((current) => (current === id ? null : current))
      }
    },
    [askViaLlamaCpp, askViaServer, commitTurns, provider, readBlocked, readRemaining, updateOffTopicBlocked, updateRemaining],
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
      const left = await readRemaining()
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

  const clearInputError = useCallback(() => setInputError(null), [])

  return {
    turns,
    sourceRef,
    sourceCard,
    remaining,
    offTopicBlocked,
    inputError,
    busy: activeTurnId !== null,
    /** У `ask` служба всегда настроена (same-origin); у `llamacpp` — задан ли адрес модели. */
    generatorConfigured: provider.kind === 'ask' || provider.generator !== null,
    ask,
    stop,
    retry,
    clearInputError,
  }
}

export type AssistantChat = ReturnType<typeof useAssistantChat>
