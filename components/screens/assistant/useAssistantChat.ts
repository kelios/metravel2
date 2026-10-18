/**
 * Состояние диалога ассистента (#2460): один вопрос за раз, пайплайн
 * «подбор карточек → промпт → metravel-llm → страж ссылок», дневной лимит и
 * журнал спроса. Экран только рисует `turns` и зовёт `ask/stop/retry`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { logDemand } from '@/api/aiAssist/demandLog'
import { createGenerator, isAiGeneratorError, type Generator } from '@/api/aiAssist/generator'
import { consumeQuestion, readRemainingQuestions } from '@/api/aiAssist/limits'
import { enforceSourceLinks } from '@/api/aiAssist/linkGuard'
import { MAX_QUESTION_LENGTH, buildAssistantMessages } from '@/api/aiAssist/prompt'
import { searchSiteMaterials } from '@/api/aiAssist/retrieval'
import type { AiHistoryItem, AiSource, AiUsage } from '@/api/aiAssist/types'
import { getAiAssistantBaseUrl } from '@/utils/aiAssistantConfig'

export type AssistantTurnStatus =
  | 'searching'
  | 'streaming'
  | 'done'
  | 'no_sources'
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
}

export type AssistantInputError = 'tooLong' | 'limit' | null

export type UseAssistantChatOptions = {
  locale: string
  generator?: Generator | null
}

const STREAM_FLUSH_MS = 40
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

/**
 * Текст для показа во время стрима: страж ссылок по готовой части, незаконченный
 * «хвост», похожий на адрес, придерживается до следующего фрагмента — иначе
 * допустимая ссылка мигает, пока модель её дописывает.
 */
export const guardStreamingText = (full: string, sources: readonly AiSource[]): { text: string; removed: number } => {
  const cut = Math.max(full.lastIndexOf(' '), full.lastIndexOf('\n'))
  const head = cut >= 0 ? full.slice(0, cut + 1) : ''
  const tail = cut >= 0 ? full.slice(cut + 1) : full
  const tailLooksLikeLink = /^(?:https?:|\/|www\.|metravel|\[|\()/i.test(tail)
  const guarded = enforceSourceLinks(tailLooksLikeLink ? head : full, sources)
  return guarded
}

export function useAssistantChat({ locale, generator: generatorOverride }: UseAssistantChatOptions) {
  const [turns, setTurns] = useState<AssistantTurn[]>([])
  const [remaining, setRemaining] = useState<number | null>(null)
  const [inputError, setInputError] = useState<AssistantInputError>(null)
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null)
  const turnsRef = useRef<AssistantTurn[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const generator = useMemo<Generator | null>(
    () => (generatorOverride !== undefined ? generatorOverride : createGenerator(getAiAssistantBaseUrl())),
    [generatorOverride],
  )

  useEffect(() => {
    mountedRef.current = true
    void readRemainingQuestions().then((left) => {
      if (mountedRef.current) setRemaining(left)
    })
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    }
  }, [])

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

  const finishQuota = useCallback(async () => {
    const left = await consumeQuestion()
    if (mountedRef.current) setRemaining(left)
  }, [])

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
      const left = await readRemainingQuestions()
      if (left <= 0) {
        abortRef.current = null
        setRemaining(0)
        setInputError('limit')
        return
      }
      setInputError(null)

      const id = makeTurnId()
      setActiveTurnId(id)
      const history = buildHistoryFromTurns(turnsRef.current)
      commitTurns((prev) => [
        ...prev,
        { id, question, answer: '', sources: [], status: 'searching', removedLinks: 0, retryAfterSec: null, usage: null },
      ])

      try {
        let sources: AiSource[] = []
        try {
          sources = await searchSiteMaterials({ query: question, locale, signal: controller.signal })
        } catch {
          sources = []
        }
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

        const messages = buildAssistantMessages({ question, locale, sources, history })
        let pendingFull = ''
        const flush = () => {
          flushTimerRef.current = null
          const guarded = guardStreamingText(pendingFull, sources)
          patchTurn(id, { answer: guarded.text, removedLinks: guarded.removed })
        }
        const result = await generator.generate({
          messages,
          signal: controller.signal,
          onDelta: (_delta, full) => {
            pendingFull = full
            if (!flushTimerRef.current) flushTimerRef.current = setTimeout(flush, STREAM_FLUSH_MS)
          },
        })
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current)
          flushTimerRef.current = null
        }
        const guarded = enforceSourceLinks(result.text, sources)
        patchTurn(id, { answer: guarded.text, removedLinks: guarded.removed, status: 'done', usage: result.usage })
        if (__DEV__) {
          console.info('[ai-assist] usage', { ...result.usage, removedLinks: guarded.removed, sources: sources.length })
        }
        await finishQuota()
      } catch (error) {
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current)
          flushTimerRef.current = null
        }
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
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        if (mountedRef.current) setActiveTurnId((current) => (current === id ? null : current))
      }
    },
    [commitTurns, finishQuota, generator, locale, patchTurn],
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
      const left = await readRemainingQuestions()
      if (left <= 0 || abortRef.current) {
        if (left <= 0) {
          setRemaining(0)
          setInputError('limit')
        }
        return
      }
      commitTurns((prev) => prev.filter((item) => item.id !== turnId))
      await ask(turn.question)
    },
    [ask, commitTurns],
  )

  const clearInputError = useCallback(() => setInputError(null), [])

  return {
    turns,
    remaining,
    inputError,
    busy: activeTurnId !== null,
    generatorConfigured: generator !== null,
    ask,
    stop,
    retry,
    clearInputError,
  }
}

export type AssistantChat = ReturnType<typeof useAssistantChat>
