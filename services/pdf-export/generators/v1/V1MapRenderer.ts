/**
 * V1 Map page renderer — extracted from EnhancedPdfGenerator.renderMapPage
 *
 * Accepts pre-computed map data (snapshot/SVG, location list HTML)
 * since async operations (Leaflet, QR codes) remain in the orchestrator.
 */

import { escapeHtml } from '../../utils/htmlUtils';
import { buildRunningHeader, getImageFilterStyle, type V1RenderContext } from './V1RenderHelpers';

export interface V1MapPageData {
  travelName: string;
  snapshotDataUrl: string | null;
  mapSvg: string;
  locationListHtml: string;
  locationCount: number;
  pageNumber: number;
}

export class V1MapRenderer {
  constructor(private ctx: V1RenderContext) {}

  render(data: V1MapPageData): string {
    const { colors, typography, spacing } = this.ctx.theme;
    const mapHeightMm = this.getMapHeightMm(data.locationCount);

    return `
      <section class="pdf-page map-page" style="padding: ${spacing.pagePadding}; height: 285mm; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
        ${buildRunningHeader(this.ctx, data.travelName, data.pageNumber)}
        <div style="margin-bottom: 4mm;">
          <div style="
            background: linear-gradient(135deg, ${colors.surfaceAlt} 0%, ${colors.surface} 100%);
            border-radius: ${this.ctx.theme.blocks.borderRadius};
            padding: 10px;
            border: ${this.ctx.theme.blocks.borderWidth} solid ${colors.border};
            box-shadow: ${this.ctx.theme.blocks.shadow};
          ">
            <div style="
              border-radius: ${this.ctx.theme.blocks.borderRadius};
              overflow: hidden;
              height: ${mapHeightMm}mm;
            ">
              ${data.snapshotDataUrl ? `
                <img src="${escapeHtml(data.snapshotDataUrl)}" alt="Карта маршрута"
                  style="width: 100%; height: 100%; display: block; object-fit: cover; ${getImageFilterStyle(this.ctx)}" />
              ` : `
                ${data.mapSvg}
              `}
            </div>
          </div>
        </div>
        <div>
          <h2 style="
            font-size: ${typography.h2.size};
            margin-bottom: 4mm;
            font-family: ${typography.headingFont};
          ">Маршрут</h2>
          <p style="
            color: ${colors.textMuted};
            margin-bottom: 3mm;
            font-size: 10pt;
            font-family: ${typography.bodyFont};
          ">${escapeHtml(data.travelName)}</p>
          <div>${data.locationListHtml}</div>
        </div>
      </section>
    `;
  }

  private getMapHeightMm(locationCount: number): number {
    if (locationCount <= 1) return 125;
    if (locationCount === 2) return 96;
    if (locationCount === 3) return 86;
    if (locationCount === 4) return 78;
    return 72;
  }
}
