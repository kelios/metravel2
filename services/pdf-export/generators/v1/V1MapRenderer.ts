/**
 * V1 Map page renderer — extracted from EnhancedPdfGenerator.renderMapPage
 *
 * Accepts pre-computed map data (snapshot/SVG, location list HTML)
 * since async operations (Leaflet, QR codes) remain in the orchestrator.
 *
 * Supports multi-page rendering when location list is too long.
 */

import { escapeHtml } from '../../utils/htmlUtils';
import { buildRunningHeader, getImageFilterStyle, type V1RenderContext } from './V1RenderHelpers';
import type { ParsedRoutePreview } from '@/types/travelRoutes';

export interface V1MapPageData {
  travelName: string;
  snapshotDataUrl: string | null;
  mapSvg: string;
  locationListHtml: string;
  locationCount: number;
  pageNumber: number;
  routeInfo?: string;
  routePreview?: ParsedRoutePreview | null;
}

export class V1MapRenderer {
  constructor(private ctx: V1RenderContext) {}

  render(data: V1MapPageData): string {
    const { colors, typography, spacing } = this.ctx.theme;
    const locationCount = Number.isFinite(data.locationCount) ? data.locationCount : 0;
    const mapHeightMm = this.getMapHeightMm(locationCount);

    const elevationProfileHtml = data.routePreview
      ? this.renderElevationProfile(data.routePreview)
      : '';

    return `
      <section class="pdf-page map-page" style="padding: ${spacing.pagePadding};">
        ${buildRunningHeader(this.ctx, data.travelName, data.pageNumber)}
        <div style="margin-bottom: 4mm; page-break-inside: avoid; break-inside: avoid;">
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
        ${elevationProfileHtml}
        <div>
          <div style="
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px 8px;
            margin-bottom: 4mm;
          ">
            <h2 style="
              font-size: ${typography.h2.size};
              margin: 0;
              font-family: ${typography.headingFont};
              page-break-after: avoid;
            ">Маршрут</h2>
            <span style="
              display: inline-flex;
              align-items: center;
              padding: 4px 10px;
              border-radius: 999px;
              background: ${colors.accentSoft};
              color: ${colors.accentStrong};
              font-size: ${typography.caption.size};
              font-weight: 700;
              font-family: ${typography.bodyFont};
            ">${locationCount} ${locationCount === 1 ? 'точка' : locationCount >= 2 && locationCount <= 4 ? 'точки' : 'точек'}</span>
          </div>
          <p style="
            color: ${colors.textMuted};
            margin-bottom: 4mm;
            font-size: 9pt;
            font-family: ${typography.bodyFont};
            line-height: 1.45;
          ">${escapeHtml(data.routeInfo || data.travelName)}</p>
          <div style="column-count: 1;">${data.locationListHtml}</div>
        </div>
      </section>
    `;
  }

  private renderElevationProfile(preview: ParsedRoutePreview): string {
    const samples = Array.isArray(preview?.elevationProfile) ? preview.elevationProfile : [];
    if (samples.length < 2) return '';

    const { colors, typography } = this.ctx.theme;

    const elevations = samples.map((s) => s.elevationM).filter((v) => Number.isFinite(v));
    if (elevations.length < 2) return '';

    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const elevationRange = Math.max(1, maxElevation - minElevation);

    const linePoints = Array.isArray(preview?.linePoints) ? preview.linePoints : [];
    const totalDistanceKm = this.calculateRouteDistanceKm(linePoints);

    let ascent = 0;
    let descent = 0;
    for (let i = 1; i < samples.length; i += 1) {
      const delta = samples[i].elevationM - samples[i - 1].elevationM;
      if (delta > 0) ascent += delta;
      if (delta < 0) descent += Math.abs(delta);
    }

    const chartWidth = 180;
    const chartHeight = 40;
    const padding = 2;

    const polylinePoints = samples
      .map((sample) => {
        const x = padding + (sample.distanceKm / Math.max(0.001, totalDistanceKm)) * (chartWidth - padding * 2);
        const y = padding + (1 - (sample.elevationM - minElevation) / elevationRange) * (chartHeight - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const round = (v: number) => Math.round(v * 10) / 10;

    return `
      <div style="
        margin-bottom: 4mm;
        padding: 8px 10px;
        background: ${colors.surfaceAlt};
        border-radius: ${this.ctx.theme.blocks.borderRadius};
        border: ${this.ctx.theme.blocks.borderWidth} solid ${colors.border};
        page-break-inside: avoid;
        break-inside: avoid;
      ">
        <div style="
          font-size: 9pt;
          font-weight: 600;
          color: ${colors.text};
          margin-bottom: 6px;
          font-family: ${typography.headingFont};
        ">Профиль высот</div>
        <div style="display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap;">
          <svg viewBox="0 0 ${chartWidth} ${chartHeight}" style="width: 100%; max-width: 120mm; height: 30mm; flex-shrink: 0;">
            <polyline
              points="${polylinePoints}"
              fill="none"
              stroke="${colors.accent}"
              stroke-width="1.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 8pt; color: ${colors.textMuted}; font-family: ${typography.bodyFont};">
            <div style="
              padding: 4px 8px;
              background: ${colors.surface};
              border-radius: 4px;
              border: 1px solid ${colors.border};
            ">
              <span style="font-weight: 600;">Дистанция:</span> ${round(totalDistanceKm)} км
            </div>
            <div style="
              padding: 4px 8px;
              background: ${colors.surface};
              border-radius: 4px;
              border: 1px solid ${colors.border};
            ">
              <span style="font-weight: 600;">Набор:</span> +${Math.round(ascent)} м
            </div>
            <div style="
              padding: 4px 8px;
              background: ${colors.surface};
              border-radius: 4px;
              border: 1px solid ${colors.border};
            ">
              <span style="font-weight: 600;">Сброс:</span> -${Math.round(descent)} м
            </div>
            <div style="
              padding: 4px 8px;
              background: ${colors.surface};
              border-radius: 4px;
              border: 1px solid ${colors.border};
            ">
              <span style="font-weight: 600;">Мин:</span> ${Math.round(minElevation)} м
            </div>
            <div style="
              padding: 4px 8px;
              background: ${colors.surface};
              border-radius: 4px;
              border: 1px solid ${colors.border};
            ">
              <span style="font-weight: 600;">Макс:</span> ${Math.round(maxElevation)} м
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private calculateRouteDistanceKm(linePoints: Array<{ coord: string; elevation?: number | null }>): number {
    if (!Array.isArray(linePoints) || linePoints.length < 2) return 0;

    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371;

    let totalKm = 0;
    let prevCoord: { lat: number; lng: number } | null = null;

    for (const point of linePoints) {
      const [latStr, lngStr] = String(point.coord ?? '').replace(/;/g, ',').split(',');
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      if (prevCoord) {
        const dLat = toRad(lat - prevCoord.lat);
        const dLng = toRad(lng - prevCoord.lng);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(prevCoord.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        totalKm += R * c;
      }
      prevCoord = { lat, lng };
    }

    return totalKm;
  }

  private getMapHeightMm(locationCount: number): number {
    if (locationCount <= 1) return 125;
    if (locationCount === 2) return 96;
    if (locationCount === 3) return 86;
    if (locationCount === 4) return 78;
    return 72;
  }
}
