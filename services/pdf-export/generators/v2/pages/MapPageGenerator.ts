// src/services/pdf-export/generators/v2/pages/MapPageGenerator.ts
// ✅ GENERATOR: Генератор страницы карты маршрута

import { BasePageGenerator } from './PageGenerator';
import type { PageContext } from '../types';
import { generateLeafletRouteSnapshot } from '@/utils/mapImageGenerator';
import {
  buildGoogleMapsUrl as buildBookGoogleMapsUrl,
  buildRouteSvg as buildBookRouteSvg,
} from '../runtime/bookData';
import type { NormalizedLocation } from '../runtime/types';

/**
 * Генератор страницы карты маршрута
 */
export class MapPageGenerator extends BasePageGenerator {
  private getLocationLabel(location: NormalizedLocation): string {
    return location.address || location.name || '';
  }

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

    const mapSvg = buildBookRouteSvg(locations, theme);
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
            label: this.getLocationLabel(location),
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

  private async generateLocationQRCodes(locations: NormalizedLocation[]): Promise<string[]> {
    const QRCode = await this.getQRCode();
    return Promise.all(
      locations.map(async (loc) => {
        const url = buildBookGoogleMapsUrl(loc);
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
        gap: 6px;
        margin-top: 8px;
      ">
        ${locations.slice(0, 6).map((loc, index) => {
          const isFirst = index === 0;
          const isLast = index === locations.length - 1 && locations.length <= 6;
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
              <span style="max-width: 240px; word-break: break-word;">${this.escapeHtml(this.getLocationLabel(loc))}</span>
              ${qr ? `
                <a href="${this.escapeHtml(buildBookGoogleMapsUrl(loc))}" style="display: inline-flex; margin-left: 4px;" target="_blank" rel="noreferrer">
                  <img src="${this.escapeHtml(qr)}" alt="QR" style="width: 14mm; height: 14mm; border-radius: 4px; border: 1px solid ${colors.border}; background: #fff;" />
                </a>
              ` : ''}
            </div>
          `;
        }).join('')}
        ${locations.length > 6 ? `
          <div style="
            display: inline-flex;
            align-items: center;
            padding: 6px 12px;
            background: ${colors.surfaceAlt};
            border-radius: 8px;
            font-size: ${typography.body.size};
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
          ">+${locations.length - 6} точек</div>
        ` : ''}
      </div>
    `;
  }
}
