/**
 * Чем экран ассистента подтверждает личность вопроса для службы `POST /ai/ask` (#3354).
 *
 * Идентификатор пользователя клиент службе не передаёт — ни в теле, ни в заголовке: кто спрашивает, служба
 * узнаёт сама у API сайта по токену сессии. Отсюда уходит только сам токен, тем же способом, каким его
 * получает API:
 *   - web — токен лежит в HttpOnly-cookie сайта и скрипту страницы недоступен. Запрос к `/ai/ask` того же
 *     origin несёт cookie сам; здесь это названо явно (`credentials: 'same-origin'`). На другой origin
 *     (служба по отдельному адресу) cookie не уходит — вопрос идёт как у гостя;
 *   - приложения — заголовок `Authorization: Token …` из защищённого хранилища, и только когда служба
 *     ассистента живёт на том же origin, что и API сайта: адрес из переменной сборки для стенда токен не получает.
 *
 * Нет сессии — `null`: запрос уходит прежним, как у гостя.
 */
import { API_BASE_URL } from '@/api/apiConfig'
import { ACCESS_TOKEN_STORAGE_KEY, shouldUseStoredAuthToken } from '@/utils/authPlatform'
import { getSecureItem } from '@/utils/secureStorage'

import type { AskAuth } from './askProvider'

const originOf = (value: string): string | null => {
  try {
    return new URL(value).origin.toLowerCase()
  } catch {
    return null
  }
}

/** Служба ассистента стоит на origin API сайта (`https://metravel.by` и `https://metravel.by/api`). */
export const isSiteAssistOrigin = (assistBaseUrl: string, apiBaseUrl: string = String(API_BASE_URL ?? '')): boolean => {
  const assist = originOf(assistBaseUrl)
  return assist !== null && assist === originOf(apiBaseUrl)
}

export async function resolveAskAuth(assistBaseUrl: string): Promise<AskAuth | null> {
  const baseUrl = String(assistBaseUrl ?? '').trim()
  if (!shouldUseStoredAuthToken()) return baseUrl === '' ? { credentials: 'same-origin' } : null
  if (!isSiteAssistOrigin(baseUrl)) return null
  const token = await getSecureItem(ACCESS_TOKEN_STORAGE_KEY)
  return token ? { headers: { Authorization: `Token ${token}` } } : null
}
