import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe'

import { BOTTOM_DOCK_HEIGHT } from './bottomDockModel'

/**
 * Единственный резерв под плавающим нижним доком и плашками (#2097).
 *
 * На web высота приходит из CSS (`--mt-dock-h` / `--mt-consent-h`): на desktop
 * док-переменная 0px, поэтому формула не растит отступ страницы. На native
 * провайдер отдаёт измеренную высоту дока (она уже включает safe-area).
 * Пока замера нет — фолбэк `BOTTOM_DOCK_HEIGHT + insets.bottom`.
 * `measuredHeight === 0` значит, что док скрыт (десктоп или экран без дока).
 *
 * Корневой web-спейсер 56px убран: он был вторым определением той же высоты
 * и удваивал отступ там, где экран считал док ещё раз. Один механизм на обеих
 * платформах — этот хук.
 */

export const WEB_BOTTOM_CHROME_INSET =
  'calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px)))'

const BottomChromeInsetContext = createContext<number | null>(null)

export function webBottomChromeInset(extra = 0): string {
  if (!extra) return WEB_BOTTOM_CHROME_INSET
  return `calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px)) + ${extra}px)`
}

export function addBottomChrome(bottom: number | string, extra = 0): number | string {
  if (typeof bottom === 'string') return webBottomChromeInset(extra)
  return bottom + extra
}

export function BottomChromeInsetProvider({
  measuredHeight,
  children,
}: {
  measuredHeight: number | null
  children: ReactNode
}) {
  const value = useMemo(() => measuredHeight, [measuredHeight])
  return (
    <BottomChromeInsetContext.Provider value={value}>
      {children}
    </BottomChromeInsetContext.Provider>
  )
}

/**
 * Высота дока в пикселях для позиций самих плашек (consent, install), которым
 * нужна числовая величина, а не CSS max() с их собственным резервом.
 * Web: константа дока (safe-area уже внутри `--mt-dock-h`, insets.bottom = 0).
 * Native: измеренная высота, включая safe-area; 0 если док скрыт.
 */
export function useDockReservePx(): number {
  const measuredHeight = useContext(BottomChromeInsetContext)
  const insets = useSafeAreaInsetsSafe()

  if (Platform.OS === 'web') return BOTTOM_DOCK_HEIGHT
  if (measuredHeight === 0) return 0
  if (measuredHeight == null) {
    return BOTTOM_DOCK_HEIGHT + Math.max(0, insets.bottom || 0)
  }
  return measuredHeight
}

export function useBottomChromeInset(): { bottom: number | string } {
  const measuredHeight = useContext(BottomChromeInsetContext)
  const insets = useSafeAreaInsetsSafe()

  if (Platform.OS === 'web') {
    return { bottom: WEB_BOTTOM_CHROME_INSET }
  }

  if (measuredHeight === 0) return { bottom: 0 }

  const bottom = measuredHeight == null
    ? BOTTOM_DOCK_HEIGHT + Math.max(0, insets.bottom || 0)
    : measuredHeight

  return { bottom }
}

/**
 * RN `DimensionValue` не принимает произвольную string, а web-резерв — `calc()`.
 * Тот же приём, что у прежних `'calc(...)' as unknown as number`.
 */
export function asBottomDimension(value: number | string): number {
  return value as unknown as number
}

/** Готовый `paddingBottom` / высота пустого резерва: док плюс дополнительный зазор. */
export function useScrollBottomPadding(extra = 0): number | string {
  const { bottom } = useBottomChromeInset()
  return addBottomChrome(bottom, extra)
}
