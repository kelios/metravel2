import type { ParsedRoutePreview } from '@/types/travelRoutes'
import { escapeHtml } from '../../../../utils/htmlUtils'
import { buildRunningHeader, type RuntimeRenderContext } from './renderHelpers'

export interface RuntimeMapPageData {
  travelName: string
  snapshotDataUrl: string | null
  mapSvg: string
  locationCards: string[]
  locationCount: number
  pageNumber: number
  routeInfo?: string
  routePreview?: ParsedRoutePreview | null
}

export class RuntimeMapRenderer {
  constructor(private ctx: RuntimeRenderContext) {}

  private static readonly FIRST_PAGE_MAX_CARDS = 6
  private static readonly FIRST_PAGE_MAX_CARDS_WITH_ELEVATION = 0
  private static readonly CONTINUATION_PAGE_MAX_CARDS = 10

  render(data: RuntimeMapPageData): string {
    const { colors, typography, spacing } = this.ctx.theme
    const locationCount = Number.isFinite(data.locationCount) ? data.locationCount : 0
    const hasElevation = !!data.routePreview && Array.isArray(data.routePreview.elevationProfile) && data.routePreview.elevationProfile.length >= 2
    const mapHeightMm = this.getMapHeightMm(locationCount, hasElevation)

    const elevationProfileHtml = data.routePreview
      ? this.renderElevationProfile(data.routePreview)
      : ''

    const firstPageMaxCards = hasElevation
      ? RuntimeMapRenderer.FIRST_PAGE_MAX_CARDS_WITH_ELEVATION
      : RuntimeMapRenderer.FIRST_PAGE_MAX_CARDS
    const allCards = data.locationCards
    const firstPageCards = allCards.slice(0, firstPageMaxCards)
    const remainingCards = allCards.slice(firstPageMaxCards)

    const routeHeaderHtml = this.renderRouteHeader(data, locationCount)
    const routeHeaderHtmlNoSubtitle = this.renderRouteHeader(data, locationCount, { showSubtitle: false })

    let pages = `
      <section class="pdf-page map-page" style="padding: ${spacing.pagePadding};">
        ${buildRunningHeader(this.ctx, data.travelName, data.pageNumber)}
        ${this.renderRouteSummary(data, locationCount)}
        <div style="margin-bottom: 4mm; page-break-inside: avoid; break-inside: avoid;">
          <div style="
            background: ${colors.surface};
            border-radius: ${this.ctx.theme.blocks.borderRadius};
            padding: 10px;
            border: ${this.ctx.theme.blocks.borderWidth} solid ${colors.border};
            box-shadow: ${this.ctx.theme.blocks.shadow};
          ">
            <div style="
              position: relative;
              border-radius: ${this.ctx.theme.blocks.borderRadius};
              overflow: hidden;
              height: ${mapHeightMm}mm;
              background: ${colors.surfaceAlt};
            ">
              ${data.snapshotDataUrl
                ? `<img src="${data.snapshotDataUrl}" alt="Карта маршрута" style="width: 100%; height: 100%; object-fit: cover; display: block; filter: saturate(1.15) contrast(1.05);" />`
                : data.mapSvg
              }
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="
                position: absolute;
                top: 8px;
                right: 8px;
                width: 24px;
                height: 24px;
                opacity: 0.6;
                z-index: 2;
              ">
                <circle cx="50" cy="50" r="48" fill="rgba(255,255,255,0.85)" stroke="${colors.textMuted}" stroke-width="2"/>
                <line x1="50" y1="8" x2="50" y2="92" stroke="${colors.textMuted}" stroke-width="1.5"/>
                <line x1="8" y1="50" x2="92" y2="50" stroke="${colors.textMuted}" stroke-width="1.5"/>
                <polygon points="50,4 44,20 56,20" fill="${colors.text}"/>
                <polygon points="50,96 44,80 56,80" fill="${colors.textMuted}"/>
                <polygon points="4,50 20,44 20,56" fill="${colors.textMuted}"/>
                <polygon points="96,50 80,44 80,56" fill="${colors.textMuted}"/>
                <text x="50" y="18" text-anchor="middle" font-size="13" font-weight="700" fill="${colors.text}" font-family="sans-serif">N</text>
                <text x="50" y="95" text-anchor="middle" font-size="11" fill="${colors.textMuted}" font-family="sans-serif">S</text>
                <text x="7" y="54" text-anchor="middle" font-size="11" fill="${colors.textMuted}" font-family="sans-serif">W</text>
                <text x="93" y="54" text-anchor="middle" font-size="11" fill="${colors.textMuted}" font-family="sans-serif">E</text>
              </svg>
            </div>
          </div>
        </div>
        ${elevationProfileHtml}
        ${firstPageCards.length > 0 ? `
        <div>
          ${routeHeaderHtml}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3mm;">${firstPageCards.join('')}</div>
        </div>
        ` : ''}
      </section>
    `

    let continuationPageNum = data.pageNumber + 1
    let isFirstContinuation = firstPageCards.length === 0
    for (let i = 0; i < remainingCards.length; i += RuntimeMapRenderer.CONTINUATION_PAGE_MAX_CARDS) {
      const chunk = remainingCards.slice(i, i + RuntimeMapRenderer.CONTINUATION_PAGE_MAX_CARDS)
      const headerHtml = isFirstContinuation
        ? routeHeaderHtmlNoSubtitle
        : `<h2 style="
              font-size: ${typography.h2.size};
              margin: 0 0 4mm 0;
              font-family: ${typography.headingFont};
              page-break-after: avoid;
            ">Продолжение маршрута <span style="
              font-size: ${typography.small.size};
              font-weight: 400;
              color: ${colors.textMuted};
            ">(продолжение)</span></h2>`
      pages += `
        <section class="pdf-page map-page" style="padding: ${spacing.pagePadding};">
          ${buildRunningHeader(this.ctx, data.travelName, continuationPageNum)}
          <div>
            ${headerHtml}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3mm;">${chunk.join('')}</div>
          </div>
        </section>
      `
      continuationPageNum += 1
      isFirstContinuation = false
    }

    return pages
  }

  private renderRouteSummary(data: RuntimeMapPageData, locationCount: number): string {
    const { colors, typography } = this.ctx.theme

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
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        ">
          <h2 style="
            margin: 0;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: ${typography.h2.size};
            line-height: 1.15;
            color: ${colors.text};
            font-family: ${typography.headingFont};
          ">Маршрут</h2>
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
        <p style="
          margin: 0;
          color: ${colors.textMuted};
          font-size: ${typography.caption.size};
          line-height: 1.5;
          font-family: ${typography.bodyFont};
        ">${escapeHtml(data.routeInfo || data.travelName)}</p>
      </div>
    `
  }

  private renderRouteHeader(data: RuntimeMapPageData, locationCount: number, options?: { showSubtitle?: boolean }): string {
    const { colors, typography } = this.ctx.theme
    const showSubtitle = options?.showSubtitle ?? true
    return `
      <div style="
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 10px;
        margin-bottom: ${showSubtitle ? '4mm' : '4mm'};
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
      ${showSubtitle ? `<p style="
        color: ${colors.textMuted};
        margin-bottom: 4mm;
        font-size: 9pt;
        font-family: ${typography.bodyFont};
        line-height: 1.45;
      ">${escapeHtml(data.routeInfo || data.travelName)}</p>` : ''}
    `
  }

  private renderElevationProfile(preview: ParsedRoutePreview): string {
    const samples = Array.isArray(preview?.elevationProfile) ? preview.elevationProfile : []
    if (samples.length < 2) return ''

    const { colors, typography } = this.ctx.theme

    const elevations = samples.map((s) => s.elevationM).filter((v) => Number.isFinite(v))
    if (elevations.length < 2) return ''

    const minElevation = Math.min(...elevations)
    const maxElevation = Math.max(...elevations)
    const elevationRange = Math.max(1, maxElevation - minElevation)

    const linePoints = Array.isArray(preview?.linePoints) ? preview.linePoints : []
    const totalDistanceKm = this.calculateRouteDistanceKm(linePoints)

    let ascent = 0
    let descent = 0
    for (let i = 1; i < samples.length; i += 1) {
      const delta = samples[i].elevationM - samples[i - 1].elevationM
      if (delta > 0) ascent += delta
      if (delta < 0) descent += Math.abs(delta)
    }

    const round = (v: number) => Math.round(v * 10) / 10
    const fmt = (v: number) => `${Math.round(v)} м`

    // Key samples
    const startSample = samples[0]
    const finishSample = samples[samples.length - 1]
    const peakSample = samples.reduce((best, s) => s.elevationM > best.elevationM ? s : best, samples[0])

    // SVG chart geometry
    const CW = 500        // viewBox width
    const CH = 120        // viewBox height
    const PL = 44         // left padding (y-axis labels)
    const PR = 10         // right padding
    const PT = 10         // top padding
    const PB = 18         // bottom padding (x-axis labels)
    const plotW = CW - PL - PR
    const plotH = CH - PT - PB
    const baseY = PT + plotH

    const toX = (d: number) => PL + (d / Math.max(0.001, totalDistanceKm)) * plotW
    const toY = (e: number) => PT + (1 - (e - minElevation) / elevationRange) * plotH

    const polylinePoints = samples.map((s) => `${toX(s.distanceKm).toFixed(1)},${toY(s.elevationM).toFixed(1)}`).join(' ')

    const areaPath = `M ${toX(samples[0].distanceKm).toFixed(1)} ${baseY} `
      + samples.map((s) => `L ${toX(s.distanceKm).toFixed(1)} ${toY(s.elevationM).toFixed(1)}`).join(' ')
      + ` L ${toX(samples[samples.length - 1].distanceKm).toFixed(1)} ${baseY} Z`

    // 3 y-axis guides
    const guideValues = [maxElevation, minElevation + elevationRange / 2, minElevation]

    // Peak key point
    const peakX = toX(peakSample.distanceKm)
    const peakY = toY(peakSample.elevationM)
    const startX = toX(startSample.distanceKm)
    const startY = toY(startSample.elevationM)
    const finishX = toX(finishSample.distanceKm)
    const finishY = toY(finishSample.elevationM)

    const gradientId = `elev-${Math.round(minElevation)}-${Math.round(maxElevation)}-${samples.length}`

    // Colors matching the travel page
    const accentColor = colors.accent
    const infoColor = colors.accentStrong ?? accentColor

    // 6 summary cards (matches summaryCards in RouteElevationProfile.tsx)
    const summaryCards = [
      { label: 'Дистанция', value: `${round(totalDistanceKm)} км`, accent: true },
      { label: 'Набор', value: `+${fmt(ascent)}`, accent: true },
      { label: 'Сброс', value: `-${fmt(descent)}`, accent: false },
      { label: 'Мин высота', value: fmt(minElevation), accent: false },
      { label: 'Макс высота', value: fmt(maxElevation), accent: false },
      { label: 'Перепад', value: fmt(elevationRange), accent: false },
    ]

    // 3 point cards (matches pointCards in RouteElevationProfile.tsx)
    const pointCards = [
      { label: 'Старт', value: fmt(startSample.elevationM), color: accentColor },
      { label: 'Высшая точка', value: fmt(peakSample.elevationM), color: infoColor },
      { label: 'Финиш', value: fmt(finishSample.elevationM), color: colors.accentStrong ?? accentColor },
    ]

    return `
      <div style="
        margin-bottom: 4mm;
        padding: 10px;
        background: ${colors.surface};
        border-radius: ${this.ctx.theme.blocks.borderRadius};
        border: ${this.ctx.theme.blocks.borderWidth} solid ${colors.border};
        page-break-inside: avoid;
        break-inside: avoid;
        font-family: ${typography.bodyFont};
      ">
        <!-- Header -->
        <div style="margin-bottom: 8px;">
          <div style="font-size: 9pt; font-weight: 700; color: ${colors.text}; font-family: ${typography.headingFont};">Профиль высот</div>
          <div style="font-size: ${typography.caption.size}; color: ${colors.textMuted}; margin-top: 2px;">
            ${escapeHtml(`${round(totalDistanceKm)} км • +${Math.round(ascent)} м набора • пик ${fmt(maxElevation)}`)}</div>
        </div>

        <!-- 6 summary cards -->
        <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px;">
          ${summaryCards.map((c) => `
            <div style="
              flex: 1 1 80px;
              padding: 7px 8px;
              border-radius: 10px;
              border: 1px solid ${c.accent ? colors.border : colors.borderLight};
              background: ${c.accent ? colors.surfaceAlt : colors.surfaceAlt};
            ">
              <div style="font-size: 8pt; color: ${colors.textMuted}; margin-bottom: 2px;">${escapeHtml(c.label)}</div>
              <div style="font-size: 10pt; font-weight: 700; color: ${colors.text}; font-family: ${typography.headingFont};">${escapeHtml(c.value)}</div>
            </div>
          `).join('')}
        </div>

        <!-- Chart -->
        <div style="
          position: relative;
          border-radius: 10px;
          border: 1px solid ${colors.borderLight};
          background: ${colors.surfaceAlt};
          overflow: hidden;
          margin-bottom: 6px;
        ">
          <!-- Min / Пик badges -->
          <div style="
            position: absolute; top: 6px; left: 8px; right: 8px;
            display: flex; justify-content: space-between; z-index: 2; pointer-events: none;
          ">
            <span style="
              padding: 3px 8px; border-radius: 999px; font-size: ${typography.caption.size}; font-weight: 700;
              background: rgba(255,255,255,0.72); border: 1px solid ${colors.borderLight}; color: ${colors.text};
            ">Мин ${fmt(minElevation)}</span>
            <span style="
              padding: 3px 8px; border-radius: 999px; font-size: ${typography.caption.size}; font-weight: 700;
              background: ${colors.accentSoft}; border: 1px solid ${colors.accentLight ?? colors.border}; color: ${colors.text};
            ">Пик ${fmt(maxElevation)}</span>
          </div>

          <svg viewBox="0 0 ${CW} ${CH}" style="width: 100%; height: 38mm; display: block;" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.30"/>
                <stop offset="100%" stop-color="${accentColor}" stop-opacity="0.03"/>
              </linearGradient>
            </defs>

            <!-- Y-axis guide lines + labels -->
            ${guideValues.map((val, _i) => {
              const gy = toY(val)
              return `
                <line x1="${PL}" y1="${gy.toFixed(1)}" x2="${CW - PR}" y2="${gy.toFixed(1)}"
                  stroke="${colors.borderLight}" stroke-width="1" stroke-dasharray="3 4" opacity="0.8"/>
                <text x="${(PL - 3).toFixed(1)}" y="${(gy + 3.5).toFixed(1)}"
                  font-size="10" text-anchor="end" fill="${colors.textMuted}" font-family="${typography.bodyFont}"
                >${Math.round(val)} м</text>
              `
            }).join('')}

            <!-- Peak vertical line -->
            <line x1="${peakX.toFixed(1)}" y1="${PT}" x2="${peakX.toFixed(1)}" y2="${(PT + plotH).toFixed(1)}"
              stroke="${infoColor}" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.65"/>

            <!-- Area fill -->
            <path d="${areaPath}" fill="url(#${gradientId})"/>

            <!-- Profile line -->
            <polyline points="${polylinePoints}" fill="none"
              stroke="${accentColor}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>

            <!-- Key point circles: start, peak, finish -->
            <circle cx="${startX.toFixed(1)}" cy="${startY.toFixed(1)}" r="4" fill="${accentColor}"/>
            <circle cx="${peakX.toFixed(1)}" cy="${peakY.toFixed(1)}" r="5" fill="${infoColor}"/>
            <circle cx="${finishX.toFixed(1)}" cy="${finishY.toFixed(1)}" r="4" fill="${colors.accentStrong ?? accentColor}"/>

            <!-- X-axis labels -->
            <text x="${PL}" y="${(CH - 3).toFixed(1)}"
              font-size="10" fill="${colors.textMuted}" font-family="${typography.bodyFont}">0 км</text>
            <text x="${(CW - PR).toFixed(1)}" y="${(CH - 3).toFixed(1)}"
              font-size="9" text-anchor="end" fill="${colors.textMuted}" font-family="${typography.bodyFont}"
            >${escapeHtml(`${round(totalDistanceKm)} км`)}</text>
          </svg>
        </div>

        <!-- 3 point cards: Старт / Высшая точка / Финиш -->
        <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px;">
          ${pointCards.map((c) => `
            <div style="
              padding: 8px 10px;
              border-radius: 10px;
              background: ${colors.surface};
              border: 1px solid ${colors.borderLight};
            ">
              <div style="
                display: flex; align-items: center; gap: 5px; margin-bottom: 5px;
              ">
                <span style="
                  width: 8px; height: 8px; border-radius: 50%;
                  background: ${c.color}; display: inline-block; flex-shrink: 0;
                "></span>
                <span style="font-size: ${typography.caption.size}; color: ${colors.textMuted}; font-weight: 700;">
                  ${escapeHtml(c.label)}
                </span>
              </div>
              <div style="font-size: 10pt; font-weight: 700; color: ${colors.text}; font-family: ${typography.headingFont};">
                ${escapeHtml(c.value)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  private calculateRouteDistanceKm(points: Array<{ coord?: string }>): number {
    let totalKm = 0
    for (let i = 1; i < points.length; i += 1) {
      const prev = this.parseCoord(points[i - 1]?.coord)
      const curr = this.parseCoord(points[i]?.coord)
      if (!prev || !curr) continue
      totalKm += this.haversineKm(prev[0], prev[1], curr[0], curr[1])
    }
    return totalKm
  }

  private parseCoord(coord?: string): [number, number] | null {
    if (!coord) return null
    const [latStr, lngStr] = String(coord).replace(/;/g, ',').split(',')
    const lat = Number(latStr)
    const lng = Number(lngStr)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return [lat, lng]
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const earthKm = 6371
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return earthKm * c
  }

  private getMapHeightMm(locationCount: number, hasElevation = false): number {
    if (hasElevation) return 95
    if (locationCount <= 6) return 140
    return 136
  }
}
