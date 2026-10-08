import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe'

import { BOTTOM_DOCK_HEIGHT } from './bottomDockItemDefs'

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

type NativeBottomChrome = {
  top: number | null
  register: (owner: string, top: number) => void
  release: (owner: string) => void
}

const NativeBottomChromeContext = createContext<NativeBottomChrome>({
  top: null,
  register: () => {},
  release: () => {},
})

/** Native overlays use window coordinates; scroll padding still reserves only the dock. */
export function useNativeBottomChromeOcclusion(): NativeBottomChrome {
  return useContext(NativeBottomChromeContext)
}

/** The dock itself must not include the banners' own --mt-consent-h reserve. */
export function webDockReserve(extra = 0): string {
  return `calc(var(--mt-dock-h, 0px) + ${extra}px)`
}

let webDockHeight = 0
const webDockListeners = new Set<() => void>()
let stopWebDockMeasurement: (() => void) | null = null

const subscribeWebDock = (listener: () => void): (() => void) => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return () => {}
  webDockListeners.add(listener)
  if (!stopWebDockMeasurement) {
    // Let the browser resolve calc()/env() rather than duplicating media-query,
    // route visibility or safe-area rules in JS. One shared probe for all callers.
    const probe = document.createElement('div')
    probe.setAttribute('data-mt-dock-measure', '')
    probe.style.cssText = 'position:fixed;width:0;visibility:hidden;pointer-events:none;'
    probe.style.height = 'var(--mt-dock-h, 0px)'
    const measure = () => {
      const next = Math.max(0, probe.getBoundingClientRect().height)
      if (next === webDockHeight) return
      webDockHeight = next
      webDockListeners.forEach((notify) => notify())
    }
    const body = document.body
    body.appendChild(probe)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resizeObserver?.observe(probe)
    const containsDockMarker = (node: Node) => node instanceof Element &&
      (node.matches('[data-mt-dock]') || node.querySelector('[data-mt-dock]') !== null)
    const mutationObserver = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === 'attributes' ||
        [...mutation.addedNodes, ...mutation.removedNodes].some(containsDockMarker))) measure()
    })
    mutationObserver.observe(body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-mt-dock'] })
    window.addEventListener('resize', measure)
    measure()
    stopWebDockMeasurement = () => {
      resizeObserver?.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', measure)
      probe.remove()
      webDockHeight = 0
    }
  }
  return () => {
    webDockListeners.delete(listener)
    if (webDockListeners.size === 0) {
      stopWebDockMeasurement?.()
      stopWebDockMeasurement = null
    }
  }
}

const getWebDockSnapshot = () => webDockHeight
const getServerDockSnapshot = () => 0

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
  const [tops, setTops] = useState<ReadonlyMap<string, number>>(() => new Map())
  const register = useCallback((owner: string, top: number) => {
    if (Platform.OS === 'web' || !Number.isFinite(top)) return
    setTops((current) => {
      if (current.get(owner) === top) return current
      return new Map(current).set(owner, top)
    })
  }, [])
  const release = useCallback((owner: string) => {
    setTops((current) => {
      if (!current.has(owner)) return current
      const next = new Map(current)
      next.delete(owner)
      return next
    })
  }, [])
  const occlusion = useMemo(() => ({
    top: tops.size ? Math.min(...tops.values()) : null,
    register,
    release,
  }), [tops, register, release])
  return (
    <BottomChromeInsetContext.Provider value={value}>
      <NativeBottomChromeContext.Provider value={occlusion}>
        {children}
      </NativeBottomChromeContext.Provider>
    </BottomChromeInsetContext.Provider>
  )
}

/**
 * Высота дока в пикселях для позиций самих плашек (consent, install), которым
 * нужна числовая величина, а не CSS max() с их собственным резервом.
 * Web: измерение того же CSS --mt-dock-h, включая calc/env и dock-off.
 * Native: измеренная высота, включая safe-area; 0 если док скрыт.
 */
export function useDockReservePx(): number {
  const measuredHeight = useContext(BottomChromeInsetContext)
  const insets = useSafeAreaInsetsSafe()
  const webHeight = useSyncExternalStore(subscribeWebDock, getWebDockSnapshot, getServerDockSnapshot)

  if (Platform.OS === 'web') return webHeight
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
