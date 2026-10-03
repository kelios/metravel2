import { Platform } from 'react-native'
import { router } from 'expo-router'

import { openExternalUrl } from '@/utils/externalLinks'
import { resolveSitePath } from '@/utils/siteLinks'

/**
 * Если ссылка ведёт на наш сайт (относительный путь или абсолютный URL на metravel.by),
 * возвращает внутренний путь (pathname+search+hash) для навигации внутри приложения.
 * Иначе — `null` (ссылка внешняя). Разбор хоста — единый `resolveSitePath`.
 */
export function resolveInternalHref(href?: string | null): string | null {
  return resolveSitePath(href)
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
