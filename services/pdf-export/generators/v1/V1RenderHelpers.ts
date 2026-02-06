/**
 * Общие хелперы для V1 рендереров страниц.
 * Предоставляют доступ к теме, настройкам и утилитам HTML/pluralize.
 */

import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';
import { escapeHtml } from '../../utils/htmlUtils';
import { formatDays, getTravelLabel } from '../../utils/pluralize';

export { escapeHtml, formatDays, getTravelLabel };

export interface V1RenderContext {
  theme: PdfThemeConfig;
  settings?: BookSettings;
}

/**
 * Running header для контент-страниц
 */
export function buildRunningHeader(
  ctx: V1RenderContext,
  travelName: string,
  pageNumber: number
): string {
  const { colors, typography } = ctx.theme;
  return `
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 4mm;
      margin-bottom: 6mm;
      border-bottom: 0.5pt solid ${colors.border};
      font-size: ${typography.caption.size};
      color: ${colors.textMuted};
      font-family: ${typography.bodyFont};
      letter-spacing: 0.02em;
    ">
      <span style="
        max-width: 70%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      ">${escapeHtml(travelName)}</span>
      <span>${pageNumber}</span>
    </div>
  `;
}

/**
 * CSS-фильтр для изображений (сепия и т.п.)
 */
export function getImageFilterStyle(ctx: V1RenderContext): string {
  return ctx.theme.imageFilter ? `filter: ${ctx.theme.imageFilter};` : '';
}
