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

/** Numeric snapshot for React subscribers; safe to read without a DOM. */
export const getBottomChromeReserve = (excludedOwner?: string): number => {
  let max = 0
  reserves.forEach((value, owner) => {
    if (owner !== excludedOwner && value > max) max = value
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
  if (reserves.size === 0) return
  reserves.clear()
  notifyReserveChange()
}
