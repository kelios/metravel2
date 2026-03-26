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
  locationCards: string[];
  locationCount: number;
  pageNumber: number;
  routeInfo?: string;
  routePreview?: ParsedRoutePreview | null;
}

export class V1MapRenderer {
  constructor(private ctx: V1RenderContext) {}

  /** Maximum location cards to show on the first page alongside the map */
  private static readonly FIRST_PAGE_MAX_CARDS = 6;
  /** Maximum location cards per continuation page */
  private static readonly CONTINUATION_PAGE_MAX_CARDS = 10;

  render(data: V1MapPageData): string {
    const { colors, typography, spacing } = this.ctx.theme;
    const locationCount = Number.isFinite(data.locationCount) ? data.locationCount : 0;
    const mapHeightMm = this.getMapHeightMm(locationCount);

    const elevationProfileHtml = data.routePreview
      ? this.renderElevationProfile(data.routePreview)
      : '';

    const allCards = data.locationCards;
    const firstPageCards = allCards.slice(0, V1MapRenderer.FIRST_PAGE_MAX_CARDS);
    const remainingCards = allCards.slice(V1MapRenderer.FIRST_PAGE_MAX_CARDS);

    const routeHeaderHtml = this.renderRouteHeader(data, locationCount);

    // First page: map + elevation + header + first chunk of cards
    let pages = `
      <section class="pdf-page map-page" style="padding: ${spacing.pagePadding};">
        ${buildRunningHeader(this.ctx, data.travelName, data.pageNumber)}
        ${this.renderRouteSummary(data, locationCount)}
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
          ${routeHeaderHtml}
          <div style="column-count: 1;">${firstPageCards.join('')}</div>
        </div>
      </section>
    `;

    // Continuation pages for remaining cards
    let continuationPageNum = data.pageNumber + 1;
    for (let i = 0; i < remainingCards.length; i += V1MapRenderer.CONTINUATION_PAGE_MAX_CARDS) {
      const chunk = remainingCards.slice(i, i + V1MapRenderer.CONTINUATION_PAGE_MAX_CARDS);
      pages += `
        <section class="pdf-page map-page" style="padding: ${spacing.pagePadding};">
          ${buildRunningHeader(this.ctx, data.travelName, continuationPageNum)}
          <div>
            <h2 style="
              font-size: ${typography.h2.size};
              margin: 0 0 4mm 0;
              font-family: ${typography.headingFont};
              page-break-after: avoid;
            ">Продолжение маршрута <span style="
              font-size: ${typography.small.size};
              font-weight: 400;
              color: ${colors.textMuted};
            ">(продолжение)</span></h2>
            <div style="column-count: 1;">${chunk.join('')}</div>
          </div>
        </section>
      `;
      continuationPageNum += 1;
    }

    return pages;
  }

  private renderRouteSummary(data: V1MapPageData, locationCount: number): string {
    const { colors, typography } = this.ctx.theme;
    const metrics = [
      { value: locationCount, label: locationCount === 1 ? 'точка' : locationCount >= 2 && locationCount <= 4 ? 'точки' : 'точек' },
      { value: data.routePreview ? `${Math.round(this.calculateRouteDistanceKm(data.routePreview.linePoints) * 10) / 10} км` : 'Карта', label: 'маршрут' },
      { value: data.routePreview?.elevationProfile?.length ? 'Профиль' : 'GPS', label: 'данные' },
    ];

    return `
      <div style="
        margin-bottom: 5mm;
        padding: 12px 14px;
        border-radius: 18px;
        background: ${colors.surface};
        border: 1px solid ${colors.border};
        box-shadow: ${this.ctx.theme.blocks.shadow};
        page-break-inside: avoid;
        break-inside: avoid;
      ">
        <div style="
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        ">
          <div>
            <div style="
              display: inline-flex;
              align-items: center;
              gap: 6px;
              margin-bottom: 4px;
              font-size: ${typography.caption.size};
              text-transform: uppercase;
              letter-spacing: 0.08em;
              font-weight: 700;
              color: ${colors.accent};
              font-family: ${typography.bodyFont};
            ">Маршрут</div>
            <h2 style="
              margin: 0;
              font-size: ${typography.h2.size};
              line-height: 1.15;
              color: ${colors.text};
              font-family: ${typography.headingFont};
            ">Карта и ключевые точки</h2>
          </div>
          <span style="
            display: inline-flex;
            align-items: center;
            padding: 5px 10px;
            border-radius: 999px;
            background: ${colors.accentSoft};
            color: ${colors.accentStrong};
            font-size: ${typography.caption.size};
            font-weight: 700;
            font-family: ${typography.bodyFont};
            white-space: nowrap;
          ">${locationCount} ${locationCount === 1 ? 'точка' : locationCount >= 2 && locationCount <= 4 ? 'точки' : 'точек'}</span>
        </div>
        <div style="
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 6px;
        ">
          ${metrics.map((metric) => `
            <div style="
              padding: 8px 10px;
              border-radius: 14px;
              background: ${colors.surfaceAlt};
              border: 1px solid ${colors.border};
            ">
              <div style="
                font-size: 12pt;
                font-weight: 700;
                color: ${colors.text};
                font-family: ${typography.headingFont};
                line-height: 1.15;
                margin-bottom: 2px;
              ">${escapeHtml(String(metric.value))}</div>
              <div style="
                font-size: ${typography.caption.size};
                line-height: 1.35;
                color: ${colors.textMuted};
                text-transform: uppercase;
                letter-spacing: 0.06em;
                font-family: ${typography.bodyFont};
              ">${escapeHtml(metric.label)}</div>
            </div>
          `).join('')}
        </div>
        <p style="
          margin: 0;
          color: ${colors.textMuted};
          font-size: ${typography.caption.size};
          line-height: 1.5;
          font-family: ${typography.bodyFont};
        ">${escapeHtml(data.routeInfo || data.travelName)}</p>
      </div>
    `;
  }

  private renderRouteHeader(data: V1MapPageData, locationCount: number): string {
    const { colors, typography } = this.ctx.theme;
    return `
      <div style="
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 10px;
        margin-bottom: 4mm;
      ">
        <span style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: ${colors.accentSoft};
          flex-shrink: 0;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${colors.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
        </span>
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
            <defs>
              <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${colors.accent}" stop-opacity="0.2"/>
                <stop offset="100%" stop-color="${colors.accent}" stop-opacity="0.02"/>
              </linearGradient>
            </defs>
            <polygon
              points="${padding},${chartHeight} ${polylinePoints} ${chartWidth - padding},${chartHeight}"
              fill="url(#elev-fill)"
            />
            <polyline
              points="${polylinePoints}"
              fill="none"
              stroke="${colors.accent}"
              stroke-width="1.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 8pt; color: ${colors.textMuted}; font-family: ${typography.bodyFont};">
            <div style="
              padding: 4px 10px;
              background: ${colors.accentSoft};
              border-radius: 999px;
              color: ${colors.accentStrong};
              font-weight: 600;
            ">
              ${round(totalDistanceKm)} км
            </div>
            <div style="
              padding: 4px 10px;
              background: ${colors.surface};
              border-radius: 999px;
              border: 1px solid ${colors.border};
            ">
              <span style="color: #16a34a; font-weight: 600;">↑</span> ${Math.round(ascent)} м
            </div>
            <div style="
              padding: 4px 10px;
              background: ${colors.surface};
              border-radius: 999px;
              border: 1px solid ${colors.border};
            ">
              <span style="color: #dc2626; font-weight: 600;">↓</span> ${Math.round(descent)} м
            </div>
            <div style="
              padding: 4px 10px;
              background: ${colors.surface};
              border-radius: 999px;
              border: 1px solid ${colors.border};
            ">
              ${Math.round(minElevation)}–${Math.round(maxElevation)} м
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
    if (locationCount <= 1) return 132;
    if (locationCount === 2) return 112;
    if (locationCount === 3) return 104;
    if (locationCount === 4) return 98;
    return 96;
  }
}
