import type { ServerRichTextBlock } from '@/types/types'

import { toInertHtml, type InertHtml } from '@/utils/inertHtml'

// #710/#709: серверный canonical rich-text (rich_text.*.safe_html).
// Бэкенд уже санитизировал этот HTML, поэтому полный клиентский pipeline
// (normalizeArticleEditorHtmlForInput + sanitize-html) для него не запускается.
// Серверу слепо не доверяем: строка проходит тот же разбор, что и последний рубеж
// перед стоком (#3202) — регулярная копия этой проверки пропускала `/onerror`.
export const guardServerSafeHtml = (html: string): InertHtml => toInertHtml(html)

export type ResolvedRichTextHtml = {
  html: string
  /** true — html пришёл как canonical safe_html с бэка (#709) */
  serverSanitized: boolean
}

// Выбор источника HTML для рендера: серверный safe_html, если он есть и непустой,
// иначе legacy-поле (старый payload) с полным клиентским pipeline.
export const resolveServerRichTextHtml = (
  block: ServerRichTextBlock | null | undefined,
  fallbackHtml: string | null | undefined,
): ResolvedRichTextHtml => {
  const safeHtml = typeof block?.safe_html === 'string' ? block.safe_html : ''

  // #1769: origin/master `e2290d4` сохраняет `<details>`/`<summary>`/`<section class="seo-faq">`
  // в canonical `safe_html`. Обход «если сервер схлопнул FAQ — взять legacy description»
  // больше не нужен и прятал бы каноническое поле.
  if (safeHtml.trim()) {
    return { html: safeHtml, serverSanitized: true }
  }
  return { html: fallbackHtml ?? '', serverSanitized: false }
}
