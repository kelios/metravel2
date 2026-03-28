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
    getImageFilterStyle,
  } = args
  const { colors, typography, spacing } = theme

  const use2Col = meta.length >= 6
  const thumbW = use2Col ? 62 : 72
  const thumbH = use2Col ? 46 : 52

  const tocItems = meta
    .map((item, index) => {
      const travel = item.travel
      const country = travel.countryName ? escapeHtml(travel.countryName) : ''
      const year = travel.year ? escapeHtml(String(travel.year)) : ''
      const days = formatDays(travel.number_days)
      const metaLine = [country, year, days].filter(Boolean).join(' \u2022 ')
      const thumbUrl = buildSafeImageUrl(travel.travel_image_thumb_url || travel.travel_image_url)
      const isLast = index === meta.length - 1

      return `
        <div style="
          display: flex;
          align-items: center;
          gap: 10px;
          padding: ${use2Col ? '7px 0' : '9px 0'};
          ${!isLast ? `border-bottom: 1px solid ${colors.borderLight || colors.border};` : ''}
        ">
          <span style="
            width: 18px;
            font-size: 7.5pt;
            font-weight: 700;
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
            text-align: right;
            flex-shrink: 0;
            opacity: 0.55;
            letter-spacing: 0.02em;
          ">${String(index + 1).padStart(2, '0')}</span>

          <div style="
            width: ${thumbW}px;
            height: ${thumbH}px;
            flex-shrink: 0;
            border-radius: 8px;
            overflow: hidden;
            background: ${colors.surfaceAlt};
          ">
            ${thumbUrl ? `
              <img src="${escapeHtml(thumbUrl)}" alt=""
                style="width: 100%; height: 100%; object-fit: cover; display: block; ${getImageFilterStyle()}"
                crossorigin="anonymous"
                onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,${colors.accentSoft},${colors.accentLight})';" />
            ` : `
              <div style="
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, ${colors.accentSoft} 0%, ${colors.accentLight} 100%);
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <span style="font-size: 14pt; font-weight: 800; color: ${colors.accent}; font-family: ${typography.headingFont}; opacity: 0.5;">${index + 1}</span>
              </div>
            `}
          </div>

          <div style="flex: 1; min-width: 0;">
            <div style="
              font-weight: 600;
              font-size: ${use2Col ? '9.5pt' : '11pt'};
              color: ${colors.text};
              line-height: 1.25;
              font-family: ${typography.headingFont};
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              margin-bottom: 2px;
            ">${escapeHtml(travel.name)}</div>
            ${metaLine ? `
              <div style="
                font-size: ${use2Col ? '7.5pt' : '8.5pt'};
                color: ${colors.textMuted};
                font-family: ${typography.bodyFont};
                line-height: 1.3;
              ">${metaLine}</div>
            ` : ''}
          </div>

          <div style="
            font-size: ${use2Col ? '14pt' : '16pt'};
            font-weight: 800;
            color: ${colors.accent};
            font-family: ${typography.headingFont};
            min-width: 22px;
            text-align: right;
            flex-shrink: 0;
            letter-spacing: -0.02em;
            line-height: 1;
          ">${item.startPage}</div>
        </div>
      `
    })
    .join('')

  const splitIndex = Math.ceil(meta.length / 2)
  const col1Items = meta.slice(0, splitIndex)
  const col2Items = meta.slice(splitIndex)

  const col1Html = col1Items
    .map((item, index) => buildTocRow(item, index, col1Items.length - 1 === index, colors, typography, getImageFilterStyle, buildSafeImageUrl, escapeHtml, formatDays, use2Col, thumbW, thumbH))
    .join('')
  const col2Html = col2Items
    .map((item, index) => buildTocRow(item, index + splitIndex, col2Items.length - 1 === index, colors, typography, getImageFilterStyle, buildSafeImageUrl, escapeHtml, formatDays, use2Col, thumbW, thumbH))
    .join('')

  return `
    <section class="pdf-page toc-page" style="
      padding: ${spacing.pagePadding};
      background: ${colors.background};
      display: flex;
      flex-direction: column;
    ">
      <div style="
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        margin-bottom: 7mm;
        padding-bottom: 5mm;
        border-bottom: 2px solid ${colors.text};
      ">
        <div>
          <div style="
            font-size: 7.5pt;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: ${colors.accent};
            font-family: ${typography.bodyFont};
            margin-bottom: 2mm;
          ">MeTravel · Книга путешествий</div>
          <h2 style="
            font-size: 28pt;
            font-weight: 800;
            color: ${colors.text};
            letter-spacing: -0.03em;
            font-family: ${typography.headingFont};
            line-height: 1;
            margin: 0;
          ">Содержание</h2>
        </div>
        <div style="
          text-align: right;
          padding-bottom: 2px;
        ">
          <div style="
            font-size: 22pt;
            font-weight: 800;
            color: ${colors.accent};
            font-family: ${typography.headingFont};
            letter-spacing: -0.04em;
            line-height: 1;
            opacity: 0.22;
          ">${meta.length}</div>
          <div style="
            font-size: 8pt;
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
            margin-top: 1px;
          ">${getTravelLabel(meta.length)}</div>
        </div>
      </div>

      ${use2Col ? `
        <div style="
          display: grid;
          grid-template-columns: 1fr 1px 1fr;
          gap: 0 6mm;
          flex: 1;
        ">
          <div>${col1Html}</div>
          <div style="background: ${colors.border}; width: 1px;"></div>
          <div>${col2Html}</div>
        </div>
      ` : `
        <div style="flex: 1;">
          ${tocItems}
        </div>
      `}

      <div style="
        margin-top: auto;
        padding-top: 5mm;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid ${colors.borderLight || colors.border};
      ">
        <span style="
          font-size: 7.5pt;
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
          opacity: 0.55;
          letter-spacing: 0.06em;
        ">METRAVEL.BY</span>
        <span style="
          font-size: 8pt;
          font-weight: 600;
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
        ">${pageNumber}</span>
      </div>
    </section>
  `
}

function buildTocRow(
  item: TravelSectionMeta,
  index: number,
  isLast: boolean,
  colors: { surface: string; surfaceAlt: string; accentSoft: string; accentLight: string; accent: string; text: string; textMuted: string; border: string; borderLight?: string },
  typography: { headingFont: string; bodyFont: string },
  getImageFilterStyle: () => string,
  buildSafeImageUrl: (url?: string | null) => string | undefined,
  escapeHtml: (v: string) => string,
  formatDays: (d?: number | string | null) => string,
  use2Col: boolean,
  thumbW: number,
  thumbH: number,
): string {
  const travel = item.travel
  const country = travel.countryName ? escapeHtml(travel.countryName) : ''
  const year = travel.year ? escapeHtml(String(travel.year)) : ''
  const days = formatDays(travel.number_days)
  const metaLine = [country, year, days].filter(Boolean).join(' \u2022 ')
  const thumbUrl = buildSafeImageUrl(travel.travel_image_thumb_url || travel.travel_image_url)

  return `
    <div style="
      display: flex;
      align-items: center;
      gap: 10px;
      padding: ${use2Col ? '7px 0' : '9px 0'};
      ${!isLast ? `border-bottom: 1px solid ${colors.borderLight || colors.border};` : ''}
    ">
      <span style="
        width: 18px;
        font-size: 7.5pt;
        font-weight: 700;
        color: ${colors.textMuted};
        font-family: ${typography.bodyFont};
        text-align: right;
        flex-shrink: 0;
        opacity: 0.55;
        letter-spacing: 0.02em;
      ">${String(index + 1).padStart(2, '0')}</span>

      <div style="
        width: ${thumbW}px;
        height: ${thumbH}px;
        flex-shrink: 0;
        border-radius: 8px;
        overflow: hidden;
        background: ${colors.surfaceAlt};
      ">
        ${thumbUrl ? `
          <img src="${escapeHtml(thumbUrl)}" alt=""
            style="width: 100%; height: 100%; object-fit: cover; display: block; ${getImageFilterStyle()}"
            crossorigin="anonymous"
            onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,${colors.accentSoft},${colors.accentLight})';" />
        ` : `
          <div style="
            width: 100%; height: 100%;
            background: linear-gradient(135deg, ${colors.accentSoft} 0%, ${colors.accentLight} 100%);
            display: flex; align-items: center; justify-content: center;
          ">
            <span style="font-size: 13pt; font-weight: 800; color: ${colors.accent}; font-family: ${typography.headingFont}; opacity: 0.5;">${index + 1}</span>
          </div>
        `}
      </div>

      <div style="flex: 1; min-width: 0;">
        <div style="
          font-weight: 600;
          font-size: ${use2Col ? '9.5pt' : '11pt'};
          color: ${colors.text};
          line-height: 1.25;
          font-family: ${typography.headingFont};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-bottom: 2px;
        ">${escapeHtml(travel.name)}</div>
        ${metaLine ? `
          <div style="
            font-size: ${use2Col ? '7.5pt' : '8.5pt'};
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
            line-height: 1.3;
          ">${metaLine}</div>
        ` : ''}
      </div>

      <div style="
        font-size: ${use2Col ? '14pt' : '16pt'};
        font-weight: 800;
        color: ${colors.accent};
        font-family: ${typography.headingFont};
        min-width: 20px;
        text-align: right;
        flex-shrink: 0;
        letter-spacing: -0.02em;
        line-height: 1;
      ">${item.startPage}</div>
    </div>
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
