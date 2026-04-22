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

  const birdSvg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <ellipse cx="11.2" cy="14" rx="5.6" ry="4.8" fill="#ffffff"/>
      <circle cx="16.4" cy="10.5" r="2.8" fill="#ffffff"/>
      <path d="M8.2 14.1c1.2-2.5 4.2-3.5 6.7-2.2-1 2.8-4 4-6.7 2.2Z" fill="#f0f0f0"/>
      <path d="M5.8 13.5 2.8 11.8 3.4 15.2Z" fill="#ffffff"/>
      <path d="M18.9 10.3 21.8 11.3 19 12.2Z" fill="#f0f0f0"/>
      <circle cx="17.2" cy="9.8" r="0.65" fill="#2b1e0f"/>
    </svg>
  `)

  return `
    <div style="
      position: relative;
      width: 38px;
      height: 46px;
      box-sizing: border-box;
      pointer-events: none;
      user-select: none;
      filter: drop-shadow(0 10px 14px rgba(30, 20, 10, 0.28));
    ">
      <div style="
        position: absolute;
        left: 50%;
        top: 0;
        width: 34px;
        height: 34px;
        margin-left: -17px;
        border-radius: 50% 50% 50% 50% / 55% 55% 45% 45%;
        background: linear-gradient(145deg, ${brand} 0%, ${brandDark} 100%);
        border: 2px solid rgba(255,255,255,0.95);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 28px;
        width: 14px;
        height: 14px;
        margin-left: -7px;
        background: linear-gradient(145deg, ${brand} 0%, ${brandDark} 100%);
        clip-path: polygon(50% 100%, 0 0, 100% 0);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 3px;
        width: 22px;
        height: 10px;
        margin-left: -11px;
        background: linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%);
        border-radius: 999px;
        filter: blur(0.5px);
        box-sizing: border-box;
      "></div>
      <img
        src="data:image/svg+xml;charset=UTF-8,${birdSvg}"
        alt=""
        draggable="false"
        style="
          position: absolute;
          left: 50%;
          top: 7px;
          width: 20px;
          height: 20px;
          margin-left: -10px;
          display: block;
          object-fit: contain;
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.2));
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

  return `
    <div style="
      position: relative;
      width: 30px;
      height: 40px;
      box-sizing: border-box;
      pointer-events: none;
      user-select: none;
      filter: drop-shadow(0 8px 12px rgba(30, 20, 10, 0.26));
    ">
      <div style="
        position: absolute;
        left: 50%;
        top: 0;
        width: 28px;
        height: 28px;
        margin-left: -14px;
        border-radius: 50%;
        background: linear-gradient(145deg, ${accent} 0%, rgba(0,0,0,0.18) 140%), ${accent};
        border: 2px solid rgba(255,255,255,0.95);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 22px;
        width: 12px;
        height: 14px;
        margin-left: -6px;
        background: ${accent};
        clip-path: polygon(50% 100%, 0 0, 100% 0);
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 3px;
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
        top: 10px;
        width: 10px;
        height: 10px;
        margin-left: -5px;
        background: rgba(255,255,255,0.98);
        border-radius: 999px;
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 12px;
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

  const haloSize = metrics.size + 14
  const innerSize = metrics.size - 10

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
          background: ${softGlow};
          opacity: 0.55;
          box-sizing: border-box;
          animation: metravelClusterPulse 2.4s ease-in-out infinite;
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
          background: linear-gradient(145deg, ${accent} 0%, ${accentDark} 100%);
          border: 3px solid rgba(255,255,255,0.96);
          box-shadow: 0 10px 22px rgba(30, 50, 40, 0.28), inset 0 1px 2px rgba(255,255,255,0.4);
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
          letter-spacing: -0.02em;
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
