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
      width: 46px;
      height: 58px;
      box-sizing: border-box;
      pointer-events: none;
      user-select: none;
      transform: translateZ(0);
    ">
      <div style="
        position: absolute;
        left: 50%;
        bottom: 1px;
        width: 22px;
        height: 8px;
        margin-left: -11px;
        border-radius: 999px;
        background: rgba(40, 30, 18, 0.24);
        filter: blur(4px);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 5px;
        width: 40px;
        height: 46px;
        margin-left: -20px;
        border-radius: 22px 22px 22px 6px;
        background: linear-gradient(145deg, ${brand} 0%, ${brandDark} 100%);
        border: 3px solid ${surface};
        box-shadow:
          0 14px 22px rgba(30, 20, 10, 0.28),
          0 0 0 7px ${brandSoft},
          inset 0 1px 2px rgba(255,255,255,0.38);
        transform: rotate(-45deg);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 9px;
        width: 27px;
        height: 14px;
        margin-left: -13.5px;
        background: linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%);
        border-radius: 999px;
        filter: blur(0.5px);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 13px;
        width: 28px;
        height: 28px;
        margin-left: -14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.96);
        box-shadow:
          inset 0 1px 2px rgba(255,255,255,0.7),
          0 2px 4px rgba(40, 30, 18, 0.12);
        box-sizing: border-box;
      "></div>
      <img
        src="/assets/icons/logo_yellow_60x60.png"
        alt=""
        draggable="false"
        style="
          position: absolute;
          left: 50%;
          top: 12px;
          width: 30px;
          height: 30px;
          margin-left: -15px;
          display: block;
          object-fit: contain;
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.18));
        "
      />
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

export const buildClusterIconHtml = ({
  count,
  thumbUrl: _thumbUrl,
  accentColor = DEFAULT_MARKER_PRIMARY,
  accentDarkColor,
  softGlowColor,
  textColor,
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
          border: 2px solid rgba(255,255,255,0.88);
          background: rgba(255,255,255,0.32);
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
          border: 2px solid rgba(255,255,255,0.92);
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
          border: 2px solid rgba(255,255,255,0.92);
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
          border: 3px solid rgba(255,255,255,0.96);
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
          background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 100%);
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
          text-shadow: 0 1px 2px rgba(0,0,0,0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        ">${label}</div>
      </div>
    `,
  }
}
