import { DESIGN_TOKENS } from '@/constants/designSystem'

type ClusterMetrics = {
  size: number
  fontSize: number
}

type ClusterIconHtmlOptions = {
  count: number
  thumbUrl?: string
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

export const buildBirdLogoSvg = (size: number) => `
  <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M74 42 92 40 76 55 Z" fill="${BIRD_BODY}" stroke="${BIRD_OUTLINE}" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="46" cy="52" rx="35" ry="33" fill="${BIRD_BODY}" stroke="${BIRD_OUTLINE}" stroke-width="2.4"/>
    <path d="M13 43 2 47 13 50 Z" fill="${BIRD_BEAK}" stroke="${BIRD_OUTLINE}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M39 46 Q61 51 56 76 Q44 68 39 46 Z" fill="none" stroke="${BIRD_WING}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="30" cy="39" r="3.7" fill="${BIRD_EYE}"/>
    <circle cx="31.2" cy="37.9" r="1.1" fill="#ffffff"/>
  </svg>
`

export const getClusterMetrics = (count: number): ClusterMetrics => {
  if (count >= 200) return { size: 68, fontSize: 20 }
  if (count >= 50) return { size: 62, fontSize: 19 }
  if (count >= 20) return { size: 56, fontSize: 18 }
  if (count >= 10) return { size: 50, fontSize: 17 }
  return { size: 44, fontSize: 15 }
}

export const buildBirdMarkerHtml = () => {
  const brand = sanitizeCssValue(DEFAULT_MARKER_BRAND, '#ff922b')
  const brandDark = sanitizeCssValue(DEFAULT_MARKER_BRAND_DARK, '#e07a16')
  const brandLight = sanitizeCssValue(
    String(DESIGN_TOKENS.colors.brandLight),
    '#fff8f3',
  )
  const brandSoft = sanitizeCssValue(
    String(DESIGN_TOKENS.colors.brandAlpha40),
    'rgba(255,146,43,0.25)',
  )
  const surface = sanitizeCssValue(
    String(DESIGN_TOKENS.colors.surface),
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
      transform: translateZ(0);
    ">
      <div style="
        position: absolute;
        left: 50%;
        bottom: 2px;
        width: 26px;
        height: 9px;
        margin-left: -13px;
        border-radius: 999px;
        background: rgba(40, 30, 18, 0.20);
        filter: blur(5px);
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
        filter: blur(0.2px);
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
        filter: blur(0.5px);
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
        filter: drop-shadow(0 1px 1px rgba(0,0,0,0.16));
        box-sizing: border-box;
      ">${buildBirdLogoSvg(26)}</div>
    </div>
  `
}

export const buildMapPinHtml = (accentColor: string) => {
  const accent = sanitizeCssValue(
    accentColor,
    String(DESIGN_TOKENS.colors.mapPin),
  )
  const surface = sanitizeCssValue(
    String(DESIGN_TOKENS.colors.surface),
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
        bottom: 1px;
        width: 18px;
        height: 6px;
        margin-left: -9px;
        border-radius: 999px;
        background: rgba(30, 20, 10, 0.22);
        filter: blur(3px);
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
          0 10px 16px rgba(30, 20, 10, 0.25),
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
        filter: blur(0.5px);
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

export const buildUserLocationHtml = (accentColor: string) => {
  const accent = sanitizeCssValue(
    accentColor,
    String(DESIGN_TOKENS.colors.accent),
  )
  const surface = sanitizeCssValue(
    String(DESIGN_TOKENS.colors.surface),
    '#ffffff',
  )

  // "You are here" GPS dot — distinct from POI teardrop pins: a centered core
  // dot with a white ring and an expanding pulse halo. Transparency comes from
  // element `opacity` (accent is a CSS var() on web, so alpha-hex can't append).
  return `
    <div style="
      position: relative;
      width: 30px;
      height: 30px;
      box-sizing: border-box;
      pointer-events: none;
      user-select: none;
    ">
      <div style="
        position: absolute;
        left: 50%;
        top: 50%;
        width: 26px;
        height: 26px;
        margin-left: -13px;
        margin-top: -13px;
        border-radius: 999px;
        background: ${accent};
        opacity: 0.45;
        transform: scale(0.6);
        animation: metravelUserPulse 2.4s ease-out infinite;
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 50%;
        width: 22px;
        height: 22px;
        margin-left: -11px;
        margin-top: -11px;
        border-radius: 999px;
        background: ${accent};
        opacity: 0.16;
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 50%;
        width: 16px;
        height: 16px;
        margin-left: -8px;
        margin-top: -8px;
        border-radius: 999px;
        background:
          radial-gradient(circle at 34% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 42%),
          ${accent};
        border: 3px solid ${surface};
        box-shadow:
          0 2px 6px rgba(30, 20, 10, 0.32),
          0 1px 2px rgba(30, 20, 10, 0.25);
        box-sizing: border-box;
      "></div>
    </div>
  `
}

export const buildClusterIconHtml = ({
  count,
  thumbUrl: _thumbUrl,
  accentColor = DEFAULT_MARKER_PRIMARY,
  accentDarkColor,
  softGlowColor,
  textColor,
  isDark = false,
}: ClusterIconHtmlOptions) => {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1
  const label = safeCount > 999 ? '999+' : String(safeCount)
  const metrics = getClusterMetrics(safeCount)

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
  const ringMed = isDark ? 'rgba(42,42,44,0.9)' : 'rgba(255,255,255,0.92)'
  const orbitBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.88)'
  const orbitFill = isDark ? 'rgba(26,28,32,0.4)' : 'rgba(255,255,255,0.32)'
  const gloss = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.45)'
  const textShadow = isDark
    ? '0 1px 2px rgba(0,0,0,0.55)'
    : '0 1px 2px rgba(0,0,0,0.18)'

  const haloSize = metrics.size + 18
  const innerSize = metrics.size - 14
  const orbitSize = metrics.size + 8

  return {
    metrics,
    label,
    html: `
      <div style="
        position: relative;
        width: ${haloSize}px;
        height: ${haloSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        pointer-events: none;
      ">
        <div style="
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background:
            radial-gradient(circle at 50% 50%, ${softGlow} 0%, ${softGlow} 54%, transparent 58%);
          opacity: 0.72;
          box-sizing: border-box;
          animation: metravelClusterPulse 2.4s ease-in-out infinite;
        "></div>
        <div style="
          position: absolute;
          left: 50%;
          top: 50%;
          width: ${orbitSize}px;
          height: ${orbitSize}px;
          margin-left: -${orbitSize / 2}px;
          margin-top: -${orbitSize / 2}px;
          border-radius: 999px;
          border: 2px solid ${orbitBorder};
          background: ${orbitFill};
          box-shadow: 0 8px 18px rgba(30, 50, 40, 0.18);
          box-sizing: border-box;
        "></div>
        <div style="
          position: absolute;
          left: 10px;
          top: 13px;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: ${accent};
          border: 2px solid ${ringMed};
          box-shadow: 0 3px 8px rgba(30, 50, 40, 0.16);
          box-sizing: border-box;
        "></div>
        <div style="
          position: absolute;
          right: 9px;
          bottom: 14px;
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: ${accentDark};
          border: 2px solid ${ringMed};
          box-shadow: 0 3px 8px rgba(30, 50, 40, 0.16);
          box-sizing: border-box;
        "></div>
        <div style="
          position: absolute;
          left: 50%;
          top: 50%;
          width: ${metrics.size}px;
          height: ${metrics.size}px;
          margin-left: -${metrics.size / 2}px;
          margin-top: -${metrics.size / 2}px;
          border-radius: 999px;
          background:
            radial-gradient(circle at 32% 24%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 38%),
            linear-gradient(145deg, ${accent} 0%, ${accentDark} 100%);
          border: 3px solid ${ringStrong};
          box-shadow:
            0 12px 24px rgba(30, 50, 40, 0.3),
            inset 0 1px 2px rgba(255,255,255,0.4);
          box-sizing: border-box;
        "></div>
        <div style="
          position: absolute;
          left: 50%;
          top: 50%;
          width: ${innerSize}px;
          height: 8px;
          margin-left: -${innerSize / 2}px;
          margin-top: -${metrics.size / 2 - 6}px;
          border-radius: 999px;
          background: linear-gradient(180deg, ${gloss} 0%, rgba(255,255,255,0) 100%);
          filter: blur(0.6px);
          box-sizing: border-box;
        "></div>
        <div style="
          position: absolute;
          inset: 0;
          border-radius: 999px;
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
        ">${label}</div>
      </div>
    `,
  }
}
