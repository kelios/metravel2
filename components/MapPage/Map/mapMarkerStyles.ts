import { DESIGN_TOKENS } from '@/constants/designSystem'

type ClusterMetrics = {
  size: number
  fontSize: number
}

type ClusterIconHtmlOptions = {
  count: number
  accentColor?: string
  accentDarkColor?: string
  softGlowColor?: string
  textColor?: string
  /** Dark theme: recolor the white sticker rings/halo to a dark surface tone. */
  isDark?: boolean
}

const DEFAULT_MARKER_TEXT = String(DESIGN_TOKENS.colors.textOnPrimary)
const DEFAULT_MARKER_SOFT = String(DESIGN_TOKENS.colors.primarySoft)
const DEFAULT_MARKER_BRAND = String(DESIGN_TOKENS.colors.brand)
const DEFAULT_MARKER_BRAND_DARK = String(DESIGN_TOKENS.colors.brandDark)
const DEFAULT_MARKER_PRIMARY = String(DESIGN_TOKENS.colors.primary)
const DEFAULT_MARKER_PRIMARY_DARK = String(DESIGN_TOKENS.colors.primaryDark)
const DEFAULT_MARKER_BRAND_LIGHT = String(DESIGN_TOKENS.colors.brandLight)
const DEFAULT_MARKER_BRAND_ALPHA_40 = String(DESIGN_TOKENS.colors.brandAlpha40)
const DEFAULT_MARKER_SURFACE = String(DESIGN_TOKENS.colors.surface)

export const sanitizeCssValue = (value: string | undefined, fallback = '') => {
  if (!value) return fallback
  const sanitized = String(value)
    .replace(/[^\w\s#(),.%:'"/=-]/g, '')
    .slice(0, 256)
  return sanitized || fallback
}

// Векторная бренд-птица MeTravel как инлайн-SVG для Leaflet divIcon
// (viewBox 0 0 100 100, бренд-цвета фиксированы). Резкость на любом DPI.
const BIRD_BODY = '#f5842c'
const BIRD_OUTLINE = '#e07020'
const BIRD_BEAK = '#f7a24f'
const BIRD_WING = '#c86a1e'
const BIRD_EYE = '#2f2a26'

const BIRD_LOGO_SHAPES = `
    <path d="M74 42 92 40 76 55 Z" fill="${BIRD_BODY}" stroke="${BIRD_OUTLINE}" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="46" cy="52" rx="35" ry="33" fill="${BIRD_BODY}" stroke="${BIRD_OUTLINE}" stroke-width="2.4"/>
    <path d="M13 43 2 47 13 50 Z" fill="${BIRD_BEAK}" stroke="${BIRD_OUTLINE}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M39 46 Q61 51 56 76 Q44 68 39 46 Z" fill="none" stroke="${BIRD_WING}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="30" cy="39" r="3.7" fill="${BIRD_EYE}"/>
    <circle cx="31.2" cy="37.9" r="1.1" fill="#ffffff"/>
  `

export const buildBirdLogoSvg = (size: number) => `
  <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${BIRD_LOGO_SHAPES}</svg>
`

/**
 * Inline SVG → CSS `url(...)` value without quotes. Everything that may not
 * appear in an unquoted CSS url — quotes, parentheses, whitespace — is
 * percent-encoded, so the result drops into a double-quoted `style` attribute,
 * a single-quoted JS string (native WebView template) and JSON alike (#843).
 */
const toSvgDataUri = (svg: string): string =>
  `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')}`

/**
 * #2451 — птица рисуется фоном одного узла, а не шестью SVG-элементами в DOM:
 * у каждого маркера карты внутри `.leaflet-marker-icon` остаётся ≤2 узла.
 */
const BIRD_LOGO_DATA_URI = toSvgDataUri(buildBirdLogoSvg(100))

export const getClusterMetrics = (count: number): ClusterMetrics => {
  if (count >= 200) return { size: 68, fontSize: 20 }
  if (count >= 50) return { size: 62, fontSize: 19 }
  if (count >= 20) return { size: 56, fontSize: 18 }
  if (count >= 10) return { size: 50, fontSize: 17 }
  return { size: 44, fontSize: 15 }
}

/**
 * Bird pin markup of the native WebView maps (Map.ios/TravelMap.native/route
 * picker). Same shape as before #2453, minus the per-marker compositing hints
 * (`translateZ(0)` / `will-change`): with hundreds of pins each one became its
 * own GPU layer that Leaflet animated on every zoom. Web maps use the lighter
 * `buildPlaceMarkerIconHtml` (#2451); the native path can switch to it after
 * an emulator check.
 */
export const buildBirdMarkerHtml = () => {
  const brand = sanitizeCssValue(DEFAULT_MARKER_BRAND, '#ff922b')
  const brandDark = sanitizeCssValue(DEFAULT_MARKER_BRAND_DARK, '#e07a16')
  const brandLight = sanitizeCssValue(
    DEFAULT_MARKER_BRAND_LIGHT,
    '#fff8f3',
  )
  const brandSoft = sanitizeCssValue(
    DEFAULT_MARKER_BRAND_ALPHA_40,
    'rgba(255,146,43,0.25)',
  )
  const surface = sanitizeCssValue(
    DEFAULT_MARKER_SURFACE,
    '#ffffff',
  )

  return `
    <div style="
      position: relative;
      width: 48px;
      height: 58px;
      box-sizing: border-box;
      pointer-events: none;
      user-select: none;
    ">
      <div style="
        position: absolute;
        left: 50%;
        bottom: 0px;
        width: 34px;
        height: 13px;
        margin-left: -17px;
        border-radius: 999px;
        background: radial-gradient(ellipse at 50% 50%, rgba(40,30,18,0.26) 0%, rgba(40,30,18,0.12) 45%, transparent 72%);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 2px;
        width: 44px;
        height: 44px;
        margin-left: -22px;
        border-radius: 999px;
        background: radial-gradient(circle at 50% 50%, ${brandSoft} 0%, transparent 70%);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 4px;
        width: 40px;
        height: 46px;
        margin-left: -20px;
        border-radius: 24px 24px 24px 7px;
        background:
          radial-gradient(circle at 30% 24%, rgba(255,255,255,0.44) 0%, rgba(255,255,255,0) 30%),
          linear-gradient(150deg, ${brand} 0%, ${brandDark} 100%);
        border: 2px solid ${surface};
        box-shadow:
          0 14px 26px rgba(30, 20, 10, 0.24),
          0 0 0 6px ${brandSoft},
          inset 0 1px 3px rgba(255,255,255,0.36);
        transform: rotate(-45deg);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 8px;
        width: 28px;
        height: 12px;
        margin-left: -14px;
        background: linear-gradient(180deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0) 100%);
        border-radius: 999px;
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 12px;
        width: 30px;
        height: 30px;
        margin-left: -15px;
        border-radius: 999px;
        background:
          linear-gradient(180deg, ${surface} 0%, ${brandLight} 100%);
        border: 1px solid rgba(255,255,255,0.78);
        box-shadow:
          0 4px 10px rgba(40, 30, 18, 0.16),
          inset 0 1px 1px rgba(255,255,255,0.82);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 14px;
        width: 26px;
        height: 26px;
        margin-left: -13px;
        display: block;
        box-sizing: border-box;
      ">${buildBirdLogoSvg(26)}</div>
    </div>
  `
}

/**
 * Place marker (bird pin) for the web Leaflet maps — the same picture as
 * `buildBirdMarkerHtml` (shape, colours, 48×58 box), lighter DOM.
 *
 * #2451: exactly two DOM nodes inside `.leaflet-marker-icon` (the rotated
 * teardrop and the white disc with the bird as a background image), no GPU
 * layer hints (each marker used to be promoted to its own compositor layer)
 * and a drop shadow with ≤8px blur. Shape, colours and the 48×58 box are
 * unchanged; the children are positioned against the icon box that Leaflet
 * sizes to 48×58 (`iconSize`).
 */
export const buildPlaceMarkerIconHtml = () => {
  const brand = sanitizeCssValue(DEFAULT_MARKER_BRAND, '#ff922b')
  const brandDark = sanitizeCssValue(DEFAULT_MARKER_BRAND_DARK, '#e07a16')
  const brandLight = sanitizeCssValue(
    DEFAULT_MARKER_BRAND_LIGHT,
    '#fff8f3',
  )
  const brandSoft = sanitizeCssValue(
    DEFAULT_MARKER_BRAND_ALPHA_40,
    'rgba(255,146,43,0.25)',
  )
  const surface = sanitizeCssValue(
    DEFAULT_MARKER_SURFACE,
    '#ffffff',
  )

  return `<div style="
      position: absolute;
      left: 4px;
      top: 4px;
      width: 40px;
      height: 46px;
      border-radius: 24px 24px 24px 7px;
      background:
        radial-gradient(circle at 30% 24%, rgba(255,255,255,0.44) 0%, rgba(255,255,255,0) 30%),
        linear-gradient(150deg, ${brand} 0%, ${brandDark} 100%);
      border: 2px solid ${surface};
      box-shadow: 0 4px 8px rgba(30, 20, 10, 0.24), 0 0 0 6px ${brandSoft};
      transform: rotate(-45deg);
      box-sizing: border-box;
      pointer-events: none;
    "></div><div style="
      position: absolute;
      left: 9px;
      top: 12px;
      width: 30px;
      height: 30px;
      border-radius: 999px;
      background:
        url(${BIRD_LOGO_DATA_URI}) center / 26px 26px no-repeat,
        linear-gradient(180deg, ${surface} 0%, ${brandLight} 100%);
      border: 1px solid rgba(255,255,255,0.78);
      box-shadow: 0 2px 6px rgba(40, 30, 18, 0.16);
      box-sizing: border-box;
      pointer-events: none;
    "></div>`
}

export const buildMapPinHtml = (accentColor: string) => {
  const accent = sanitizeCssValue(
    accentColor,
    String(DESIGN_TOKENS.colors.mapPin),
  )
  const surface = sanitizeCssValue(
    DEFAULT_MARKER_SURFACE,
    '#ffffff',
  )

  return `
    <div style="
      position: relative;
      width: 34px;
      height: 44px;
      box-sizing: border-box;
      pointer-events: none;
      user-select: none;
    ">
      <div style="
        position: absolute;
        left: 50%;
        bottom: 0px;
        width: 24px;
        height: 9px;
        margin-left: -12px;
        border-radius: 999px;
        background: radial-gradient(ellipse at 50% 50%, rgba(30,20,10,0.28) 0%, rgba(30,20,10,0.13) 45%, transparent 72%);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 4px;
        width: 30px;
        height: 34px;
        margin-left: -15px;
        border-radius: 17px 17px 17px 5px;
        background: linear-gradient(145deg, ${accent} 0%, rgba(0,0,0,0.18) 140%), ${accent};
        border: 3px solid ${surface};
        box-shadow:
          0 4px 8px rgba(30, 20, 10, 0.25),
          inset 0 1px 2px rgba(255,255,255,0.32);
        transform: rotate(-45deg);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 8px;
        width: 18px;
        height: 8px;
        margin-left: -9px;
        background: linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%);
        border-radius: 999px;
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 13px;
        width: 12px;
        height: 12px;
        margin-left: -6px;
        background: rgba(255,255,255,0.98);
        border-radius: 999px;
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 16px;
        width: 6px;
        height: 6px;
        margin-left: -3px;
        background: ${accent};
        border-radius: 999px;
        box-sizing: border-box;
      "></div>
    </div>
  `
}

/**
 * #1780 — цвет маркера «вы здесь». Намеренно НЕ из общей палитры:
 *  - бренд-оранжевый занят POI-пинами, и пользователь не отличал себя от точки;
 *  - матовый `accent` (#8a9aa8) сливался с серо-голубыми тайлами OSM, поэтому
 *    маркер был не только неотличим, но и просто плохо заметен.
 * Насыщенный синий — конвенция GPS-точки (Google/Apple/OSM/2ГИС): он читается
 * как «я», а не как «объект», без подписи и без обучения.
 */
const USER_LOCATION_CORE = '#1a6fd4'
const USER_LOCATION_HALO = '#4a93e8'
/**
 * Кольцо всегда белое, в обеих темах: на тёмных тайлах белая обводка — главный
 * контур, дающий точке контраст. Тематический `surface` в тёмной теме сделал бы
 * кольцо тёмным и растворил бы маркер.
 */
const USER_LOCATION_RING = '#ffffff'

export const USER_LOCATION_MARKER_COLOR = USER_LOCATION_CORE
/** Размер divIcon маркера «вы здесь» — общий контракт web и native WebView. */
export const USER_LOCATION_MARKER_SIZE = 38

export const buildUserLocationHtml = () => {
  const core = sanitizeCssValue(USER_LOCATION_CORE, '#1a6fd4')
  const halo = sanitizeCssValue(USER_LOCATION_HALO, '#4a93e8')
  const ring = sanitizeCssValue(USER_LOCATION_RING, '#ffffff')

  // "You are here" GPS dot — distinct from POI teardrop pins: a centered core
  // dot with a white ring and an expanding pulse halo. Transparency comes from
  // element `opacity` (colours stay literal hex so the same markup renders in
  // the native WebView, where CSS custom properties of the app are absent).
  return `
    <div style="
      position: relative;
      width: ${USER_LOCATION_MARKER_SIZE}px;
      height: ${USER_LOCATION_MARKER_SIZE}px;
      box-sizing: border-box;
      pointer-events: none;
      user-select: none;
    ">
      <div style="
        position: absolute;
        left: 50%;
        top: 50%;
        width: 32px;
        height: 32px;
        margin-left: -16px;
        margin-top: -16px;
        border-radius: 999px;
        background: ${halo};
        opacity: 0.45;
        transform: scale(0.6);
        animation: metravelUserPulse 2.4s ease-out infinite;
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 50%;
        width: 28px;
        height: 28px;
        margin-left: -14px;
        margin-top: -14px;
        border-radius: 999px;
        background: ${halo};
        opacity: 0.2;
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 50%;
        width: 20px;
        height: 20px;
        margin-left: -10px;
        margin-top: -10px;
        border-radius: 999px;
        background:
          radial-gradient(circle at 34% 30%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 42%),
          ${core};
        border: 4px solid ${ring};
        box-shadow:
          0 2px 8px rgba(12, 24, 44, 0.42),
          0 1px 2px rgba(12, 24, 44, 0.3);
        box-sizing: border-box;
      "></div>
    </div>
  `
}

/**
 * Visual class of a cluster bubble: everything its markup depends on besides
 * colours/theme. Two counts with the same class render identical HTML, so a
 * divIcon can be shared between them (#2451 icon cache).
 */
export const getClusterIconClass = (count: number): { label: string; metrics: ClusterMetrics } => {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1
  return {
    label: safeCount > 999 ? '999+' : String(safeCount),
    metrics: getClusterMetrics(safeCount),
  }
}

export const buildClusterIconHtml = ({
  count,
  accentColor = DEFAULT_MARKER_PRIMARY,
  accentDarkColor,
  softGlowColor,
  textColor,
  isDark = false,
}: ClusterIconHtmlOptions) => {
  const { label, metrics } = getClusterIconClass(count)

  const accent = sanitizeCssValue(accentColor, DEFAULT_MARKER_PRIMARY)
  const accentDark = sanitizeCssValue(
    accentDarkColor || DEFAULT_MARKER_PRIMARY_DARK,
    '#2f5a4a',
  )
  const text = sanitizeCssValue(
    textColor || DEFAULT_MARKER_TEXT,
    DEFAULT_MARKER_TEXT,
  )
  const softGlow = sanitizeCssValue(
    softGlowColor || DEFAULT_MARKER_SOFT,
    'rgba(122,157,143,0.35)',
  )

  // Sticker "halo" is a white ring/disc in light theme; on a dark map that
  // reads as a jarring white blob. In dark theme swap the white surface for a
  // dark surface tone (matches --color-surface ≈ #2a2a2a) with a faint light
  // rim, so the accent core still reads but the halo blends with the map.
  const ringStrong = isDark ? 'rgba(42,42,44,0.95)' : 'rgba(255,255,255,0.96)'
  const orbitBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.88)'
  const orbitFill = isDark ? 'rgba(26,28,32,0.4)' : 'rgba(255,255,255,0.32)'
  const textShadow = isDark
    ? '0 1px 2px rgba(0,0,0,0.55)'
    : '0 1px 2px rgba(0,0,0,0.18)'

  // #2451 — one DOM node per cluster: the old halo/orbit/core/gloss/label
  // stack (7 nodes, 24px shadow, an infinite pulse on EVERY cluster) is folded
  // into box-shadow spread rings around a single centred disc. Ring radii match
  // the old layers: orbit fill/border at +2/+4px, soft halo out to +9px.
  return {
    metrics,
    label,
    html: `<div style="
        width: ${metrics.size}px;
        height: ${metrics.size}px;
        border-radius: 999px;
        background:
          radial-gradient(circle at 32% 24%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 38%),
          linear-gradient(145deg, ${accent} 0%, ${accentDark} 100%);
        border: 3px solid ${ringStrong};
        box-shadow:
          0 0 0 2px ${orbitFill},
          0 0 0 4px ${orbitBorder},
          0 0 0 9px ${softGlow},
          0 4px 8px rgba(30, 50, 40, 0.24);
        color: ${text};
        font-size: ${metrics.fontSize}px;
        line-height: 1;
        font-weight: 800;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0;
        text-shadow: ${textShadow};
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        pointer-events: none;
      ">${label}</div>`,
  }
}
