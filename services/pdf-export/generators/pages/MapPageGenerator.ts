// src/services/pdf-export/generators/pages/MapPageGenerator.ts
// Legacy compatibility adapter for the old pages/* API.

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';
import { escapeHtml } from '../../utils/htmlUtils';
import { getLocationLabel } from '../../utils/pluralize';
import type { TravelForBook } from '@/types/pdf-export';
import { buildMapPlaceholder, buildRouteSvg, parseCoordinates } from '../v2/runtime/bookData';

export interface MapLocation {
  id: string;
  address: string;
  coord: string;
  categoryName?: string;
  travelImageThumbUrl?: string;
}

export class MapPageGenerator {
  constructor(private theme: PdfThemeConfig) {}

  async generate(
    travel: TravelForBook,
    locations: MapLocation[],
    pageNumber: number
  ): Promise<string> {
    const { colors, spacing, typography } = this.theme;
    const normalized = locations.map((location) => {
      const coords = parseCoordinates(location.coord);
      return {
        ...location,
        lat: coords?.lat,
        lng: coords?.lng,
      };
    });
    const hasCoords = normalized.some((location) => typeof location.lat === 'number' && typeof location.lng === 'number');
    const mapSvg = hasCoords ? buildRouteSvg(normalized, this.theme) : buildMapPlaceholder(this.theme);
    const mapImageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(mapSvg)}`;

    return `
      <section class="pdf-page map-page" style="
        padding: ${spacing.pagePadding};
        background: ${colors.background};
        position: relative;
      ">
        <div style="margin-bottom: 12mm;">
          <h2 style="
            font-size: ${typography.h2.size};
            font-weight: ${typography.h2.weight};
            margin: 0 0 4mm 0;
            color: ${colors.text};
            font-family: ${typography.headingFont};
          ">Карта путешествия</h2>
          <div style="
            font-size: 12pt;
            color: ${colors.textSecondary};
            font-family: ${typography.bodyFont};
          ">${escapeHtml(travel.name)}</div>
        </div>
        <div style="
          width: 100%;
          height: 160mm;
          margin-bottom: 12mm;
          border-radius: ${this.theme.blocks.borderRadius};
          overflow: hidden;
          background: ${colors.surfaceAlt};
          box-shadow: ${this.theme.blocks.shadow};
          border: ${this.theme.blocks.borderWidth} solid ${colors.border};
        ">
          <img
            src="${mapImageUrl}"
            alt="Travel map"
            style="width: 100%; height: 100%; object-fit: cover; display: block;"
            crossorigin="anonymous"
          />
        </div>
        <div style="
          padding: 10mm;
          background: ${colors.surface};
          border-radius: ${this.theme.blocks.borderRadius};
          border: ${this.theme.blocks.borderWidth} solid ${colors.border};
        ">
          <h3 style="
            font-size: ${typography.h4.size};
            font-weight: ${typography.h4.weight};
            margin: 0 0 6mm 0;
            color: ${colors.text};
            font-family: ${typography.headingFont};
          ">Локации (${locations.length})</h3>
          <div style="
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 6mm;
          ">
            ${locations.slice(0, 8).map((location, index) => `
              <div style="display: flex; gap: 4mm; align-items: flex-start;">
                <div style="
                  flex-shrink: 0;
                  width: 8mm;
                  height: 8mm;
                  background: ${colors.accent};
                  color: #ffffff;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 9pt;
                  font-weight: 600;
                ">${index + 1}</div>
                <div style="flex: 1; min-width: 0;">
                  <div style="
                    font-size: 10pt;
                    font-weight: 600;
                    color: ${colors.text};
                    margin-bottom: 2mm;
                    font-family: ${typography.bodyFont};
                  ">${escapeHtml(location.address)}</div>
                  ${location.categoryName ? `
                    <div style="
                      font-size: 8pt;
                      color: ${colors.textMuted};
                      font-family: ${typography.bodyFont};
                    ">${escapeHtml(location.categoryName)}</div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
          ${locations.length > 8 ? `
            <div style="
              margin-top: 6mm;
              padding-top: 6mm;
              border-top: 1px solid ${colors.border};
              font-size: 9pt;
              color: ${colors.textMuted};
              text-align: center;
              font-family: ${typography.bodyFont};
            ">
              И еще ${locations.length - 8} ${getLocationLabel(locations.length - 8)}
            </div>
          ` : ''}
        </div>
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: 12pt;
          color: ${colors.textMuted};
          font-weight: 500;
        ">${pageNumber}</div>
      </section>
    `;
  }
}
