import { Platform } from 'react-native'
import { router } from 'expo-router'

import { openExternalUrl } from '@/utils/externalLinks'
import { getSiteBaseUrl } from '@/utils/seo'

const baseHost = (() => {
  const match = /^https?:\/\/([^/?#]+)/i.exec(getSiteBaseUrl())
  return (match?.[1] || 'metravel.by').toLowerCase()
})()
const bareHost = baseHost.replace(/^www\./, '')
const INTERNAL_HOSTS = new Set([baseHost, bareHost, `www.${bareHost}`])

/**
 * Если ссылка ведёт на наш сайт (относительный путь или абсолютный URL на metravel.by),
 * возвращает внутренний путь (pathname+search+hash) для навигации внутри приложения.
 * Иначе — `null` (ссылка внешняя). Парсинг строковый, без зависимости от URL-полифилла.
 */
export function resolveInternalHref(href?: string | null): string | null {
  if (!href) return null
  let trimmed = href.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  // react-native-render-html нормализует относительные href как `about:///path`
  // (нет baseUrl) — разворачиваем обратно в относительный путь
  const aboutMatch = /^about:\/\/(\/.*)$/i.exec(trimmed)
  if (aboutMatch) trimmed = aboutMatch[1]
  // спец-схемы (почта/телефон/и т.п.) — это не внутренняя навигация
  if (/^(mailto:|tel:|sms:|geo:|tg:|whatsapp:|javascript:|data:)/i.test(trimmed)) return null

  // относительная ссылка на свой сайт (но не protocol-relative `//host`)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed

  const match = /^https?:\/\/([^/?#]+)(.*)$/i.exec(trimmed)
  if (!match) return null
  const host = match[1].toLowerCase()
  if (!INTERNAL_HOSTS.has(host)) return null
  const rest = match[2] || '/'
  return rest.startsWith('/') ? rest : `/${rest}`
}

/**
 * Единый обработчик клика по ссылке в rich-тексте (статьи, путешествия).
 * Внутренние ссылки открываются внутри приложения (expo-router на native,
 * обычная навигация на web), внешние — во внешнем браузере.
 */
export function handleRichTextLinkPress(href?: string | null): void {
  if (!href) return
  const internal = resolveInternalHref(href)
  if (internal) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(internal)
    } else {
      router.push(internal as never)
    }
    return
  }
  if (/^https?:\/\//i.test(href.trim())) {
    void openExternalUrl(href, {
      onError: (error) => {
        if (__DEV__) {
          console.warn('[richtext] Не удалось открыть URL:', error)
        }
      },
    })
  }
}
