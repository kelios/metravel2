import { DESIGN_TOKENS } from '@/constants/designSystem'

type ClusterMetrics = {
  size: number
  fontSize: number
}

type ClusterIconHtmlOptions = {
  count: number
  thumbUrl?: string
  accentColor?: string
  textColor?: string
}

const DEFAULT_MARKER_TEXT = String(DESIGN_TOKENS.colors.primaryDark)
const DEFAULT_MARKER_SOFT = String(DESIGN_TOKENS.colors.primarySoft)
const DEFAULT_MARKER_BRAND = String(DESIGN_TOKENS.colors.brand)
const DEFAULT_MARKER_SHADOW = String(DESIGN_TOKENS.shadows.card)

export const sanitizeCssValue = (value: string | undefined, fallback = '') => {
  if (!value) return fallback
  const sanitized = String(value)
    .replace(/[^\w\s#(),.%:'"/=-]/g, '')
    .slice(0, 256)
  return sanitized || fallback
}

export const getClusterMetrics = (count: number): ClusterMetrics => {
  if (count >= 20) {
    return {
      size: 50,
      fontSize: 18,
    }
  }

  if (count >= 10) {
    return {
      size: 46,
      fontSize: 17,
    }
  }

  return {
    size: 42,
    fontSize: 16,
  }
}

export const buildBirdMarkerHtml = () => {
  const softGlow = sanitizeCssValue(
    DEFAULT_MARKER_SOFT,
    'rgba(122,157,143,0.18)',
  )
  const border = sanitizeCssValue(
    String(DESIGN_TOKENS.colors.borderLight),
    'rgba(255,255,255,0.32)',
  )
  const shadow = sanitizeCssValue(
    DEFAULT_MARKER_SHADOW,
    '0 12px 28px rgba(48, 60, 55, 0.18)',
  )
  const birdSvg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <ellipse cx="11.2" cy="14" rx="5.6" ry="4.8" fill="#F49B25"/>
      <circle cx="16.4" cy="10.5" r="2.8" fill="#F49B25"/>
      <path d="M8.2 14.1c1.2-2.5 4.2-3.5 6.7-2.2-1 2.8-4 4-6.7 2.2Z" fill="#E28712"/>
      <path d="M5.8 13.5 2.8 11.8 3.4 15.2Z" fill="#F49B25"/>
      <path d="M18.9 10.3 21.8 11.3 19 12.2Z" fill="#D87016"/>
      <circle cx="17.2" cy="9.8" r="0.65" fill="#5B4A35"/>
    </svg>
  `)
  return `
    <div style="
      position: relative;
      width: 32px;
      height: 32px;
      box-sizing: border-box;
      pointer-events: none;
      user-select: none;
      filter: drop-shadow(0 6px 12px rgba(40, 55, 49, 0.14));
    ">
      <div style="
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: ${softGlow};
        opacity: 0.5;
        box-sizing: border-box;
      "></div>
      <div
        style="
          position: absolute;
          inset: 1px;
          border-radius: 999px;
          background: rgba(248,250,249,0.66);
          border: 1px solid ${border};
          box-shadow: ${shadow};
          backdrop-filter: blur(10px) saturate(140%);
          -webkit-backdrop-filter: blur(10px) saturate(140%);
          box-sizing: border-box;
        "
      ></div>
      <img
        src="data:image/svg+xml;charset=UTF-8,${birdSvg}"
        alt=""
        draggable="false"
        style="
          position: absolute;
          inset: 7px;
          width: 18px;
          height: 18px;
          display: block;
          object-fit: contain;
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
  const softGlow = sanitizeCssValue(
    DEFAULT_MARKER_SOFT,
    'rgba(122,157,143,0.18)',
  )
  const brand = sanitizeCssValue(DEFAULT_MARKER_BRAND, '#ff922b')
  const shadow = sanitizeCssValue(
    DEFAULT_MARKER_SHADOW,
    '0 12px 28px rgba(48, 60, 55, 0.18)',
  )

  return `
    <div style="
      position: relative;
      width: 24px;
      height: 24px;
      box-sizing: border-box;
      pointer-events: none;
      user-select: none;
      filter: drop-shadow(0 4px 8px rgba(40, 55, 49, 0.14));
    ">
      <div style="
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: ${softGlow};
        opacity: 0.46;
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        inset: 1px;
        border-radius: 999px;
        border: 1px solid ${accent};
        box-shadow: ${shadow};
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        inset: 7px;
        border-radius: 999px;
        border: 1px solid ${accent};
        opacity: 0.74;
        box-sizing: border-box;
      "></div>
      <div style="
        position: absolute;
        top: 10px;
        left: 10px;
        width: 4px;
        height: 4px;
        border-radius: 999px;
        background: ${accent};
      "></div>
      <div style="
        position: absolute;
        top: -1px;
        right: -1px;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: ${brand};
        box-sizing: border-box;
      "></div>
    </div>
  `
}

export const buildClusterIconHtml = ({
  count,
  thumbUrl: _thumbUrl,
  accentColor = String(DESIGN_TOKENS.colors.primary),
  textColor = DEFAULT_MARKER_TEXT,
}: ClusterIconHtmlOptions) => {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1
  const label = safeCount > 999 ? '999+' : String(safeCount)
  const metrics = getClusterMetrics(safeCount)

  const accent = sanitizeCssValue(
    accentColor,
    String(DESIGN_TOKENS.colors.primary),
  )
  const text = sanitizeCssValue(textColor, DEFAULT_MARKER_TEXT)
  const softGlow = sanitizeCssValue(
    DEFAULT_MARKER_SOFT,
    'rgba(122,157,143,0.18)',
  )
  const shadow = sanitizeCssValue(
    DEFAULT_MARKER_SHADOW,
    '0 12px 28px rgba(48, 60, 55, 0.18)',
  )

  return {
    metrics,
    label,
    html: `
      <div style="
        position: relative;
        width: ${metrics.size}px;
        height: ${metrics.size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      ">
        <div style="
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: ${softGlow};
          opacity: 0.44;
          box-sizing: border-box;
        "></div>
        <div style="
          position: absolute;
          inset: 1px;
          border-radius: 999px;
          background: rgba(248,250,249,0.62);
          border: 1px solid rgba(255,255,255,0.42);
          box-shadow: ${shadow};
          backdrop-filter: blur(10px) saturate(140%);
          -webkit-backdrop-filter: blur(10px) saturate(140%);
          box-sizing: border-box;
        "></div>
        <div style="
          position: absolute;
          inset: 7px;
          border-radius: 999px;
          border: 1px solid ${accent};
          opacity: 0.36;
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
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        ">${label}</div>
      </div>
    `,
  }
}
