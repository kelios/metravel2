// src/services/pdf-export/generators/v2/pages/MapPageGenerator.ts
// ✅ GENERATOR: Генератор страницы карты маршрута

import { BasePageGenerator } from './PageGenerator';
import type { PageContext } from '../types';
import { generateLeafletRouteSnapshot } from '@/src/utils/mapImageGenerator';

/**
 * Локация с координатами
 */
interface NormalizedLocation {
  name: string;
  lat?: number;
  lng?: number;
}

/**
 * Генератор страницы карты маршрута
 */
export class MapPageGenerator extends BasePageGenerator {
  /**
   * Генерирует страницу карты
   */
  async generate(context: PageContext): Promise<string> {
    const { travel, theme, pageNumber, metadata } = context;

    if (!travel) {
      throw new Error('MapPageGenerator requires travel in context');
    }

    const { colors, typography, spacing } = theme;
    const locations = (metadata?.locations || []) as NormalizedLocation[];

    if (!locations.length) return '';

    const mapSvg = this.buildRouteSvg(locations, colors);
    const pointsWithCoords = locations.filter(
      (location) => typeof location.lat === 'number' && typeof location.lng === 'number'
    );

    let snapshotDataUrl: string | null = null;
    if (pointsWithCoords.length) {
      try {
        snapshotDataUrl = await generateLeafletRouteSnapshot(
          pointsWithCoords.map((location) => ({
            lat: location.lat as number,
            lng: location.lng as number,
            label: location.name,
          })),
          { width: 1400, height: 900 }
        );
      } catch {
        snapshotDataUrl = null;
      }
    }

    const locationQRCodes = await this.generateLocationQRCodes(locations);
    const locationList = this.buildLocationList(locations, locationQRCodes, colors, typography);

    return `
      <section class="pdf-page map-page" style="padding: ${spacing.pagePadding};">
        <div style="margin-bottom: ${spacing.sectionSpacing};">
          <div style="
            background: linear-gradient(135deg, ${colors.surfaceAlt} 0%, ${colors.surface} 100%);
            border-radius: 14px;
            padding: 10px;
            border: 1px solid ${colors.border};
            box-shadow: 0 4px 12px rgba(0,0,0,0.12);
          ">
            <div style="
              border-radius: 14px;
              overflow: hidden;
              height: 135mm;
            ">
              ${snapshotDataUrl ? `
                <img src="${this.escapeHtml(snapshotDataUrl)}" alt="Карта маршрута"
                  style="width: 100%; height: 100%; display: block; object-fit: cover;" />
              ` : `
                ${mapSvg}
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
            margin-bottom: ${spacing.elementSpacing};
            font-family: ${typography.bodyFont};
          ">${this.escapeHtml(travel.name)}</p>
          <div>${locationList}</div>
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
    `;
  }

  private buildGoogleMapsUrl(location: NormalizedLocation): string {
    if (typeof location.lat !== 'number' || typeof location.lng !== 'number') return '';
    // Using lat/lng keeps the URL stable across locales.
    const query = `${location.lat},${location.lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  private async generateLocationQRCodes(locations: NormalizedLocation[]): Promise<string[]> {
    const QRCode = await this.getQRCode();
    return Promise.all(
      locations.map(async (loc) => {
        const url = this.buildGoogleMapsUrl(loc);
        if (!url) return '';
        try {
          return await QRCode.toDataURL(url, {
            margin: 1,
            errorCorrectionLevel: 'M',
            width: 120,
            color: { dark: '#111827', light: '#ffffff' },
          });
        } catch {
          return '';
        }
      })
    );
  }

  private async getQRCode(): Promise<{ toDataURL: (text: string, options: Record<string, unknown>) => Promise<string> }> {
    const mod = await import('qrcode');
    const QRCode = (mod as any).default ?? mod;
    return QRCode as any;
  }

  /**
   * Оценивает количество страниц (0 если нет локаций, 1 если есть)
   */
  estimatePageCount(context: PageContext): number {
    const { travel, metadata } = context;
    if (!travel) return 0;

    const locations = (metadata?.locations || []) as NormalizedLocation[];
    return locations.length > 0 ? 1 : 0;
  }

  /**
   * Создает SVG карту маршрута (fallback)
   */
  private buildRouteSvg(locations: NormalizedLocation[], colors: any): string {
    const width = 700;
    const height = 500;
    const padding = 40;

    const validLocations = locations.filter(
      (loc) => typeof loc.lat === 'number' && typeof loc.lng === 'number'
    );

    if (!validLocations.length) {
      return `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="${colors.surfaceAlt}"/>
          <text x="50%" y="50%" text-anchor="middle" fill="${colors.textMuted}" font-size="16">
            Карта недоступна
          </text>
        </svg>
      `;
    }

    // Находим границы
    const lats = validLocations.map((loc) => loc.lat as number);
    const lngs = validLocations.map((loc) => loc.lng as number);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;

    // Функция для преобразования координат в пиксели
    const toX = (lng: number) =>
      padding + ((lng - minLng) / lngRange) * (width - 2 * padding);
    const toY = (lat: number) =>
      height - padding - ((lat - minLat) / latRange) * (height - 2 * padding);

    // Создаем линию маршрута
    const pathPoints = validLocations.map((loc) => {
      const x = toX(loc.lng as number);
      const y = toY(loc.lat as number);
      return `${x},${y}`;
    }).join(' ');

    return `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${colors.surface}"/>
        
        <!-- Маршрут -->
        <polyline
          points="${pathPoints}"
          fill="none"
          stroke="${colors.accent}"
          stroke-width="3"
          stroke-dasharray="5,5"
          opacity="0.7"
        />
        
        <!-- Точки маршрута -->
        ${validLocations.map((loc, index) => {
          const x = toX(loc.lng as number);
          const y = toY(loc.lat as number);
          const isFirst = index === 0;
          const isLast = index === validLocations.length - 1;
          
          return `
            <circle
              cx="${x}"
              cy="${y}"
              r="${isFirst || isLast ? 8 : 6}"
              fill="${isFirst ? '#22c55e' : isLast ? '#ef4444' : colors.accent}"
              stroke="white"
              stroke-width="2"
            />
            <text
              x="${x}"
              y="${y - 15}"
              text-anchor="middle"
              fill="${colors.text}"
              font-size="12"
              font-weight="600"
            >${this.escapeHtml(loc.name)}</text>
          `;
        }).join('')}
      </svg>
    `;
  }

  /**
   * Создает список локаций
   */
  private buildLocationList(
    locations: NormalizedLocation[],
    qrCodes: string[],
    colors: any,
    typography: any
  ): string {
    return `
      <div style="
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      ">
        ${locations.map((loc, index) => {
          const isFirst = index === 0;
          const isLast = index === locations.length - 1;
          const bgColor = isFirst ? '#dcfce7' : isLast ? '#fee2e2' : colors.surfaceAlt;
          const textColor = isFirst ? '#16a34a' : isLast ? '#dc2626' : colors.text;
          const qr = qrCodes[index] || '';
          
          return `
            <div style="
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 6px 12px;
              background: ${bgColor};
              border-radius: 8px;
              font-size: ${typography.body.size};
              font-weight: 500;
              color: ${textColor};
              font-family: ${typography.bodyFont};
            ">
              <span style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                background: ${textColor};
                color: white;
                border-radius: 50%;
                font-size: 11px;
                font-weight: 700;
              ">${index + 1}</span>
              <span style="max-width: 240px; word-break: break-word;">${this.escapeHtml(loc.name)}</span>
              ${qr ? `
                <a href="${this.escapeHtml(this.buildGoogleMapsUrl(loc))}" style="display: inline-flex; margin-left: 6px;" target="_blank" rel="noreferrer">
                  <img src="${this.escapeHtml(qr)}" alt="QR" style="width: 22mm; height: 22mm; border-radius: 6px; border: 1px solid ${colors.border}; background: #fff;" />
                </a>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}

