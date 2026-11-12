/**
 * Контракты ассистента сайта (#2460). Клиентская часть пайплайна
 * «подбор карточек → промпт → metravel-llm → страж ссылок»; серверный
 * `/ai/ask` (#2456) повторит те же формы.
 */

import type { SourceFacts } from './sourceFacts.ts'

export type AiSourceType = 'travel' | 'quest'

/**
 * Вид карточки ассистента: материал сайта либо справка о самом сайте (#3293). Справочная карточка —
 * запись корпуса `scripts/ai-index/sources/help/`: заголовок — вопрос, фрагмент — утверждённый ответ,
 * адрес — страница сайта, к которой ответ относится. Приходит только от службы `/ai/ask`.
 */
export type AiCardType = AiSourceType | 'help'

/**
 * Группа карточки в событии `sources` потока `/ai/ask` и на экране — одно поле для режима страницы
 * (#3290) и отбора по условиям вопроса (#3289):
 *   - `page` — страница, с которой открыт ассистент: вопрос отвечается только по ней;
 *   - `match` — карточка прошла отбор по месту и условиям вопроса (`sourceSelection.ts`);
 *   - `nearby` — материал рядом по теме: в подсказку модели не идёт, под ответом стоит отдельной
 *     группой «Ещё по теме».
 * Карточка без группы — обычный подбор.
 */
export const AI_SOURCE_GROUPS = ['page', 'match', 'nearby'] as const
export type AiSourceGroup = (typeof AI_SOURCE_GROUPS)[number]

/** Карточка материала сайта, найденная подбором; единственный источник ссылок в ответе. */
export type AiSource = {
  type: AiCardType
  source_id: string
  title: string
  /** Абсолютный URL страницы на сайте — ровно так он попадает в промпт. */
  url: string
  /** Путь для навигации внутри приложения. */
  path: string
  /** Текстовый фрагмент карточки для промпта (данные, не инструкции). */
  snippet: string
  score: number
  /**
   * Место материала для отбора карточек подсказки (#3315, `promptPlace.ts`): названия города на всех
   * известных написаниях и страны. У квеста город — из каталога; у статьи заполняется только страна.
   * Служебное поле: в подсказку и в поток `/ai/ask` не попадает.
   */
  place?: AiSourcePlace
  /** Группа карточки (#3290, #3289); уходит посетителю в событии `sources`. */
  group?: AiSourceGroup
  /**
   * Запись фактов каталога (#3287) для проверки условий вопроса (#3289, `questionConditions.ts`).
   * Служебное поле, как `place`: в поток `/ai/ask` не попадает.
   */
  facts?: SourceFacts | null
  /**
   * Совпавшие условия вопроса одной фразой («детский, 8–10 лет, 75 мин») — строка «Почему подходит»
   * карточки подсказки (#3289). Ставит `arrangeSources`; посетителю не уходит.
   */
  why?: string
}

export type AiSourcePlace = {
  cities?: ReadonlyArray<string | null | undefined>
  countries?: ReadonlyArray<string | null | undefined>
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
