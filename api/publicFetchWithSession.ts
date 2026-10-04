// Публичное чтение с сессией (#2134, #2165).
//
// Статьи, гео-выдача карты, кластеры, near-route и каталог мест — публичные
// эндпоинты, но бэк режет в них контент заблокированных авторов по тому, КТО
// спрашивает (#2130, #2164). Без сессии вошедший получает гостевой ответ, и
// заблокированный автор остаётся на экране. Поэтому такие запросы идут с
// сессией: native — `Authorization: Token`, web — cookie (`credentials`) и для
// небезопасных методов `X-CSRFToken`. Кэш бэка варьируется по `Authorization` и
// `Cookie` (`vary_on_headers` в `travels/views_geo.py`), так что гость и
// вошедший получают каждый свой ответ.
//
// 401 на публичном чтении — устаревший токен (бэк так отвечает на плохой
// заголовок): запрос повторяется один раз без сессии, токен не трогаем — как у
// детали путешествия (`api/travelDetailsQueries.ts`).
// Обёртка над сырым fetch, а не `apiClient`: вызывающие читают `Response`
// (304 с ETag, 404, офлайн-ветки).

import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { getSecureItem } from '@/utils/secureStorage'
import { getCsrfHeader } from '@/utils/csrf'
import {
  ACCESS_TOKEN_STORAGE_KEY,
  getApiRequestCredentials,
  shouldUseStoredAuthToken,
} from '@/utils/authPlatform'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const plainHeaders = (headers: RequestInit['headers']): Record<string, string> => {
  if (!headers) return {}
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    const out: Record<string, string> = {}
    headers.forEach((value, key) => {
      out[key] = value
    })
    return out
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return { ...(headers as Record<string, string>) }
}

export async function fetchPublicWithSession(
  url: string,
  init: RequestInit = {},
  timeoutMs: number,
): Promise<Response> {
  const token = shouldUseStoredAuthToken()
    ? await getSecureItem(ACCESS_TOKEN_STORAGE_KEY).catch(() => null)
    : null
  const baseHeaders = plainHeaders(init.headers)
  const unsafe = !SAFE_METHODS.has(String(init.method || 'GET').toUpperCase())
  const sessionHeaders: Record<string, string> = {
    ...baseHeaders,
    ...(unsafe ? getCsrfHeader() : {}),
    ...(token ? { Authorization: `Token ${token}` } : {}),
  }
  const response = await fetchWithTimeout(
    url,
    {
      ...init,
      ...getApiRequestCredentials(),
      ...(Object.keys(sessionHeaders).length ? { headers: sessionHeaders } : {}),
    },
    timeoutMs,
  )
  if (response.status !== 401) return response
  return fetchWithTimeout(
    url,
    {
      ...init,
      ...getApiRequestCredentials(true),
      ...(Object.keys(baseHeaders).length ? { headers: baseHeaders } : {}),
    },
    timeoutMs,
  )
}
