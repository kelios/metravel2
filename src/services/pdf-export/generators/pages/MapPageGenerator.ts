// src/services/pdf-export/generators/pages/MapPageGenerator.ts
// Генератор страниц с картами

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';
import type { TravelForBook } from '@/src/types/pdf-export';

export interface MapLocation {
  id: string;
  address: string;
  coord: string; // "lat,lng"
  categoryName?: string;
  travelImageThumbUrl?: string;
}

export class MapPageGenerator {
  constructor(private theme: PdfThemeConfig) {}

  /**
   * Генерирует страницу с картой
   */
  async generate(
    travel: TravelForBook,
    locations: MapLocation[],
    pageNumber: number
  ): Promise<string> {
    const { colors, spacing } = this.theme;
    const mapImageUrl = await this.generateMapImage(locations);

    return `
      <section class="pdf-page map-page" style="
        padding: ${spacing.pagePadding};
        background: ${colors.background};
        position: relative;
      ">
        ${this.renderHeader(travel.name)}
        ${this.renderMap(mapImageUrl)}
        ${this.renderLegend(locations)}
        ${this.renderPageNumber(pageNumber)}
      </section>
    `;
  }

  private renderHeader(travelName: string): string {
    const { colors, typography } = this.theme;

    return `
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
        ">${this.escapeHtml(travelName)}</div>
      </div>
    `;
  }

  private renderMap(mapImageUrl: string): string {
    const { colors } = this.theme;

    return `
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
          src="${this.escapeHtml(mapImageUrl)}"
          alt="Travel map"
          style="
            width: 100%;
            height: 100%;
            object-fit: cover;
            ${this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : ''}
          "
          crossorigin="anonymous"
        />
      </div>
    `;
  }

  private renderLegend(locations: MapLocation[]): string {
    const { colors, typography } = this.theme;

    if (locations.length === 0) return '';

    return `
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
            <div style="
              display: flex;
              gap: 4mm;
              align-items: flex-start;
            ">
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
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                ">${this.escapeHtml(location.address)}</div>
                
                ${location.categoryName ? `
                  <div style="
                    font-size: 8pt;
                    color: ${colors.textMuted};
                    font-family: ${typography.bodyFont};
                  ">${this.escapeHtml(location.categoryName)}</div>
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
            И еще ${locations.length - 8} ${this.getLocationLabel(locations.length - 8)}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderPageNumber(pageNumber: number): string {
    const { colors } = this.theme;

    return `
      <div style="
        position: absolute;
        bottom: 15mm;
        right: 25mm;
        font-size: 12pt;
        color: ${colors.textMuted};
        font-weight: 500;
      ">${pageNumber}</div>
    `;
  }

  /**
   * Генерирует изображение карты
   * TODO: Интегрировать Mapbox Static API
   */
  private async generateMapImage(locations: MapLocation[]): Promise<string> {
    // Временная заглушка - возвращаем placeholder
    // В будущем здесь будет интеграция с Mapbox Static API
    
    if (locations.length === 0) {
      return this.generatePlaceholderMap();
    }

    // Вычисляем центр и zoom на основе локаций
    const bounds = this.calculateBounds(locations);
    
    // TODO: Использовать Mapbox Static API
    // const mapboxToken = process.env.MAPBOX_TOKEN;
    // const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/...`;
    
    // Пока возвращаем placeholder с информацией о локациях
    return this.generatePlaceholderMap(bounds);
  }

  private calculateBounds(locations: MapLocation[]): {
    center: { lat: number; lng: number };
    zoom: number;
  } {
    if (locations.length === 0) {
      return { center: { lat: 0, lng: 0 }, zoom: 2 };
    }

    const coords = locations
      .map(loc => {
        const [lat, lng] = loc.coord.split(',').map(Number);
        return { lat, lng };
      })
      .filter(coord => !isNaN(coord.lat) && !isNaN(coord.lng));

    if (coords.length === 0) {
      return { center: { lat: 0, lng: 0 }, zoom: 2 };
    }

    // Вычисляем центр
    const center = {
      lat: coords.reduce((sum, c) => sum + c.lat, 0) / coords.length,
      lng: coords.reduce((sum, c) => sum + c.lng, 0) / coords.length,
    };

    // Вычисляем zoom на основе разброса координат
    const latRange = Math.max(...coords.map(c => c.lat)) - Math.min(...coords.map(c => c.lat));
    const lngRange = Math.max(...coords.map(c => c.lng)) - Math.min(...coords.map(c => c.lng));
    const maxRange = Math.max(latRange, lngRange);

    let zoom = 10;
    if (maxRange > 10) zoom = 5;
    else if (maxRange > 5) zoom = 7;
    else if (maxRange > 1) zoom = 9;
    else if (maxRange > 0.1) zoom = 11;
    else zoom = 13;

    return { center, zoom };
  }

  private generatePlaceholderMap(bounds?: {
    center: { lat: number; lng: number };
    zoom: number;
  }): string {
    // Генерируем SVG placeholder для карты
    const centerText = bounds
      ? `${bounds.center.lat.toFixed(2)}, ${bounds.center.lng.toFixed(2)}`
      : 'Карта';

    return `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e0e0e0" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="800" height="600" fill="#f5f5f5"/>
        <rect width="800" height="600" fill="url(#grid)"/>
        <circle cx="400" cy="300" r="60" fill="#5b8a7a" opacity="0.3"/>
        <circle cx="400" cy="300" r="40" fill="#5b8a7a" opacity="0.5"/>
        <circle cx="400" cy="300" r="20" fill="#5b8a7a"/>
        <text x="400" y="400" font-family="Arial, sans-serif" font-size="18" fill="#4a4a4a" text-anchor="middle">
          ${centerText}
        </text>
        <text x="400" y="430" font-family="Arial, sans-serif" font-size="14" fill="#9b9b9b" text-anchor="middle">
          Карта будет добавлена при интеграции Mapbox
        </text>
      </svg>
    `)}`;
  }

  private getLocationLabel(count: number): string {
    if (count === 1) return 'локация';
    if (count >= 2 && count <= 4) return 'локации';
    return 'локаций';
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
