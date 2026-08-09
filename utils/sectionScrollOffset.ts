/**
 * Единый источник правды для вертикального смещения секций под липкой шапкой.
 *
 * Прокрутка к секции (`useScrollNavigation`) и подсветка активного пункта меню
 * (`useActiveSection`) обязаны считать это смещение одинаково. Пока они считали
 * его независимо, клик по боковому меню travel-details парковал секцию на 88px
 * ниже верха скролл-контейнера (прокрутка не находила `<header>` — RNW рендерит
 * `View` как `div` — и уходила в fallback 88px), а «линия чтения» scrollspy
 * стояла на 24px. Под линией оказывалась предыдущая секция, поэтому клик по
 * «Плюсам» подсвечивал «Рекомендации», по «Минусам» — «Плюсы» и так далее.
 */

import { Platform } from 'react-native'

/**
 * RNW рендерит `View` как `div`, поэтому `document.querySelector('header')`
 * всегда возвращает null. `data-testid` шапки — единственный стабильный
 * селектор: на него же опираются critical CSS и e2e.
 */
const STICKY_HEADER_SELECTORS = [
  '[data-testid="main-header"]',
  'header',
  '[role="banner"]',
] as const

/** Запас под шапкой, на котором scrollspy держит «линию чтения». */
export const SECTION_READING_LINE_BUFFER_PX = 24

/** Fallback, когда шапку измерить нельзя (native, SSR, тесты). */
export const DEFAULT_STICKY_HEADER_HEIGHT = 72

const MAX_STICKY_HEADER_HEIGHT = 200

const clampHeaderSize = (value: number): number =>
  Math.max(0, Math.min(MAX_STICKY_HEADER_HEIGHT, Math.round(value)))

/** Скроллит ли переданный узел документ целиком (а не вложенный контейнер). */
export function isDocumentScrollContainer(node: unknown): boolean {
  if (typeof document === 'undefined') return true
  if (!node) return true
  const scrollingEl = document.scrollingElement || document.documentElement || document.body
  return (
    (typeof window !== 'undefined' && node === window) ||
    node === document ||
    node === document.body ||
    node === document.documentElement ||
    node === scrollingEl
  )
}

/**
 * Нижняя граница липкой шапки в координатах вьюпорта. Шапка `position: sticky`
 * прижата к верху, поэтому это же её видимая высота; если шапки нет или она
 * уехала вверх — 0.
 */
export function resolveStickyHeaderBottom(
  fallbackHeight: number = DEFAULT_STICKY_HEADER_HEIGHT,
): number {
  const fallback = clampHeaderSize(fallbackHeight)
  if (Platform.OS !== 'web' || typeof document === 'undefined') return fallback

  for (const selector of STICKY_HEADER_SELECTORS) {
    try {
      const el = document.querySelector(selector)
      const bottom = el?.getBoundingClientRect?.().bottom
      if (typeof bottom === 'number' && Number.isFinite(bottom)) {
        return clampHeaderSize(bottom)
      }
    } catch {
      // noop
    }
  }

  return fallback
}

/**
 * На сколько пикселей верх скролл-контейнера перекрыт липкой шапкой. Это и
 * целевое смещение при прокрутке к секции, и точка отсчёта «линии чтения»
 * scrollspy. Для контейнера, который сам начинается под шапкой, смещение нулевое.
 */
export function resolveSectionScrollOffset(
  container: unknown,
  fallbackHeaderHeight: number = DEFAULT_STICKY_HEADER_HEIGHT,
): number {
  const headerBottom = resolveStickyHeaderBottom(fallbackHeaderHeight)
  if (isDocumentScrollContainer(container)) return headerBottom

  try {
    const rect = (container as HTMLElement).getBoundingClientRect?.()
    const top = Number(rect?.top ?? 0)
    if (!Number.isFinite(top)) return headerBottom
    return Math.max(0, Math.round(headerBottom - top))
  } catch {
    return headerBottom
  }
}
