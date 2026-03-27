import type { BookSettings } from '@/components/export/BookSettingsModal'
import { getThemeConfig } from '../../../themes/PdfThemeConfig'

import type { TravelSectionMeta } from './types'

const CHECKLIST_LIBRARY: Record<BookSettings['checklistSections'][number], string[]> = {
  clothing: ['Термобельё', 'Тёплый слой/флис', 'Дождевик/пончо', 'Треккинговая обувь', 'Шапка, перчатки, бафф'],
  food: ['Перекусы', 'Термос', 'Походная посуда', 'Мультитул/нож', 'Фильтр или запас воды'],
  electronics: ['Повербанк', 'Камера/GoPro', 'Переходники', 'Налобный фонарь', 'Запасные карты памяти'],
  documents: ['Паспорт', 'Билеты/бронирования', 'Страховка', 'Водительские права', 'Список контактов'],
  medicine: ['Индивидуальные лекарства', 'Пластыри и бинт', 'Средство от насекомых', 'Солнцезащита', 'Антисептик'],
}

const CHECKLIST_LABELS: Record<BookSettings['checklistSections'][number], string> = {
  clothing: 'Одежда',
  food: 'Еда',
  electronics: 'Электроника',
  documents: 'Документы',
  medicine: 'Аптечка',
}

type PdfTheme = ReturnType<typeof getThemeConfig>

export function renderTocPageSection(args: {
  meta: TravelSectionMeta[]
  pageNumber: number
  theme: PdfTheme
  escapeHtml: (value: string) => string
  buildSafeImageUrl: (raw?: string | null) => string | undefined
  formatDays: (days?: number | string | null) => string
  getTravelLabel: (count: number) => string
  renderPdfIcon: (
    name: 'camera' | 'pen' | 'bulb' | 'warning' | 'sparkle' | 'globe' | 'calendar' | 'clock' | 'map-pin',
    color: string,
    size: number,
  ) => string
  getImageFilterStyle: () => string
}): string {
  const {
    meta,
    pageNumber,
    theme,
    escapeHtml,
    buildSafeImageUrl,
    formatDays,
    getTravelLabel,
    renderPdfIcon,
    getImageFilterStyle,
  } = args
  const { colors, typography, spacing } = theme
  const isCompactToc = meta.length <= 2
  const tocItems = meta
    .map((item, index) => {
      const travel = item.travel
      const country = travel.countryName ? escapeHtml(travel.countryName) : ''
      const year = travel.year ? escapeHtml(String(travel.year)) : ''
      const days = formatDays(travel.number_days)
      const metaLine = [country, year, days].filter(Boolean).join(' \u2022 ')
      const thumbUrl = buildSafeImageUrl(travel.travel_image_thumb_url || travel.travel_image_url)
      const previewSize = isCompactToc ? 56 : 40
      const cardPadding = isCompactToc ? '16px 18px' : '12px 16px'
      const titleFontSize = isCompactToc ? '14pt' : '13pt'
      const metaFontSize = isCompactToc ? '10pt' : '9.5pt'
      const badgeSize = isCompactToc ? 36 : 32

      return `
        <div style="
          display: flex;
          align-items: stretch;
          background: ${colors.surface};
          border-radius: ${theme.blocks.borderRadius};
          border: ${theme.blocks.borderWidth} solid ${colors.border};
          box-shadow: ${theme.blocks.shadow};
          overflow: hidden;
        ">
          ${thumbUrl ? `
            <div style="
              width: ${previewSize}px;
              min-height: ${previewSize}px;
              flex-shrink: 0;
              position: relative;
              overflow: hidden;
              background: ${colors.surfaceAlt};
            ">
              <img src="${escapeHtml(thumbUrl)}" alt=""
                style="width: 100%; height: 100%; object-fit: cover; display: block; ${getImageFilterStyle()}"
                crossorigin="anonymous"
                onerror="this.style.display='none';this.parentElement.style.background='${colors.accentSoft}';" />
            </div>
          ` : `
            <div style="
              width: ${previewSize}px;
              min-height: ${previewSize}px;
              flex-shrink: 0;
              background: linear-gradient(135deg, ${colors.accentSoft} 0%, ${colors.accentLight} 100%);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <span style="
                font-size: 18pt;
                font-weight: 800;
                color: ${colors.accent};
                font-family: ${typography.headingFont};
                opacity: 0.7;
              ">${index + 1}</span>
            </div>
          `}
          <div style="
            flex: 1;
            min-width: 0;
            padding: ${cardPadding};
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          ">
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-weight: 600;
                font-size: ${titleFontSize};
                margin-bottom: 3px;
                color: ${colors.text};
                line-height: 1.3;
                font-family: ${typography.headingFont};
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">${escapeHtml(travel.name)}</div>
              ${metaLine ? `
                <div style="
                  font-size: ${metaFontSize};
                  color: ${colors.textMuted};
                  font-family: ${typography.bodyFont};
                  line-height: 1.4;
                ">${metaLine}</div>
              ` : ''}
            </div>
            <div style="
              width: ${badgeSize}px;
              height: ${badgeSize}px;
              border-radius: 999px;
              background: ${colors.accentSoft};
              color: ${colors.accent};
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: 12pt;
              flex-shrink: 0;
              font-family: ${typography.headingFont};
            ">${item.startPage}</div>
          </div>
        </div>
      `
    })
    .join('')

  return `
    <section class="pdf-page toc-page" style="
      padding: ${spacing.pagePadding};
      background: ${colors.background};
      display: flex;
      flex-direction: column;
    ">
      <div style="
        text-align: center;
        margin-top: ${isCompactToc ? '10mm' : '14mm'};
        margin-bottom: ${isCompactToc ? '8mm' : '10mm'};
      ">
        <div style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: ${colors.accentSoft};
          margin-bottom: 10px;
        ">
          ${renderPdfIcon('map-pin', colors.accent, 22)}
        </div>
        <h2 style="
          font-size: ${typography.h1.size};
          margin-bottom: 6px;
          font-weight: ${typography.h1.weight};
          color: ${colors.text};
          letter-spacing: -0.02em;
          font-family: ${typography.headingFont};
        ">Содержание</h2>
        <p style="
          color: ${colors.textMuted};
          font-size: ${typography.body.size};
          font-family: ${typography.bodyFont};
          margin: 0 0 6px 0;
        ">${meta.length} ${getTravelLabel(meta.length)}</p>
        <div style="
          width: 40mm;
          height: 3px;
          margin: 0 auto;
          background: linear-gradient(90deg, transparent, ${colors.accent}, transparent);
          border-radius: 999px;
        "></div>
      </div>
      <div style="
        display: flex;
        flex-direction: column;
        gap: ${isCompactToc ? '12px' : '8px'};
        justify-content: ${isCompactToc ? 'center' : 'flex-start'};
        flex: 1;
        max-width: ${isCompactToc ? '156mm' : '100%'};
        width: 100%;
        margin: 0 auto;
      ">
        ${tocItems}
      </div>
      <div style="
        position: absolute;
        bottom: 15mm;
        right: 25mm;
        font-size: ${typography.caption.size};
        color: ${colors.textMuted};
        font-family: ${typography.bodyFont};
      ">${pageNumber}</div>
    </section>
  `
}

export function renderChecklistPageSection(args: {
  settings: BookSettings
  pageNumber: number
  theme: PdfTheme
  escapeHtml: (value: string) => string
  buildRunningHeader: (title: string, pageNumber: number) => string
}): string | null {
  const { settings, pageNumber, theme, escapeHtml, buildRunningHeader } = args

  if (!settings.checklistSections || !settings.checklistSections.length) {
    return null
  }

  const { colors, typography, spacing } = theme
  const sections = settings.checklistSections
    .map((section) => ({
      label: CHECKLIST_LABELS[section] || 'Секция',
      items: CHECKLIST_LIBRARY[section] || [],
    }))
    .filter((section) => section.items.length > 0)

  if (!sections.length) return null

  const cards = sections
    .map(
      (section) => `
        <div style="
          border: ${theme.blocks.borderWidth} solid ${colors.border};
          border-radius: ${theme.blocks.borderRadius};
          padding: ${spacing.blockSpacing};
          background: ${colors.surface};
          box-shadow: ${theme.blocks.shadow};
          break-inside: avoid;
          page-break-inside: avoid;
        ">
          <div style="
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
            margin-bottom: ${spacing.elementSpacing};
          ">
            <h3 style="
              margin: 0;
              font-size: ${typography.h4.size};
              font-weight: ${typography.h4.weight};
              color: ${colors.text};
              font-family: ${typography.headingFont};
              max-width: 100%;
              word-break: break-word;
              line-height: 1.2;
            ">${section.label}</h3>
            <span style="
              font-size: ${typography.caption.size};
              color: ${colors.textMuted};
              font-weight: 600;
              font-family: ${typography.bodyFont};
              line-height: 1.2;
            ">${section.items.length} пунктов</span>
          </div>
          <div style="
            margin: 0;
            color: ${colors.textMuted};
            font-size: ${typography.body.size};
            line-height: ${typography.body.lineHeight};
            font-family: ${typography.bodyFont};
            word-break: break-word;
          ">
            ${section.items
              .map(
                (item) => `
                  <div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px;">
                    <span style="
                      display: inline-block;
                      width: 12px;
                      height: 12px;
                      min-width: 12px;
                      border: 1.5px solid ${colors.border};
                      border-radius: 2px;
                      margin-top: 3px;
                      flex-shrink: 0;
                    "></span>
                    <span>${escapeHtml(item)}</span>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>
      `,
    )
    .join('')

  return `
    <section class="pdf-page checklist-page" style="padding: ${spacing.pagePadding};">
      ${buildRunningHeader('Чек-листы', pageNumber)}
      <div style="text-align: center; margin-bottom: ${spacing.sectionSpacing};">
        <div style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: ${colors.accentSoft};
          margin-bottom: 8px;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${colors.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <h2 style="
          font-size: ${typography.h2.size};
          font-weight: ${typography.h2.weight};
          margin-bottom: ${spacing.elementSpacing};
          letter-spacing: -0.01em;
          color: ${colors.text};
          font-family: ${typography.headingFont};
        ">Чек-листы путешествия</h2>
        <p style="
          color: ${colors.textMuted};
          font-size: ${typography.body.size};
          font-family: ${typography.bodyFont};
        ">Подходит для печати и отметок</p>
      </div>
      <div style="
        display: grid;
        grid-template-columns: repeat(${sections.length >= 4 ? 2 : 3}, minmax(0, 1fr));
        gap: ${spacing.elementSpacing};
      ">
        ${cards}
      </div>
    </section>
  `
}
