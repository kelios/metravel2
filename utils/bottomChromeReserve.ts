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

const applyReserve = (): void => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!root) return

  let max = 0
  reserves.forEach((value) => {
    if (value > max) max = value
  })

  if (max > 0) {
    root.style.setProperty(CSS_VARIABLE, `${max}px`)
  } else {
    root.style.removeProperty(CSS_VARIABLE)
  }
}

export const setBottomChromeReserve = (owner: string, heightPx: number): void => {
  if (!Number.isFinite(heightPx) || heightPx <= 0) {
    releaseBottomChromeReserve(owner)
    return
  }
  reserves.set(owner, heightPx)
  applyReserve()
}

export const releaseBottomChromeReserve = (owner: string): void => {
  if (!reserves.delete(owner)) return
  applyReserve()
}

/** Только для тестов: сбрасывает накопленных владельцев. */
export const resetBottomChromeReserve = (): void => {
  reserves.clear()
  applyReserve()
}
