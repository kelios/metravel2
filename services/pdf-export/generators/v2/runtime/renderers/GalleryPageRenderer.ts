import type { TravelForBook } from '@/types/pdf-export'
import type { GalleryLayout } from '@/types/pdf-gallery'
import { calculateOptimalColumns } from '@/types/pdf-gallery'
import { escapeHtml, type RuntimeRenderContext, buildRunningHeader, getImageFilterStyle } from './renderHelpers'
import { buildSafeImageUrl } from '../../../../utils/htmlUtils'

export class RuntimeGalleryRenderer {
  constructor(private ctx: RuntimeRenderContext) {}

  renderPages(travel: TravelForBook, startPageNumber: number): string[] {
    const { colors, spacing } = this.ctx.theme
    const photos = (travel.gallery || [])
      .map((item) => {
        const raw = typeof item === 'string' ? item : item?.url
        return buildSafeImageUrl(raw)
      })
      .filter((url): url is string => !!url && url.trim().length > 0)

    if (!photos.length) return []

    const { layout, columns: configuredColumns, spacing: gallerySpacing } = this.getGalleryOptions()
    const twoPerPageLayout = this.ctx.settings?.galleryTwoPerPageLayout || 'vertical'

    const gapMm = this.getGalleryGapMm(gallerySpacing)
    const pagePaddingMm = this.parseMm(spacing.pagePadding, 25)
    const runningHeaderMm = 14
    const availableContentHeightMm = Math.max(
      170,
      297 - pagePaddingMm * 2 - runningHeaderMm
    )

    const photosPerPage = this.getGalleryPhotosPerPage(layout, photos.length)
    const chunks: string[][] = []
    for (let start = 0; start < photos.length; start += photosPerPage) {
      chunks.push(photos.slice(start, start + photosPerPage))
    }

    const totalPhotos = photos.length

    return chunks.map((pagePhotos, pageIndex) => {
      const defaultColumns = calculateOptimalColumns(pagePhotos.length, layout)
      const isTwoPerPage = photosPerPage === 2 && pagePhotos.length === 2
      const columns = layout === 'collage'
        ? pagePhotos.length <= 1
          ? 1
          : 3
        : pagePhotos.length === 1
          ? 1
          : isTwoPerPage && twoPerPageLayout === 'vertical'
            ? 1
            : Math.max(1, Math.min(4, configuredColumns ?? defaultColumns))
      const estimatedRows = Math.max(1, Math.ceil(pagePhotos.length / Math.max(columns, 1)))
      const maxCardHeightMm = Math.max(
        72,
        Math.floor((availableContentHeightMm - gapMm * (estimatedRows - 1)) / estimatedRows)
      )
      const targetCardHeightMm =
        layout === 'slideshow'
          ? 200
          : layout === 'collage'
            ? pagePhotos.length <= 3
              ? 125
              : pagePhotos.length <= 5
                ? 110
                : 95
          : pagePhotos.length === 1
            ? 210
            : pagePhotos.length === 2
              ? (isTwoPerPage && twoPerPageLayout === 'vertical' ? 120 : 175)
              : pagePhotos.length <= 4
                ? 130
                : pagePhotos.length <= 6
                  ? 95
                  : 80
      const cardHeightMm = Math.min(targetCardHeightMm, maxCardHeightMm)
      const singleCardHeightMm = Math.min(210, availableContentHeightMm)
      const imageHeight = `${cardHeightMm}mm`
      const singleImageHeight = `${singleCardHeightMm}mm`

      const gridContainerStyle =
        layout === 'masonry'
          ? `column-count: ${columns}; column-gap: ${gapMm}mm;`
          : `display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: ${gapMm}mm; align-items: stretch;`

      const pageNumber = startPageNumber + pageIndex
      const isFirstGalleryPage = pageIndex === 0

      const globalStartIndex = pageIndex * photosPerPage
      const rangeStart = globalStartIndex + 1
      const rangeEnd = Math.min(globalStartIndex + pagePhotos.length, totalPhotos)

      const galleryHeaderHtml = isFirstGalleryPage ? `
        <div style="
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 2mm;
        ">
          <span style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 10px;
            background: ${colors.accentSoft};
            flex-shrink: 0;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${colors.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </span>
          <span style="
            font-size: 13pt;
            font-weight: 700;
            color: ${colors.text};
            font-family: ${this.ctx.theme.typography.headingFont};
            text-transform: uppercase;
            letter-spacing: 0.12em;
          ">Фотогалерея</span>
          <span style="
            display: inline-flex;
            align-items: center;
            padding: 3px 9px;
            border-radius: 999px;
            background: ${colors.accentSoft};
            color: ${colors.accentStrong};
            font-size: 8pt;
            font-weight: 700;
            font-family: ${this.ctx.theme.typography.bodyFont};
          ">${totalPhotos} фото</span>
        </div>
        <div style="
          height: 3px;
          background: linear-gradient(to right, ${colors.accent}, transparent);
          margin-bottom: 4mm;
          border-radius: 2px;
        "></div>
      ` : ''

      const continuationHeaderHtml = !isFirstGalleryPage ? `
        <div style="
          display: flex;
          justify-content: flex-end;
          margin-bottom: 3mm;
        ">
          <span style="
            display: inline-flex;
            align-items: center;
            padding: 3px 9px;
            border-radius: 999px;
            background: ${colors.accentSoft};
            color: ${colors.accentStrong};
            font-size: 8pt;
            font-weight: 700;
            font-family: ${this.ctx.theme.typography.bodyFont};
          ">Фото ${rangeStart}–${rangeEnd} из ${totalPhotos}</span>
        </div>
      ` : ''

      return `
      <section class="pdf-page gallery-page" style="padding: ${spacing.pagePadding}; height: 285mm; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
        ${buildRunningHeader(this.ctx, travel.name, pageNumber)}
        ${galleryHeaderHtml}
        ${continuationHeaderHtml}
        <div style="${gridContainerStyle}">
          ${pagePhotos
            .map((photo, index) => {
              const globalIndex = globalStartIndex + index
              const wrapperStyle =
                layout === 'masonry'
                  ? `break-inside: avoid; margin-bottom: ${gapMm}mm;`
                  : ''

              const polaroidRotation = index % 2 === 0 ? '-2.5deg' : '2.4deg'
              const polaroidStyle =
                layout === 'polaroid'
                  ? `padding: 1.5mm; padding-bottom: 0; background: #fff; transform: rotate(${polaroidRotation});`
                  : ''

              const collageHero = layout === 'collage' && index === 0
              const collageSpan = collageHero ? 'grid-column: span 2; grid-row: span 2;' : ''
              const resolvedHeight =
                collageHero
                  ? pagePhotos.length <= 3
                    ? '190mm'
                    : pagePhotos.length <= 5
                      ? '180mm'
                      : '168mm'
                  : imageHeight
              const isSingle = pagePhotos.length === 1
              const forceCover = pagePhotos.length <= 2
              const imgHeightStyle =
                layout === 'polaroid'
                  ? (forceCover ? `height: ${isSingle ? singleImageHeight : resolvedHeight};` : `height: auto; max-height: ${isSingle ? singleImageHeight : resolvedHeight};`)
                  : (forceCover ? `height: ${isSingle ? singleImageHeight : resolvedHeight};` : `height: auto; max-height: ${resolvedHeight};`)
              const wrapperMinHeight =
                layout === 'polaroid'
                  ? (isSingle ? `min-height: ${singleImageHeight};` : '')
                  : `min-height: ${isSingle ? singleImageHeight : resolvedHeight};`

              const borderRadiusValue = this.increaseBorderRadius(this.ctx.theme.blocks.borderRadius, 2)

              const numberBadge = `
                <span style="
                  position: absolute;
                  bottom: 6px;
                  right: 6px;
                  background: rgba(0,0,0,0.5);
                  color: white;
                  font-size: 7pt;
                  padding: 2px 6px;
                  border-radius: 4px;
                  font-weight: 600;
                  z-index: 1;
                ">${globalIndex + 1}</span>
              `

              const polaroidCaption = layout === 'polaroid' ? `
                <div style="
                  height: 8mm;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 8pt;
                  color: ${colors.textSecondary || '#666'};
                  font-family: ${this.ctx.theme.typography.bodyFont};
                  font-weight: 500;
                ">Фото ${globalIndex + 1}</div>
              ` : ''

              return `
            <div class="gallery-photo-frame" style="
              ${wrapperStyle}
              ${collageSpan}
              border-radius: ${borderRadiusValue};
              overflow: hidden;
              position: relative;
              box-shadow: ${this.ctx.theme.blocks.shadow};
              background: ${layout === 'polaroid' ? '#fff' : colors.surfaceAlt};
              ${polaroidStyle}
              ${wrapperMinHeight}
              display: flex;
              ${layout === 'polaroid' ? 'flex-direction: column;' : ''}
              align-items: center;
              justify-content: center;
              ${layout === 'polaroid' ? '' : 'padding: 0;'}
            ">
              <div style="position: relative; width: 100%; ${layout === 'polaroid' ? 'flex: 1; display: flex; align-items: center; justify-content: center;' : ''}">
                <img src="${escapeHtml(photo)}" alt="Фото ${globalIndex + 1}"
                  style="
                    width: 100%;
                    ${imgHeightStyle}
                    object-fit: ${forceCover ? 'cover' : 'contain'};
                    display: block;
                    position: relative;
                    border-radius: ${borderRadiusValue};
                    ${getImageFilterStyle(this.ctx)}
                  "
                  onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
                ${numberBadge}
              </div>
              ${polaroidCaption}
            </div>
          `
            })
            .join('')}
        </div>
      </section>
    `
    })
  }

  renderSinglePage(travel: TravelForBook, pageNumber: number): string {
    return this.renderPages(travel, pageNumber)[0] || ''
  }

  private getGalleryOptions() {
    const settings = this.ctx.settings
    const layout: GalleryLayout = (settings?.galleryLayout as GalleryLayout) || 'grid'
    const columns = settings?.galleryColumns
    const showCaptions = settings?.showCaptions ?? false
    const captionPosition = settings?.captionPosition || 'none'
    const spacing = settings?.gallerySpacing || 'normal'
    return { layout, columns, showCaptions, captionPosition, spacing }
  }

  private getGalleryPhotosPerPage(layout: GalleryLayout, totalPhotos: number): number {
    if (layout === 'slideshow') return 1
    const configured = this.ctx.settings?.galleryPhotosPerPage
    if (configured === 0) return totalPhotos
    if (typeof configured === 'number' && configured > 0) {
      return Math.min(totalPhotos, Math.max(1, configured))
    }
    return totalPhotos
  }

  private getGalleryGapMm(spacing: 'compact' | 'normal' | 'spacious'): number {
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

  private parseMm(value: string | undefined, fallback: number): number {
    if (!value) return fallback
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)mm$/i)
    if (!match) return fallback
    const parsed = Number(match[1])
    return Number.isFinite(parsed) ? parsed : fallback
  }

  private increaseBorderRadius(value: string, addPx: number): string {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)(px|mm|rem|em|%)$/)
    if (!match) return value
    const num = parseFloat(match[1]) + addPx
    return `${num}${match[2]}`
  }
}
