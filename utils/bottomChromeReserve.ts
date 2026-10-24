/**
 * Единый резерв высоты под плавающими нижними панелями web-версии.
 *
 * Скролл-контейнеры (`--mt-consent-h` в `app/global.css`, RightColumn, sticky-
 * панели travel и кнопка «искать в этой области» на карте) считают, сколько
 * места внизу занято плавающей плашкой. Раньше переменную писал только
 * `ConsentBanner`; теперь таких плашек несколько, поэтому владельцы
 * регистрируются по имени, а в CSS уходит максимум — иначе панель, которая
 * скрылась последней, стирала резерв ещё видимой соседки.
 *
 * Имя переменной оставлено прежним: его читает уже существующая вёрстка.
 */

const CSS_VARIABLE = '--mt-consent-h'

const reserves = new Map<string, number>()
const listeners = new Set<() => void>()
const OWNER_ORDER = ['consent-banner', 'app-install-bar', 'network-status'] as const
type BottomChromeOwner = typeof OWNER_ORDER[number]
let criticalOwner: 'network-status' | null = null

/** Logical priority survives More/keyboard suspension and the reconnect exit. */
export const getCriticalBottomChromeOwner = () => criticalOwner

const isEffectiveOwner = (owner: string) => !criticalOwner ||
  (owner !== 'consent-banner' && owner !== 'app-install-bar')

/** Positioning reads only earlier owners; the public content reserve stays max(). */
export const getLowerBottomChromeReserve = (owner: BottomChromeOwner): number => {
  let max = 0
  for (const lowerOwner of OWNER_ORDER) {
    if (lowerOwner === owner) break
    if (isEffectiveOwner(lowerOwner)) max = Math.max(max, reserves.get(lowerOwner) ?? 0)
  }
  return max
}

/** Numeric snapshot for React subscribers; safe to read without a DOM. */
export const getBottomChromeReserve = (excludedOwner?: string): number => {
  let max = 0
  reserves.forEach((value, owner) => {
    if (owner !== excludedOwner && isEffectiveOwner(owner) && value > max) max = value
  })
  return max
}

export const subscribeBottomChromeReserve = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const applyReserve = (): void => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!root) return

  const max = getBottomChromeReserve()

  if (max > 0) {
    root.style.setProperty(CSS_VARIABLE, `${max}px`)
  } else {
    root.style.removeProperty(CSS_VARIABLE)
  }
}

const notifyReserveChange = (): void => {
  applyReserve()
  listeners.forEach((listener) => listener())
}

/** Mask optional extents atomically, before their React owners yield visually. */
export const setCriticalBottomChromeOwner = (owner: 'network-status' | null): void => {
  if (criticalOwner === owner) return
  criticalOwner = owner
  notifyReserveChange()
}

export const setBottomChromeReserve = (owner: string, heightPx: number): void => {
  if (!Number.isFinite(heightPx) || heightPx <= 0) {
    releaseBottomChromeReserve(owner)
    return
  }
  if (reserves.get(owner) === heightPx) return
  reserves.set(owner, heightPx)
  notifyReserveChange()
}

export const releaseBottomChromeReserve = (owner: string): void => {
  if (!reserves.delete(owner)) return
  notifyReserveChange()
}

/** Только для тестов: сбрасывает накопленных владельцев. */
export const resetBottomChromeReserve = (): void => {
  if (reserves.size === 0 && !criticalOwner) return
  reserves.clear()
  criticalOwner = null
  notifyReserveChange()
}
