/**
 * Состояние запроса к `POST /ai/author-draft` (#2885, #2911): idle → loading → variants |
 * limit (429 limit) | unavailable (503, сеть, таймаут). Один запрос за раз — новый
 * отменяет предыдущий, размонтирование отменяет текущий. Общий для «Помощника автора»
 * в визарде статьи (`AuthorAssistantPanel`) и «Черновика описания» поездки
 * (`TripDescriptionDraftPanel`); модуль живёт под `EXPO_PUBLIC_AI_ASSISTANT`, его
 * тянут только отложенные чанки панелей (#2738).
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import type { AiAuthorDraftKind } from '@/constants/aiFormPolicy'
import { getActiveLocale } from '@/i18n'
import { getAiPicksBaseUrl } from '@/utils/aiPicksConfig'

export type AuthorDraftState =
  | { status: 'idle' }
  | { status: 'loading'; kind: AiAuthorDraftKind }
  | { status: 'variants'; kind: AiAuthorDraftKind; variants: string[]; remaining: number | null }
  | { status: 'limit' }
  | { status: 'unavailable' }

export function useAuthorDraft(text: string) {
  const [state, setState] = useState<AuthorDraftState>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const suggest = useCallback(
    async (kind: AiAuthorDraftKind) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setState({ status: 'loading', kind })
      let authorDraft: typeof import('@/api/aiAssist/authorDraft') | null = null
      try {
        authorDraft = process.env.EXPO_PUBLIC_AI_ASSISTANT ? await import('@/api/aiAssist/authorDraft') : null
        if (controller.signal.aborted) return
        if (!authorDraft) {
          setState({ status: 'idle' })
          return
        }
        const result = await authorDraft.requestAuthorDraft({ baseUrl: getAiPicksBaseUrl(), text, kind, locale: getActiveLocale(), signal: controller.signal })
        if (controller.signal.aborted) return
        setState({ status: 'variants', kind, variants: result.variants, remaining: result.remaining })
      } catch (error) {
        if (controller.signal.aborted) return
        setState({ status: authorDraft?.isAuthorDraftError(error) && error.kind === 'limit' ? 'limit' : 'unavailable' })
      }
    },
    [text],
  )

  return { state, suggest, loading: state.status === 'loading' }
}
