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

const CHECKLIST_ICONS: Record<BookSettings['checklistSections'][number], string> = {
  clothing: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z"/></svg>',
  food: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
  electronics: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg>',
  documents: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  medicine: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
}

const CHECKLIST_TINTS: Record<BookSettings['checklistSections'][number], string> = {
  clothing: 'rgba(99,102,241,0.06)',
  food: 'rgba(245,158,11,0.06)',
  electronics: 'rgba(59,130,246,0.06)',
  documents: 'rgba(16,185,129,0.06)',
  medicine: 'rgba(239,68,68,0.06)',
}

type PdfTheme = ReturnType<typeof getThemeConfig>

export function renderTocPageSection(args: {
  meta: TravelSectionMeta[]
  pageNumber: number
  totalCount: number
  startIndex: number
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
    totalCount,
    startIndex,
    theme,
    escapeHtml,
    buildSafeImageUrl,
    formatDays,
    getTravelLabel,
    getImageFilterStyle,
  } = args
  const { colors, typography, spacing } = theme

  const thumbW = 110
  const thumbH = 76

  const tocItems = meta
    .map((item, index) => {
      return buildTocRow(item, startIndex + index, meta.length - 1 === index, colors, typography, getImageFilterStyle, buildSafeImageUrl, escapeHtml, formatDays, false, thumbW, thumbH)
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
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 2px;
        ">
          <div style="
            width: 1px;
            height: 28px;
            background: ${colors.border};
          "></div>
          <div style="text-align: right;">
            <div style="
              font-size: 18pt;
              font-weight: 800;
              color: ${colors.accent};
            font-family: ${typography.headingFont};
            letter-spacing: -0.04em;
            line-height: 1;
            ">${totalCount}</div>
            <div style="
              font-size: 8pt;
              color: ${colors.textMuted};
              font-family: ${typography.bodyFont};
              margin-top: 2px;
            ">${getTravelLabel(totalCount)}</div>
          </div>
        </div>
      </div>

      <div style="flex: 1;">
        ${tocItems}
      </div>

      <div style="
        margin-top: auto;
        padding-top: 5mm;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1.5px;
          background: linear-gradient(90deg, ${colors.accent}, ${colors.border} 40%, transparent);
          border-radius: 999px;
        "></div>
        <span style="
          font-size: 7.5pt;
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
          letter-spacing: 0.06em;
          font-weight: 600;
        ">METRAVEL.BY</span>
        <span style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: ${colors.accentSoft};
          color: ${colors.accentStrong};
          font-size: 8pt;
          font-weight: 700;
          font-family: ${typography.headingFont};
        ">${pageNumber}</span>
      </div>
    </section>
  `
}

function buildTocRow(
  item: TravelSectionMeta,
  index: number,
  isLast: boolean,
  colors: { surface: string; surfaceAlt: string; accentSoft: string; accentLight: string; accent: string; accentStrong: string; text: string; textMuted: string; border: string; borderLight?: string },
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
      gap: 14px;
      padding: ${use2Col ? '10px 0' : '14px 0'};
      ${!isLast ? `border-bottom: 1px solid ${colors.borderLight || colors.border};` : ''}
    ">
      <span style="
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: ${colors.accentSoft};
        color: ${colors.accentStrong};
        font-size: 8pt;
        font-weight: 700;
        font-family: ${typography.headingFont};
        flex-shrink: 0;
        line-height: 1;
      ">${String(index + 1).padStart(2, '0')}</span>

      <div style="
        width: ${thumbW}px;
        height: ${thumbH}px;
        flex-shrink: 0;
        border-radius: 10px;
        overflow: hidden;
        background: ${colors.surfaceAlt};
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      ">
        ${thumbUrl ? `
          <img src="${escapeHtml(thumbUrl)}" alt=""
            style="width: 100%; height: 100%; object-fit: cover; display: block; ${getImageFilterStyle()}"
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
          margin-bottom: 2px;
          overflow-wrap: break-word;
          word-break: normal;
          hyphens: auto;
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
        flex: 0 1 auto;
        border-bottom: 1px dotted ${colors.border};
        min-width: 12px;
        height: 1px;
        margin-bottom: 5px;
        align-self: flex-end;
      "></div>

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
      key: section,
      label: CHECKLIST_LABELS[section] || 'Секция',
      items: CHECKLIST_LIBRARY[section] || [],
      icon: CHECKLIST_ICONS[section] || '',
      tint: CHECKLIST_TINTS[section] || 'transparent',
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
          background: ${section.tint};
          box-shadow: ${theme.blocks.shadow};
          break-inside: avoid;
          page-break-inside: avoid;
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: ${spacing.elementSpacing};
            padding-bottom: 8px;
            border-bottom: 2px solid ${colors.accentSoft};
          ">
            <span style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 32px;
              height: 32px;
              border-radius: 8px;
              background: ${colors.accentSoft};
              color: ${colors.accent};
              flex-shrink: 0;
            ">${section.icon}</span>
            <div>
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
          </div>
          <div style="
            margin: 0;
            color: ${colors.text};
            font-size: ${typography.body.size};
            line-height: ${typography.body.lineHeight};
            font-family: ${typography.bodyFont};
            word-break: break-word;
          ">
            ${section.items
              .map(
                (item) => `
                  <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
                    <span style="
                      display: inline-block;
                      width: 18px;
                      height: 18px;
                      min-width: 18px;
                      border: 2px solid ${colors.border};
                      border-radius: 4px;
                      margin-top: 2px;
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
      <div style="margin-bottom: ${spacing.sectionSpacing};">
        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 4mm;
        ">
          <div style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: ${colors.accentSoft};
          ">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${colors.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div>
            <h2 style="
              font-size: ${typography.h2.size};
              font-weight: ${typography.h2.weight};
              margin: 0;
              letter-spacing: -0.01em;
              color: ${colors.text};
              font-family: ${typography.headingFont};
            ">Чек-листы путешествия</h2>
            <p style="
              color: ${colors.textMuted};
              font-size: ${typography.small.size};
              font-family: ${typography.bodyFont};
              margin: 2px 0 0 0;
            ">Подходит для печати и отметок ручкой</p>
          </div>
        </div>
        <div style="
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, ${colors.accent}, ${colors.border} 40%, transparent);
          border-radius: 999px;
        "></div>
      </div>
      <div style="
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: ${spacing.elementSpacing};
      ">
        ${cards}
      </div>
    </section>
  `
}
