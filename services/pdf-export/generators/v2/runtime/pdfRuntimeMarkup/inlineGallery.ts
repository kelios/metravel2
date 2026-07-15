import type {
  BuildInlineGallerySectionParams,
  BuildTravelContentRuntimeDataParams,
  TravelContentRuntimeData,
} from './types'
import { translate as i18nT } from '@/i18n'


export function buildPdfInlineGallerySection({
  travel,
  theme,
  colors,
  typography,
  spacing,
  layout,
  columns: configuredColumns,
  showCaptions,
  captionPosition,
  galleryGapMm,
  buildSafeImageUrl,
  buildContainImage,
  buildGalleryCaption,
  renderPdfIcon,
  getPhotoLabel,
}: BuildInlineGallerySectionParams): string {
  const rawPhotos = travel.gallery || []
  const photos = rawPhotos
    .map((item) => {
      const url = typeof item === 'string' ? item : item?.url
      return buildSafeImageUrl(url)
    })
    .filter((url): url is string => !!url && url.trim().length > 0)

  if (!photos.length) return ''

  if (photos.length >= 5) {
    const previewPhotos = photos.slice(0, 4)
    const remaining = photos.length - 4

    return `
      <div style="margin-bottom: ${spacing.sectionSpacing};">
        <div style="
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: ${spacing.elementSpacing};
          padding-bottom: 8px;
          border-bottom: 2px solid ${colors.accentSoft};
        ">
          ${renderPdfIcon('camera', colors.text, 20)}
          <h2 style="
            font-size: ${typography.h2.size};
            font-weight: ${typography.h2.weight};
            color: ${colors.accent};
            margin: 0;
            font-family: ${typography.headingFont};
          ">${i18nT("export:services.pdf_export.generators.v2.runtime.pdfRuntimeMarkup.inlineGallery.div_style_margin_bottom_value1_div_style_dis_5459e59e.text01")}</h2>
          <span style="
            font-size: ${typography.small.size};
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
          ">(${photos.length} ${getPhotoLabel(photos.length)})</span>
        </div>
        <div style="
          display: flex;
          gap: 4mm;
          flex-wrap: nowrap;
        ">
          ${previewPhotos.map((photo, index) => `
            <div style="
              width: calc((100% - 12mm) / 4);
              border-radius: ${theme.blocks.borderRadius};
              overflow: hidden;
              background: ${colors.surfaceAlt};
              box-shadow: ${theme.blocks.shadow};
              position: relative;
            ">
              ${buildContainImage(photo, i18nT('export:services.pdfExport.runtime.gallery.photoAlt', { value1: index + 1 }), '48mm', { onerrorBg: colors.surfaceAlt })}
              ${index === 3 ? `
                <div style="
                  position: absolute;
                  top: 0; right: 0; bottom: 0; left: 0;
                  background: rgba(0,0,0,0.7);
                  color: white;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 24pt;
                  font-weight: 700;
                  font-family: ${typography.headingFont};
                ">+${remaining}</div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  if (photos.length === 1) {
    const caption = showCaptions ? buildGalleryCaption(0, captionPosition, typography) : null
    return `
      <div style="margin-bottom: ${spacing.sectionSpacing};">
        <div style="
          border-radius: ${theme.blocks.borderRadius};
          overflow: hidden;
          box-shadow: ${theme.blocks.shadow};
          background: ${colors.surfaceAlt};
          position: relative;
        ">
          ${buildContainImage(photos[0], i18nT('export:services.pdf_export.generators.v2.runtime.pdfRuntimeMarkup.inlineGallery.foto_puteshestviya_720ec355'), '85mm', { onerrorBg: colors.surfaceAlt })}
          ${caption && captionPosition === 'overlay' ? caption.wrapperStart + caption.wrapperEnd : ''}
        </div>
      </div>
    `
  }

  const defaultColumns = photos.length === 2 ? 2 : photos.length === 3 ? 3 : 2
  const gridColumns =
    layout === 'grid' || layout === 'masonry'
      ? Math.max(1, Math.min(4, configuredColumns ?? defaultColumns))
      : defaultColumns
  const imageHeight = gridColumns >= 3 ? '55mm' : '62mm'

  return `
    <div style="margin-bottom: ${spacing.sectionSpacing};">
      <div style="
        display: grid;
        grid-template-columns: repeat(${gridColumns}, 1fr);
        gap: ${galleryGapMm}mm;
      ">
        ${photos.map((photo, index) => {
          const caption = showCaptions ? buildGalleryCaption(index, captionPosition, typography) : null
          return `
            <div style="
              border-radius: ${theme.blocks.borderRadius};
              overflow: hidden;
              background: ${colors.surfaceAlt};
              box-shadow: ${theme.blocks.shadow};
              position: relative;
              ${layout === 'polaroid' ? 'padding: 6mm 6mm 10mm 6mm; background: #fff;' : ''}
              ${layout === 'polaroid' ? `transform: rotate(${index % 2 === 0 ? '-1.2deg' : '1.1deg'});` : ''}
            ">
              ${caption && captionPosition === 'top' ? caption.wrapperStart + caption.wrapperEnd : ''}
              ${buildContainImage(photo, i18nT('export:services.pdf_export.generators.v2.runtime.pdfRuntimeMarkup.inlineGallery.foto_value1_2d93b666', { value1: index + 1 }), imageHeight, { onerrorBg: colors.surfaceAlt })}
              ${caption && captionPosition === 'overlay' ? caption.wrapperStart + caption.wrapperEnd : ''}
              ${caption && captionPosition === 'bottom' ? caption.wrapperStart + caption.wrapperEnd : ''}
            </div>
          `
        }).join('')}
      </div>
    </div>
  `
}

export function buildPdfTravelContentRuntimeData({
  travel,
  includeGallery,
  descriptionHtml,
  parseBlocks,
  buildInlineGallerySection,
  buildSafeImageUrl,
}: BuildTravelContentRuntimeDataParams): TravelContentRuntimeData {
  const recommendationBlocks = travel.recommendation ? parseBlocks(travel.recommendation) : []
  const plusBlocks = travel.plus ? parseBlocks(travel.plus) : []
  const minusBlocks = travel.minus ? parseBlocks(travel.minus) : []

  const hasGalleryMedia =
    includeGallery !== false &&
    (travel.gallery || []).some((item) => !!buildSafeImageUrl(typeof item === 'string' ? item : item?.url))

  return {
    descriptionHtml,
    recommendationBlocks,
    plusBlocks,
    minusBlocks,
    inlineGalleryHtml: buildInlineGallerySection(),
    hasGalleryMedia,
  }
}
