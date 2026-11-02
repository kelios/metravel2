import { Platform } from 'react-native'

/**
 * #2900 — «мягкие» токены палитры (`primarySoft`, `warningSoft`, …) — это
 * полупрозрачные rgba с альфой 0.06–0.12. Они задуманы как подсветка ПОВЕРХ
 * карточки. Контрол, который лежит прямо над картой (гео-баннер, плашка качества
 * геолокации, активная кнопка тулбара), с таким фоном на native становится
 * почти прозрачным: под ним видны тайлы и кластеры WebView, и пузырь кластера
 * читается как «нарисованный поверх кнопки/баннера».
 *
 * Mobile web это уже решал композицией `surface` + `linear-gradient(tint, tint)`
 * (#2451); у React Native нет фона из двух слоёв, поэтому на native цвет
 * сводится к одному непрозрачному заранее (alpha-композиция tint над surface).
 * Один хелпер на обе платформы — инвариант «контрол над картой непрозрачен»
 * не расходится между web и native.
 */

type Rgba = { r: number; g: number; b: number; a: number }

const clampByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)))

/** Разбирает `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(...)`, `rgba(...)`; иначе null. */
export function parseCssColor(input: string): Rgba | null {
  const value = String(input ?? '').trim().toLowerCase()

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/)
  if (hex) {
    const digits = hex[1].length === 3
      ? hex[1].split('').map((d) => d + d).join('')
      : hex[1]
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1,
    }
  }

  const fn = value.match(/^rgba?\(\s*([^)]+)\)$/)
  if (fn) {
    const parts = fn[1].split(/\s*[,/]\s*|\s+/).filter(Boolean)
    if (parts.length !== 3 && parts.length !== 4) return null
    const channels = parts.slice(0, 3).map(Number)
    if (channels.some((c) => !Number.isFinite(c))) return null
    const alphaRaw = parts[3]
    const alpha = alphaRaw == null
      ? 1
      : alphaRaw.endsWith('%')
        ? Number(alphaRaw.slice(0, -1)) / 100
        : Number(alphaRaw)
    if (!Number.isFinite(alpha)) return null
    return { r: channels[0], g: channels[1], b: channels[2], a: Math.min(1, Math.max(0, alpha)) }
  }

  return null
}

/**
 * Непрозрачный цвет «tint поверх base» (source-over). null, если хоть один цвет
 * не разобран или base сам полупрозрачен — тогда результат не был бы
 * непрозрачным, и вызывающий обязан взять запасной непрозрачный фон.
 */
export function compositeTintOverBase(tint: string, base: string): string | null {
  const top = parseCssColor(tint)
  const bottom = parseCssColor(base)
  if (!top || !bottom || bottom.a < 1) return null
  const mix = (t: number, b: number) => clampByte(t * top.a + b * (1 - top.a))
  return `rgb(${mix(top.r, bottom.r)}, ${mix(top.g, bottom.g)}, ${mix(top.b, bottom.b)})`
}

/**
 * Стиль фона «surface, подкрашенный tint» — всегда непрозрачный.
 * web: токены — CSS-переменные, поэтому слой tint кладётся градиентом над
 * `surface`; native: заранее посчитанный rgb, при неразборчивом токене — чистый
 * `surface` (лучше без подсветки, чем прозрачный контрол над картой).
 */
export function getOpaqueTintSurfaceStyle(
  tint: string,
  surface: string,
  platform: string = Platform.OS,
): { backgroundColor: string; backgroundImage?: string } {
  if (platform === 'web') {
    return { backgroundColor: surface, backgroundImage: `linear-gradient(${tint}, ${tint})` }
  }
  return { backgroundColor: compositeTintOverBase(tint, surface) ?? surface }
}
