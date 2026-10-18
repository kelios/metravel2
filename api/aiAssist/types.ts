/**
 * Контракты ассистента сайта (#2460). Клиентская часть пайплайна
 * «подбор карточек → промпт → metravel-llm → страж ссылок»; серверный
 * `/ai/ask` (#2456) повторит те же формы.
 */

export type AiSourceType = 'travel' | 'quest'

/** Карточка материала сайта, найденная подбором; единственный источник ссылок в ответе. */
export type AiSource = {
  type: AiSourceType
  source_id: string
  title: string
  /** Абсолютный URL страницы на сайте — ровно так он попадает в промпт. */
  url: string
  /** Путь для навигации внутри приложения. */
  path: string
  /** Текстовый фрагмент карточки для промпта (данные, не инструкции). */
  snippet: string
  score: number
}

export type AiHistoryRole = 'user' | 'assistant'

export type AiHistoryItem = {
  role: AiHistoryRole
  text: string
}

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiUsage = {
  prompt_tokens: number | null
  completion_tokens: number | null
  /** Время до первого токена, мс. */
  ttft_ms: number
  tokens_per_s: number | null
}

export type AiGenerateResult = {
  text: string
  usage: AiUsage
}
