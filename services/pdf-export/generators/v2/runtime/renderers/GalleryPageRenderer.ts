import type { TravelForBook } from '@/types/pdf-export'
import type { GalleryLayout } from '@/types/pdf-gallery'
import { calculateOptimalColumns } from '@/types/pdf-gallery'
import { escapeHtml, type RuntimeRenderContext, buildRunningHeader, getImageFilterStyle } from './renderHelpers'
import { buildSafeImageUrl } from '../../../../utils/htmlUtils'
import { translate as i18nT } from '@/i18n'


interface GalleryPagePhoto {
  url: string
  caption?: string
  // width / height; замеряется в браузере до генерации (EnhancedPdfGeneratorBase),
  // measured=false → пропорция неизвестна, фото рендерится через contain+blur letterbox
  aspect: number
  measured: boolean
}

interface JustifiedRowsResult {
  rows: GalleryPagePhoto[][]
  rowHeights: number[]
}

const FALLBACK_ASPECT = 4 / 3
const PAGE_WIDTH_MM = 210
// Блок подписи под фото: текст (2 строки 7.5pt) + отступ до фото
const CAPTION_BLOCK_MM = 8
const CAPTION_GAP_MM = 1.6

export class RuntimeGalleryRenderer {
  private imageAspects: Map<string, number> = new Map()

  constructor(private ctx: RuntimeRenderContext) {}

  setImageAspects(aspects: Map<string, number>): void {
    this.imageAspects = aspects
  }

  renderPages(travel: TravelForBook, startPageNumber: number): string[] {
    const { colors, spacing } = this.ctx.theme
    const photos: GalleryPagePhoto[] = (travel.gallery || [])
      .map((item): GalleryPagePhoto | null => {
        const raw = typeof item === 'string' ? item : item?.url
        const url = buildSafeImageUrl(raw)
        if (!url || !url.trim().length) return null
        const rawCaption = typeof item === 'string' ? undefined : item?.caption
        const caption = typeof rawCaption === 'string' && rawCaption.trim() ? rawCaption.trim() : undefined
        const measuredAspect = this.imageAspects.get(url)
        const hasAspect = typeof measuredAspect === 'number' && Number.isFinite(measuredAspect) && measuredAspect > 0
        return {
          url,
          caption,
          aspect: hasAspect ? Math.min(3.2, Math.max(0.3, measuredAspect)) : FALLBACK_ASPECT,
          measured: hasAspect,
        }
      })
      .filter((p): p is GalleryPagePhoto => !!p)

    if (!photos.length) return []

    const { layout, columns: configuredColumns, spacing: gallerySpacing, showCaptions } = this.getGalleryOptions()
    const twoPerPageLayout = this.ctx.settings?.galleryTwoPerPageLayout || 'vertical'

    const gapMm = this.getGalleryGapMm(gallerySpacing)
    const pagePaddingMm = this.parseMm(spacing.pagePadding, 25)
    const runningHeaderMm = 14
    // Реальная высота печатной страницы: 297mm − 12mm нижняя полоса под нативный
    // номер страницы (@page @bottom-center, #299). Бюджет контента считаем именно
    // от неё, вычитая отступы, running-header и высокий заголовок «Фотогалерея» на
    // первой странице. Иначе сетка фото получает завышенный бюджет и нижний ряд
    // срезается через overflow:hidden (#300).
    const printablePageHeightMm = 285
    const galleryHeaderMm = 16
    const safetyMm = 4
    const availableContentHeightMm = Math.max(
      150,
      printablePageHeightMm - pagePaddingMm * 2 - runningHeaderMm - galleryHeaderMm - safetyMm
    )
    const contentWidthMm = Math.max(100, PAGE_WIDTH_MM - pagePaddingMm * 2)

    const photosPerPage = this.getGalleryPhotosPerPage(layout, photos.length)
    const chunks: GalleryPagePhoto[][] = []
    for (let start = 0; start < photos.length; start += photosPerPage) {
      chunks.push(photos.slice(start, start + photosPerPage))
    }

    const totalPhotos = photos.length
    const useFramedGrid = layout === 'collage' || layout === 'polaroid'

    return chunks.map((pagePhotos, pageIndex) => {
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
          ">${i18nT("export:services.pdf_export.generators.v2.runtime.renderers.GalleryPageRenderer.div_style_display_flex_align_items_center_ga_5dd34671.text01")}</span>
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
          ">${i18nT("export:services.pdf_export.generators.v2.runtime.renderers.GalleryPageRenderer.div_style_display_flex_align_items_center_ga_5dd34671.text02", { value8: totalPhotos })}</span>
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
          ">${i18nT("export:services.pdf_export.generators.v2.runtime.renderers.GalleryPageRenderer.div_style_display_flex_justify_content_flex__7df416fd.text01", { value4: rangeStart, value5: rangeEnd, value6: totalPhotos })}</span>
        </div>
      ` : ''

      const bodyHtml = useFramedGrid
        ? this.renderFramedGridBody({
            pagePhotos,
            layout,
            configuredColumns,
            twoPerPageLayout,
            photosPerPage,
            gapMm,
            availableContentHeightMm,
            globalStartIndex,
            showCaptions,
          })
        : this.renderJustifiedBody({
            pagePhotos,
            contentWidthMm,
            contentHeightMm: availableContentHeightMm,
            gapMm,
            globalStartIndex,
            showCaptions,
          })

      return `
      <section class="pdf-page gallery-page" style="padding: ${spacing.pagePadding}; height: 285mm; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
        ${buildRunningHeader(this.ctx, travel.name, pageNumber)}
        ${galleryHeaderHtml}
        ${continuationHeaderHtml}
        ${bodyHtml}
      </section>
    `
    })
  }

  renderSinglePage(travel: TravelForBook, pageNumber: number): string {
    return this.renderPages(travel, pageNumber)[0] || ''
  }

  /**
   * Journal-раскладка: фото страницы раскладываются по рядам с сохранением
   * собственных пропорций каждого снимка — ряд всегда заполняет ширину страницы,
   * перебором выбирается разбиение с максимальным покрытием площади страницы.
   * Бокс каждого фото совпадает с его aspect-ratio, поэтому серых letterbox-полей нет.
   */
  private renderJustifiedBody(params: {
    pagePhotos: GalleryPagePhoto[]
    contentWidthMm: number
    contentHeightMm: number
    gapMm: number
    globalStartIndex: number
    showCaptions: boolean
  }): string {
    const { pagePhotos, contentWidthMm, contentHeightMm, gapMm, globalStartIndex, showCaptions } = params
    const { rows, rowHeights } = this.pickBestRowPartition(
      pagePhotos,
      contentWidthMm,
      contentHeightMm,
      gapMm,
      showCaptions
    )

    let photoOffset = 0
    const rowsHtml = rows
      .map((row, rowIndex) => {
        const rowHeightMm = rowHeights[rowIndex]
        const items = row
          .map((photo) => {
            const globalIndex = globalStartIndex + photoOffset
            photoOffset += 1
            return this.renderJustifiedPhoto(photo, photo.aspect * rowHeightMm, rowHeightMm, globalIndex, showCaptions)
          })
          .join('')
        const marginBottom = rowIndex === rows.length - 1 ? 0 : gapMm
        return `
          <div class="gallery-justified-row" style="
            display: flex;
            justify-content: center;
            align-items: flex-start;
            gap: ${gapMm}mm;
            margin-bottom: ${marginBottom}mm;
          ">${items}</div>`
      })
      .join('')

    // Вертикальное центрирование в бюджете контента: страница с малым числом фото
    // выглядит сбалансированно, а не прижатой к шапке. Высота контейнера равна
    // рассчитанному бюджету, поэтому за пределы печатной страницы он не выходит.
    return `
      <div style="
        width: 100%;
        height: ${contentHeightMm}mm;
        display: flex;
        flex-direction: column;
        justify-content: center;
      ">${rowsHtml}</div>`
  }

  private renderJustifiedPhoto(
    photo: GalleryPagePhoto,
    widthMm: number,
    heightMm: number,
    globalIndex: number,
    showCaptions: boolean
  ): string {
    const { colors } = this.ctx.theme
    const borderRadiusValue = this.increaseBorderRadius(this.ctx.theme.blocks.borderRadius, 2)
    const caption = showCaptions ? photo.caption : undefined
    const captionHtml = caption
      ? `
        <figcaption style="
          height: ${CAPTION_BLOCK_MM - CAPTION_GAP_MM}mm;
          margin-top: ${CAPTION_GAP_MM}mm;
          overflow: hidden;
          font-size: 7.5pt;
          line-height: 1.3;
          text-align: center;
          color: ${colors.textSecondary || '#666'};
          font-family: ${this.ctx.theme.typography.bodyFont};
        ">${escapeHtml(caption)}</figcaption>`
      : ''

    return `
      <figure class="gallery-photo-frame" style="margin: 0; width: ${widthMm.toFixed(2)}mm; flex: 0 0 auto; min-width: 0;">
        <div style="
          position: relative;
          width: 100%;
          height: ${heightMm.toFixed(2)}mm;
          border-radius: ${borderRadiusValue};
          overflow: hidden;
          box-shadow: ${this.ctx.theme.blocks.shadow};
          background: ${colors.surfaceAlt};
        ">
          <img src="${escapeHtml(photo.url)}" alt=""
            loading="eager" decoding="sync" aria-hidden="true"
            style="
              position: absolute;
              top: 0; left: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
              filter: blur(28px) brightness(0.55) saturate(0.4);
              transform: scale(1.2);
              ${getImageFilterStyle(this.ctx)}
            "
            onerror="this.style.display='none';" />
          <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(caption || i18nT('export:services.pdfExport.runtime.gallery.photoAlt', { value1: globalIndex + 1 }))}"
            loading="eager" decoding="sync"
            style="
              position: relative;
              width: 100%;
              height: 100%;
              object-fit: contain;
              display: block;
              z-index: 1;
              ${getImageFilterStyle(this.ctx)}
            "
            onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
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
        </div>
        ${captionHtml}
      </figure>`
  }

  private pickBestRowPartition(
    photos: GalleryPagePhoto[],
    contentWidthMm: number,
    contentHeightMm: number,
    gapMm: number,
    showCaptions: boolean
  ): JustifiedRowsResult {
    const n = photos.length
    const candidates =
      n <= 12
        ? this.enumeratePartitions(n)
        : [this.greedyPartition(photos, contentWidthMm, contentHeightMm)]

    let best: JustifiedRowsResult | null = null
    let bestCoverage = -1
    for (const bounds of candidates) {
      const rows = bounds.map(([start, end]) => photos.slice(start, end))
      const evaluated = this.evaluateRows(rows, contentWidthMm, contentHeightMm, gapMm, showCaptions)
      if (evaluated && evaluated.coverage > bestCoverage) {
        bestCoverage = evaluated.coverage
        best = { rows, rowHeights: evaluated.rowHeights }
      }
    }
    // candidates всегда содержит партицию из одного ряда — best гарантированно найден
    return best || { rows: [photos], rowHeights: [contentHeightMm] }
  }

  private evaluateRows(
    rows: GalleryPagePhoto[][],
    contentWidthMm: number,
    contentHeightMm: number,
    gapMm: number,
    showCaptions: boolean
  ): { coverage: number; rowHeights: number[] } | null {
    const rowData = rows.map((row) => {
      const aspectSum = row.reduce((sum, p) => sum + p.aspect, 0)
      const innerWidthMm = contentWidthMm - gapMm * (row.length - 1)
      if (innerWidthMm <= 0 || aspectSum <= 0) return null
      const rawHeightMm = innerWidthMm / aspectSum
      const captionMm = showCaptions && row.some((p) => p.caption) ? CAPTION_BLOCK_MM : 0
      return { aspectSum, rawHeightMm, captionMm }
    })
    if (rowData.some((r) => !r)) return null
    const data = rowData as Array<{ aspectSum: number; rawHeightMm: number; captionMm: number }>

    const gapsTotalMm = gapMm * (rows.length - 1)
    const captionsTotalMm = data.reduce((sum, r) => sum + r.captionMm, 0)
    const rawHeightTotalMm = data.reduce((sum, r) => sum + r.rawHeightMm, 0)
    const heightBudgetMm = contentHeightMm - gapsTotalMm - captionsTotalMm
    if (heightBudgetMm <= 0) return null

    // Ряды считаются от полной ширины; если суммарно не влезают по высоте —
    // равномерно ужимаются (ряды становятся уже и центрируются, пропорции фото сохраняются)
    const scale = Math.min(1, heightBudgetMm / rawHeightTotalMm)
    const rowHeights = data.map((r) => r.rawHeightMm * scale)
    const photoAreaMm2 = data.reduce((sum, r, index) => sum + r.aspectSum * rowHeights[index] * rowHeights[index], 0)
    return {
      coverage: photoAreaMm2 / (contentWidthMm * contentHeightMm),
      rowHeights,
    }
  }

  /** Все разбиения n фото на последовательные ряды (битовая маска по n−1 границам) */
  private enumeratePartitions(n: number): Array<Array<[number, number]>> {
    const partitions: Array<Array<[number, number]>> = []
    const maskLimit = 1 << (n - 1)
    for (let mask = 0; mask < maskLimit; mask++) {
      const bounds: Array<[number, number]> = []
      let start = 0
      for (let i = 0; i < n - 1; i++) {
        if (mask & (1 << i)) {
          bounds.push([start, i + 1])
          start = i + 1
        }
      }
      bounds.push([start, n])
      partitions.push(bounds)
    }
    return partitions
  }

  /** Для больших страниц (galleryPhotosPerPage=0): жадная упаковка под целевую высоту ряда */
  private greedyPartition(
    photos: GalleryPagePhoto[],
    contentWidthMm: number,
    contentHeightMm: number
  ): Array<[number, number]> {
    const aspectSum = photos.reduce((sum, p) => sum + p.aspect, 0)
    const targetRowHeightMm = Math.max(40, Math.sqrt((contentWidthMm * contentHeightMm) / aspectSum))
    const bounds: Array<[number, number]> = []
    let start = 0
    let acc = 0
    for (let i = 0; i < photos.length; i++) {
      acc += photos[i].aspect
      if (acc * targetRowHeightMm >= contentWidthMm || i === photos.length - 1) {
        bounds.push([start, i + 1])
        start = i + 1
        acc = 0
      }
    }
    return bounds
  }

  /** Прежняя фиксированная сетка — для стилизованных пресетов collage и polaroid */
  private renderFramedGridBody(params: {
    pagePhotos: GalleryPagePhoto[]
    layout: GalleryLayout
    configuredColumns?: number
    twoPerPageLayout: string
    photosPerPage: number
    gapMm: number
    availableContentHeightMm: number
    globalStartIndex: number
    showCaptions: boolean
  }): string {
    const {
      pagePhotos,
      layout,
      configuredColumns,
      twoPerPageLayout,
      photosPerPage,
      gapMm,
      availableContentHeightMm,
      globalStartIndex,
      showCaptions,
    } = params
    const { colors } = this.ctx.theme

    const defaultColumns = calculateOptimalColumns(pagePhotos.length, layout)
    const isTwoPerPage = photosPerPage === 2 && pagePhotos.length === 2
    const printDefaultColumns = layout === 'collage'
      ? pagePhotos.length <= 1 ? 1 : 3
      : pagePhotos.length === 1
        ? 1
        : isTwoPerPage && twoPerPageLayout === 'vertical'
          ? 1
          : pagePhotos.length === 2
            ? 2
            : Math.min(2, defaultColumns)
    const columns = configuredColumns
      ? Math.max(1, Math.min(4, configuredColumns))
      : printDefaultColumns
    const estimatedRows = Math.max(1, Math.ceil(pagePhotos.length / Math.max(columns, 1)))
    const maxCardHeightMm = Math.max(
      72,
      Math.floor((availableContentHeightMm - gapMm * (estimatedRows - 1)) / estimatedRows)
    )
    const targetCardHeightMm =
      layout === 'collage'
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
                ? 110
                : 95
    const cardHeightMm = Math.min(targetCardHeightMm, maxCardHeightMm)
    const singleCardHeightMm = Math.min(210, availableContentHeightMm)
    const imageHeight = `${cardHeightMm}mm`
    const singleImageHeight = `${singleCardHeightMm}mm`

    const gridContainerStyle = `display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: ${gapMm}mm; align-items: stretch;`

    const itemsHtml = pagePhotos
      .map((photo, index) => {
        const globalIndex = globalStartIndex + index

        const polaroidRotation = index % 2 === 0 ? '-2.5deg' : '2.4deg'
        const polaroidStyle =
          layout === 'polaroid'
            ? `padding: 1.5mm; padding-bottom: 0; background: #fff; transform: rotate(${polaroidRotation});`
            : ''

        const collageHero = layout === 'collage' && index === 0
        const collageSpan = collageHero ? 'grid-column: span 2; grid-row: span 2;' : ''
        // Featured-ячейка коллажа охватывает grid-row: span 2, поэтому её высота
        // должна равняться двум рядам вторичных ячеек плюс разделяющий gap
        // (featured = 2×rowH + gap). Вычисляем от того же cardHeightMm, чтобы ряды
        // featured и secondary совпадали и коллаж точно помещался в printable-высоту
        // без среза нижнего ряда через overflow:hidden (#300).
        const collageHeroHeightMm = cardHeightMm * 2 + gapMm
        const resolvedHeight = collageHero ? `${collageHeroHeightMm}mm` : imageHeight
        const isSingle = pagePhotos.length === 1
        const imgHeightStyle = `height: ${isSingle ? singleImageHeight : resolvedHeight};`

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

        const polaroidCaptionText = showCaptions && photo.caption ? photo.caption : i18nT('export:services.pdf_export.generators.v2.runtime.renderers.GalleryPageRenderer.foto_value1_dddeabe9', { value1: globalIndex + 1 })
        const polaroidCaption = layout === 'polaroid' ? `
          <div style="
            height: 8mm;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            font-size: 8pt;
            color: ${colors.textSecondary || '#666'};
            font-family: ${this.ctx.theme.typography.bodyFont};
            font-weight: 500;
          ">${escapeHtml(polaroidCaptionText)}</div>
        ` : ''

        return `
      <div class="gallery-photo-frame" style="
        ${collageSpan}
        border-radius: ${borderRadiusValue};
        overflow: hidden;
        position: relative;
        box-shadow: ${this.ctx.theme.blocks.shadow};
        background: ${layout === 'polaroid' ? '#fff' : colors.surfaceAlt};
        ${polaroidStyle}
        ${layout === 'polaroid' ? 'display: flex; flex-direction: column;' : ''}
        ${layout === 'polaroid' ? '' : 'padding: 0;'}
      ">
        <div style="position: relative; width: 100%; ${imgHeightStyle} overflow: hidden; ${layout === 'polaroid' ? 'flex: 1;' : ''}">
          <img src="${escapeHtml(photo.url)}" alt=""
            loading="eager" decoding="sync" aria-hidden="true"
            style="
              position: absolute;
              top: 0; left: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
              filter: blur(28px) brightness(0.55) saturate(0.4);
              transform: scale(1.2);
              ${getImageFilterStyle(this.ctx)}
            "
            onerror="this.style.display='none';" />
          <img src="${escapeHtml(photo.url)}" alt="${i18nT("export:services.pdf_export.generators.v2.runtime.renderers.GalleryPageRenderer.div_class_gallery_photo_frame_style_value1_b_5f3278b4.text01", { value13: globalIndex + 1 })}"
            loading="eager" decoding="sync"
            style="
              position: relative;
              width: 100%;
              height: 100%;
              object-fit: contain;
              display: block;
              z-index: 1;
              ${getImageFilterStyle(this.ctx)}
            "
            onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
          ${numberBadge}
        </div>
        ${polaroidCaption}
      </div>
    `
      })
      .join('')

    return `<div style="${gridContainerStyle}">${itemsHtml}</div>`
  }

  private getGalleryOptions() {
    const settings = this.ctx.settings
    const layout: GalleryLayout = (settings?.galleryLayout as GalleryLayout) || 'grid'
    const columns = settings?.galleryColumns
    // Подписи включены по умолчанию (как в EnhancedPdfGeneratorBase) — выводятся,
    // только если у фото реально есть caption
    const showCaptions = settings?.showCaptions !== false
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
    // Для печати: по умолчанию 6 фото на страницу для читаемости
    if (layout === 'collage') return Math.min(totalPhotos, 5)
    return Math.min(totalPhotos, 6)
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
