import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

/**
 * Насколько экранная клавиатура мобильного браузера перекрывает низ страницы (px).
 *
 * Зачем: на mobile web клавиатура НЕ сжимает layout viewport (Chrome Android по
 * умолчанию `interactive-widget=resizes-visual`, Safari ведёт себя так же) —
 * уменьшается только visual viewport. Элемент, прижатый к низу экрана (композер
 * чата), остаётся на дне layout viewport, то есть под клавиатурой. Реальное
 * перекрытие видно только через `visualViewport`.
 *
 * Порог нужен, чтобы не реагировать на сворачивание адресной строки браузера:
 * оно тоже меняет visual viewport, но на заметно меньшую высоту, чем клавиатура.
 */
const MIN_KEYBOARD_OVERLAP = 120

/**
 * CSS-переменная с тем же значением. Нужна, потому что на mobile web композер
 * чата получает `padding-bottom` из `!important`-правила в app/global.css
 * (резерв под safe-area и нижний хром браузера) — inline-стиль React Native Web
 * его не перебивает, поэтому клавиатурный отступ приезжает через переменную.
 */
export const KEYBOARD_INSET_CSS_VAR = '--mt-keyboard-inset'

function readOverlap(): number {
  if (typeof window === 'undefined') return 0
  const vv = window.visualViewport
  if (!vv) return 0
  const overlap = window.innerHeight - vv.height - vv.offsetTop
  if (!Number.isFinite(overlap) || overlap < MIN_KEYBOARD_OVERLAP) return 0
  return Math.round(overlap)
}

/** Web-only: на native всегда 0 (там высота клавиатуры приходит из `Keyboard`). */
export function useWebKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return

    let rafId: number | null = null

    const apply = () => {
      const overlap = readOverlap()
      setInset(overlap)
      document.documentElement?.style.setProperty(KEYBOARD_INSET_CSS_VAR, `${overlap}px`)
    }
    const schedule = () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(apply)
    }

    apply()

    try {
      vv.addEventListener('resize', schedule)
      vv.addEventListener('scroll', schedule)
    } catch {
      // noop
    }

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      try {
        vv.removeEventListener('resize', schedule)
        vv.removeEventListener('scroll', schedule)
      } catch {
        // noop
      }
      // Экран ушёл — переменная не должна «держать» отступ для остальных страниц.
      document.documentElement?.style.setProperty(KEYBOARD_INSET_CSS_VAR, '0px')
    }
  }, [])

  return inset
}
