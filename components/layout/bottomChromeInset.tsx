import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { Platform } from 'react-native'

import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe'
import { getBottomChromeReserve, subscribeBottomChromeReserve } from '@/utils/bottomChromeReserve'

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
export { webDockReserve } from './webBottomChromeCss'

/**
 * #2788: постоянная нижняя полоса под плавающими плашками (consent, сеть,
 * тосты). На телефоне это док (`--mt-dock-h`), на desktop — подвал в потоке
 * корня (`--mt-footer-h`, публикует `useWebFooterHeightPublisher`). Док
 * накрывает контент, а подвал нет, поэтому `--mt-footer-h` не входит в
 * `webDockReserve` и резервы скроллеров — только в якорь плашек.
 */
const WEB_FOOTER_HEIGHT_VAR = '--mt-footer-h'
const WEB_FLOATING_ANCHOR = `max(var(--mt-dock-h, 0px), var(${WEB_FOOTER_HEIGHT_VAR}, 0px))`

export function webFloatingAnchor(extra = 0, minimum = 0): string {
  if (minimum > 0) return `calc(max(var(--mt-dock-h, 0px), var(${WEB_FOOTER_HEIGHT_VAR}, 0px), ${minimum}px) + ${extra}px)`
  return `calc(${WEB_FLOATING_ANCHOR} + ${extra}px)`
}

/** Desktop footer publishes its rendered height; display:none below the breakpoint gives 0. */
export function useWebFooterHeightPublisher(ref: RefObject<unknown>): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof ResizeObserver === 'undefined') return
    const node = ref.current
    if (!(node instanceof HTMLElement)) return
    const root = document.documentElement
    const publish = () => {
      const height = Math.round(node.getBoundingClientRect().height)
      if (height > 0) root.style.setProperty(WEB_FOOTER_HEIGHT_VAR, `${height}px`)
      else root.style.removeProperty(WEB_FOOTER_HEIGHT_VAR)
    }
    const observer = new ResizeObserver(publish)
    observer.observe(node)
    publish()
    return () => {
      observer.disconnect()
      root.style.removeProperty(WEB_FOOTER_HEIGHT_VAR)
    }
  }, [ref])
}

type WebHeightStore = { subscribe: (listener: () => void) => () => void; getSnapshot: () => number }

// Let the browser resolve calc()/env()/max() rather than duplicating media-query,
// route visibility or safe-area rules in JS. One shared probe per expression.
function createWebHeightStore(cssHeight: string, probeAttribute: string): WebHeightStore {
  let height = 0
  const listeners = new Set<() => void>()
  let stopMeasurement: (() => void) | null = null

  const subscribe = (listener: () => void): (() => void) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return () => {}
    listeners.add(listener)
    if (!stopMeasurement) {
      const probe = document.createElement('div')
      probe.setAttribute(probeAttribute, '')
      probe.style.cssText = 'position:fixed;width:0;visibility:hidden;pointer-events:none;'
      probe.style.height = cssHeight
      const measure = () => {
        const next = Math.max(0, probe.getBoundingClientRect().height)
        if (next === height) return
        height = next
        listeners.forEach((notify) => notify())
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
      stopMeasurement = () => {
        resizeObserver?.disconnect()
        mutationObserver.disconnect()
        window.removeEventListener('resize', measure)
        probe.remove()
        height = 0
      }
    }
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        stopMeasurement?.()
        stopMeasurement = null
      }
    }
  }

  return { subscribe, getSnapshot: () => height }
}

const webDockStore = createWebHeightStore('var(--mt-dock-h, 0px)', 'data-mt-dock-measure')
const webFloatingAnchorStore = createWebHeightStore(WEB_FLOATING_ANCHOR, 'data-mt-floating-anchor-measure')
const getServerDockSnapshot = () => 0
const subscribeNoop = () => () => {}

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
  const webHeight = useSyncExternalStore(webDockStore.subscribe, webDockStore.getSnapshot, getServerDockSnapshot)

  if (Platform.OS === 'web') return webHeight
  if (measuredHeight === 0) return 0
  if (measuredHeight == null) {
    return BOTTOM_DOCK_HEIGHT + Math.max(0, insets.bottom || 0)
  }
  return measuredHeight
}

/**
 * Числовой якорь плавающих плашек: на web — измеренный `webFloatingAnchor()`
 * (док или desktop-подвал), на native — высота дока.
 */
export function useFloatingAnchorPx(): number {
  const dock = useDockReservePx()
  const webAnchor = useSyncExternalStore(webFloatingAnchorStore.subscribe, webFloatingAnchorStore.getSnapshot, getServerDockSnapshot)
  return Platform.OS === 'web' ? webAnchor : dock
}

/** Content/reveal consumers include all web notices; banner positioning uses dock-only reserves. */
export function useBottomChromeReservePx(): number {
  const dock = useDockReservePx()
  const banners = useSyncExternalStore(
    Platform.OS === 'web' ? subscribeBottomChromeReserve : subscribeNoop,
    Platform.OS === 'web' ? getBottomChromeReserve : getServerDockSnapshot,
    getServerDockSnapshot,
  )
  return Math.max(dock, banners)
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
