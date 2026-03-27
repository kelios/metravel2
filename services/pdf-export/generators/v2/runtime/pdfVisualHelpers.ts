import type { CaptionPosition } from '@/types/pdf-gallery'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import type { PdfThemeConfig } from '../../../themes/PdfThemeConfig'
import { escapeHtml } from '../../../utils/htmlUtils'

type GalleryTypography = PdfThemeConfig['typography']
type GalleryColors = Pick<PdfThemeConfig['colors'], 'textMuted' | 'border' | 'surface'>

export type PdfIconName =
  | 'camera'
  | 'pen'
  | 'bulb'
  | 'warning'
  | 'sparkle'
  | 'globe'
  | 'calendar'
  | 'clock'
  | 'map-pin'
  | 'thumbs-up'
  | 'thumbs-down'

export function getGalleryGapMm(spacing: NonNullable<BookSettings['gallerySpacing']> | string): number {
  switch (spacing) {
    case 'compact':
      return 3
    case 'spacious':
      return 8
    case 'normal':
    default:
      return 6
  }
}

export function buildGalleryCaption(args: {
  index: number
  position: CaptionPosition
  typography: GalleryTypography
  colors: GalleryColors
}): { wrapperStart: string; wrapperEnd: string } {
  const { index, position, typography, colors } = args

  if (position === 'none') {
    return { wrapperStart: '', wrapperEnd: '' }
  }

  const text = `Фото ${index + 1}`

  if (position === 'overlay') {
    return {
      wrapperStart: `
          <div style="
            position: absolute;
            left: 8px;
            bottom: 8px;
            right: 8px;
            padding: 6px 10px;
            background: rgba(0,0,0,0.65);
            color: #fff;
            border-radius: 10px;
            font-size: ${typography.caption.size};
            line-height: 1.25;
            font-weight: 600;
            z-index: 2;
          ">${escapeHtml(text)}`,
      wrapperEnd: `</div>`,
    }
  }

  const top = position === 'top'
  return {
    wrapperStart: `
        <div style="
          padding: 8px 10px;
          color: ${colors.textMuted};
          font-size: ${typography.caption.size};
          font-weight: 600;
          font-family: ${typography.bodyFont};
          ${top ? 'border-bottom' : 'border-top'}: 1px solid ${colors.border};
          background: ${colors.surface};
        ">${escapeHtml(text)}`,
    wrapperEnd: `</div>`,
  }
}

export function getImageFilterStyle(imageFilter?: string): string {
  return imageFilter ? `filter: ${imageFilter};` : ''
}

export function buildContainImageMarkup(args: {
  src: string
  alt: string
  height: string
  background: string
  filterStyle?: string
  extraStyle?: string
  backdropMode?: 'blur' | 'solid'
}): string {
  const {
    src,
    alt,
    height,
    background,
    filterStyle = '',
    extraStyle = '',
    backdropMode = 'blur',
  } = args

  const safeSrc = escapeHtml(src)
  const safeAlt = escapeHtml(alt)

  if (backdropMode === 'solid') {
    return `
      <div aria-hidden="true"
        style="position:absolute;inset:0;background:${background};">
      </div>
      <img src="${safeSrc}" alt="${safeAlt}"
        style="position:relative;width:100%;height:${height};object-fit:contain;display:block;${filterStyle}${extraStyle}"
        crossorigin="anonymous"
        onerror="this.style.display='none';this.parentElement.style.background='${background}';" />
    `
  }

  return `
      <img src="${safeSrc}" alt="" aria-hidden="true"
        style="position:absolute;inset:-10px;width:calc(100% + 20px);height:calc(100% + 20px);object-fit:cover;filter:blur(18px);opacity:0.45;display:block;pointer-events:none;"
        crossorigin="anonymous" />
      <img src="${safeSrc}" alt="${safeAlt}"
        style="position:relative;width:100%;height:${height};object-fit:contain;display:block;${filterStyle}"
        crossorigin="anonymous"
        onerror="this.style.display='none';this.previousElementSibling.style.display='none';this.parentElement.style.background='${background}';" />
    `
}

export function renderPdfIcon(
  name: PdfIconName,
  color: string,
  size: number,
  opts?: { wrapper?: boolean }
): string {
  const wrapper = opts?.wrapper !== false
  const sizePx = `${size}px`
  const safeColor = escapeHtml(color)
  const svgStart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${safeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;">`
  const svgEnd = `</svg>`

  const paths: Record<PdfIconName, string> = {
    camera: `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>`,
    pen: `<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`,
    bulb: `<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.7.6 1 1.3 1 2v1h6v-1c0-.7.3-1.4 1-2a7 7 0 0 0-4-12z"/>`,
    warning: `<path d="M10.3 3.2 1.7 18a2 2 0 0 0 1.7 3h17.2a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
    sparkle: `<path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8z"/>`,
    globe: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
    calendar: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
    clock: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
    'map-pin': `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`,
    'thumbs-up': `<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>`,
    'thumbs-down': `<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>`,
  }

  const svg = `${svgStart}${paths[name]}${svgEnd}`

  if (!wrapper) {
    return svg
  }

  return `
      <span style="
        width: ${sizePx};
        height: ${sizePx};
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        vertical-align: middle;
        line-height: 1;
      ">${svg}</span>
    `
}
