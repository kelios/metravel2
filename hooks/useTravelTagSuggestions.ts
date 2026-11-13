/**
 * React Query поверх `api/aiTagSuggestions` (#2886): подсказка стран, категорий, транспорта,
 * компаньонов и ночёвок по тексту описания на шаге «Дополнительно» визарда статьи.
 * Один запрос без ретраев, час в кэше (как `useAiPicks`): при отказе блок исчезает.
 * Запрос уходит только когда включён `EXPO_PUBLIC_AI_PICKS`, текст не короче
 * `AI_TAG_SUGGEST_MIN_TEXT_CHARS` и вызывающий компонент смонтирован на шаге (`enabled`).
 * Ключ кэша — отпечаток текста (длина + хэш), а не сам текст: описание статьи — тысячи знаков.
 */
import { useQuery } from '@tanstack/react-query'

import { AI_TAG_SUGGEST_MIN_TEXT_CHARS } from '@/constants/aiFormPolicy'
import { fetchAiTagSuggestions, normalizeTagSuggestionText } from '@/api/aiTagSuggestions'
import { queryKeys } from '@/api/queryKeys'
import { getActiveLocale } from '@/i18n'
import { isAiPicksEnabled } from '@/utils/aiPicksConfig'

const HOUR_MS = 60 * 60 * 1000

/** Отпечаток текста для ключа запроса: FNV-1a 32 бит плюс длина. */
export const tagSuggestionTextKey = (text: string): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${text.length}:${hash.toString(16)}`
}

export interface UseTravelTagSuggestionsOptions {
  /** Компонент на шаге «Дополнительно»; на других шагах запрос не нужен. */
  enabled?: boolean
}

export function useTravelTagSuggestions(plainText: string, { enabled = true }: UseTravelTagSuggestionsOptions = {}) {
  const locale = getActiveLocale()
  const text = normalizeTagSuggestionText(plainText)
  const ready = text.length >= AI_TAG_SUGGEST_MIN_TEXT_CHARS
  return useQuery({
    queryKey: queryKeys.aiTagSuggestions(tagSuggestionTextKey(text), locale),
    queryFn: ({ signal }) => fetchAiTagSuggestions({ text, locale, signal }),
    enabled: enabled && isAiPicksEnabled() && ready,
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })
}
