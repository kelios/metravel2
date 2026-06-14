import { useMemo } from 'react'

import type { ParsedRoutePreview } from '@/types/travelRoutes'
import { calculateRouteDistanceKm } from '@/utils/routeFileParser'
import {
  CHART_HEIGHT,
  CHART_PADDING,
  formatProfileKm,
  formatProfileMeters,
  getPeakRoutePoint,
  parseProfileCoord,
  resolveNearestHintName,
} from '../RouteElevationProfile.utils'

export type ChartPoint = {
  index: number
  sample: { distanceKm: number; elevationM: number }
  x: number
  y: number
}

export function findNearestIndex(
  points: ReadonlyArray<{ x: number }>,
  targetX: number,
) {
  if (points.length === 0) return 0
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].x < targetX) lo = mid + 1
    else hi = mid
  }
  if (
    lo > 0 &&
    Math.abs(points[lo - 1].x - targetX) <= Math.abs(points[lo].x - targetX)
  ) {
    return lo - 1
  }
  return lo
}

type KeyPointLabels = {
  startName?: string | null
  peakName?: string | null
  finishName?: string | null
}

type UseRouteElevationModelArgs = {
  preview: ParsedRoutePreview
  width: number
  isCompactLayout: boolean
  activeSampleIndex: number | null
  placeHints: Array<{ name: string; coord: string }>
  keyPointLabels?: KeyPointLabels
}

export function useRouteElevationModel({
  preview,
  width,
  isCompactLayout,
  activeSampleIndex,
  placeHints,
  keyPointLabels,
}: UseRouteElevationModelArgs) {
  const metrics = useMemo(() => {
    const samples = Array.isArray(preview?.elevationProfile)
      ? preview.elevationProfile
      : []
    const totalDistanceKm = calculateRouteDistanceKm(preview?.linePoints ?? [])

    // Single pass over samples: compute min/max/ascent/descent/peak
    let minElevation = Infinity
    let maxElevation = -Infinity
    let peakSample: (typeof samples)[number] | null = null
    let ascent = 0
    let descent = 0
    let validElevationCount = 0

    for (let i = 0; i < samples.length; i += 1) {
      const s = samples[i]
      const e = s.elevationM
      if (!Number.isFinite(e)) continue
      validElevationCount += 1
      if (e < minElevation) minElevation = e
      if (e > maxElevation) {
        maxElevation = e
        peakSample = s
      }
      if (i > 0) {
        const delta = e - samples[i - 1].elevationM
        if (delta > 0) ascent += delta
        else if (delta < 0) descent += -delta
      }
    }

    const hasElevation = validElevationCount >= 2

    if (!hasElevation) {
      return {
        samples,
        totalDistanceKm,
        hasElevation: false as const,
        minElevation: null as number | null,
        maxElevation: null as number | null,
        elevationRange: 1,
        ascent: 0,
        descent: 0,
        avgClimbMPerKm: null as number | null,
        startSample: null as (typeof samples)[number] | null,
        finishSample: null as (typeof samples)[number] | null,
        peakSample: null as (typeof samples)[number] | null,
      }
    }

    const elevationRange = Math.max(1, maxElevation - minElevation)
    const startSample = samples[0] ?? null
    const finishSample = samples[samples.length - 1] ?? null
    const avgClimbMPerKm = totalDistanceKm > 0 ? ascent / totalDistanceKm : null

    return {
      samples,
      totalDistanceKm,
      hasElevation: true as const,
      minElevation,
      maxElevation,
      elevationRange,
      ascent,
      descent,
      avgClimbMPerKm,
      startSample,
      finishSample,
      peakSample,
    }
  }, [preview])

  const chartGeometry = useMemo(() => {
    const empty = {
      chartPoints: [] as ChartPoint[],
      polylinePoints: '',
      areaPath: '',
      yAxisGuides: [] as Array<{
        key: string
        y: number
        x1: number
        x2: number
        label: string
      }>,
    }
    if (!metrics.hasElevation || width <= 0 || metrics.samples.length < 2) {
      return empty
    }

    const chartW = Math.max(1, width - CHART_PADDING * 2)
    const chartH = CHART_HEIGHT - CHART_PADDING * 2
    const totalDistance = Math.max(0.001, metrics.totalDistanceKm)
    const minElev = metrics.minElevation ?? 0
    const range = metrics.elevationRange
    const baselineY = CHART_HEIGHT - CHART_PADDING

    const chartPoints = new Array(metrics.samples.length)
    let polylineStr = ''
    for (let i = 0; i < metrics.samples.length; i += 1) {
      const sample = metrics.samples[i]
      const x = CHART_PADDING + (sample.distanceKm / totalDistance) * chartW
      const y =
        CHART_PADDING +
        (1 - (sample.elevationM - minElev) / range) * chartH
      chartPoints[i] = { index: i, sample, x, y }
      polylineStr += i === 0 ? `${x},${y}` : ` ${x},${y}`
    }

    const first = chartPoints[0]
    const last = chartPoints[chartPoints.length - 1]
    const areaPath = `M ${first.x} ${baselineY} L ${polylineStr} L ${last.x} ${baselineY} Z`

    const guideCount = isCompactLayout ? 2 : 3
    const yAxisGuides = Array.from({ length: guideCount }, (_, index) => {
      const progress = index / (guideCount - 1)
      const elevation = (metrics.maxElevation ?? 0) - range * progress
      const y = CHART_PADDING + chartH * progress
      return {
        key: `guide-${index}`,
        y,
        x1: CHART_PADDING,
        x2: CHART_PADDING + chartW,
        label: formatProfileMeters(elevation),
      }
    })

    return { chartPoints, polylinePoints: polylineStr, areaPath, yAxisGuides }
  }, [metrics, width, isCompactLayout])

  const locationLabels = useMemo(() => {
    const linePoints = Array.isArray(preview?.linePoints)
      ? preview.linePoints
      : []
    if (linePoints.length < 2) {
      return {
        startName: null as string | null,
        peakName: null as string | null,
        finishName: null as string | null,
      }
    }
    const startCoord = parseProfileCoord(linePoints[0]?.coord ?? '')
    const finishCoord = parseProfileCoord(
      linePoints[linePoints.length - 1]?.coord ?? '',
    )
    const peakPoint = getPeakRoutePoint(linePoints)
    const peakCoord = parseProfileCoord(String(peakPoint?.coord ?? ''))

    const fallback = {
      startName: resolveNearestHintName(startCoord, placeHints),
      peakName: resolveNearestHintName(peakCoord, placeHints),
      finishName: resolveNearestHintName(finishCoord, placeHints),
    }

    return {
      startName: keyPointLabels?.startName ?? fallback.startName,
      peakName: keyPointLabels?.peakName ?? fallback.peakName,
      finishName: keyPointLabels?.finishName ?? fallback.finishName,
    }
  }, [
    keyPointLabels?.finishName,
    keyPointLabels?.peakName,
    keyPointLabels?.startName,
    placeHints,
    preview,
  ])

  const keyPoints = useMemo(() => {
    const samples = Array.isArray(preview?.elevationProfile)
      ? preview.elevationProfile
      : []
    if (!metrics || !metrics.hasElevation || width <= 0 || samples.length < 2)
      return null

    const chartW = Math.max(1, width - CHART_PADDING * 2)
    const chartH = CHART_HEIGHT - CHART_PADDING * 2
    const totalDistance = Math.max(0.001, metrics.totalDistanceKm)
    const minElevation = metrics.minElevation ?? 0

    const toPoint = (
      sample: { distanceKm: number; elevationM: number } | null,
    ) => {
      if (!sample) return null
      const x = CHART_PADDING + (sample.distanceKm / totalDistance) * chartW
      const y =
        CHART_PADDING +
        (1 - (sample.elevationM - minElevation) / metrics.elevationRange) *
          chartH
      return { x, y }
    }

    return {
      start: toPoint(metrics.startSample),
      peak: toPoint(metrics.peakSample),
      finish: toPoint(metrics.finishSample),
    }
  }, [metrics, preview, width])

  const activePoint = useMemo(() => {
    if (activeSampleIndex == null) return null
    return chartGeometry.chartPoints[activeSampleIndex] ?? null
  }, [activeSampleIndex, chartGeometry.chartPoints])

  const tooltipText = useMemo(() => {
    if (!activePoint) return null
    return {
      title: `${formatProfileMeters(activePoint.sample.elevationM)} • ${formatProfileKm(activePoint.sample.distanceKm)}`,
      subtitle:
        activePoint.sample.distanceKm <= 0.05
          ? 'Старт маршрута'
          : activePoint.sample.distanceKm >= metrics.totalDistanceKm - 0.05
            ? 'Финиш маршрута'
            : 'Точка профиля',
    }
  }, [activePoint, metrics.totalDistanceKm])

  const summaryCards = useMemo(() => {
    if (!metrics.hasElevation) {
      return [
        {
          label: 'Дистанция',
          value: formatProfileKm(metrics.totalDistanceKm),
          icon: 'move',
          accent: true,
        },
        { label: 'Высоты', value: 'Не найдены', icon: 'slash', accent: false },
      ]
    }
    const cards = [
      {
        label: 'Дистанция',
        value: formatProfileKm(metrics.totalDistanceKm),
        icon: 'move',
        accent: true,
      },
      {
        label: 'Набор',
        value: `+${formatProfileMeters(metrics.ascent)}`,
        icon: 'trending-up',
        accent: true,
      },
      {
        label: 'Сброс',
        value: `-${formatProfileMeters(metrics.descent)}`,
        icon: 'trending-down',
        accent: false,
      },
      {
        label: 'Мин высота',
        value: formatProfileMeters(metrics.minElevation ?? 0),
        icon: 'corner-down-left',
        accent: false,
      },
      {
        label: 'Макс высота',
        value: formatProfileMeters(metrics.maxElevation ?? 0),
        icon: 'corner-up-right',
        accent: false,
      },
      {
        label: 'Перепад',
        value: formatProfileMeters(metrics.elevationRange),
        icon: 'activity',
        accent: false,
      },
    ]
    return cards
  }, [metrics])

  const profileSummary = useMemo(() => {
    if (!metrics.hasElevation) {
      return `Маршрут ${formatProfileKm(metrics.totalDistanceKm)} без данных о высотах`
    }
    const summaryParts = [
      formatProfileKm(metrics.totalDistanceKm),
      `+${Math.round(metrics.ascent)} м набора`,
      `пик ${formatProfileMeters(metrics.maxElevation ?? 0)}`,
    ]
    if (Number.isFinite(metrics.avgClimbMPerKm as number)) {
      summaryParts.push(`${Math.round(metrics.avgClimbMPerKm as number)} м/км`)
    }
    return summaryParts.join(' • ')
  }, [metrics])

  const pointCards = useMemo(() => {
    if (!metrics.hasElevation) return []

    const buildCaption = (
      name: string,
      fallback: string,
      distanceKm?: number | null,
    ) => {
      const parts = [name || fallback]
      if (!isCompactLayout && Number.isFinite(distanceKm as number)) {
        parts.push(formatProfileKm(distanceKm as number))
      }
      return parts.join(' • ')
    }

    return [
      {
        key: 'start',
        label: 'Старт',
        icon: 'play',
        value: metrics.startSample
          ? formatProfileMeters(metrics.startSample.elevationM)
          : '—',
        caption: buildCaption(
          locationLabels.startName ?? '',
          isCompactLayout ? 'Начало' : 'Начало маршрута',
        ),
      },
      {
        key: 'peak',
        label: 'Высшая точка',
        icon: 'triangle',
        value: metrics.peakSample
          ? formatProfileMeters(metrics.peakSample.elevationM)
          : '—',
        caption: buildCaption(
          locationLabels.peakName ?? '',
          isCompactLayout ? 'Высшая точка' : 'Самая высокая точка',
          metrics.peakSample?.distanceKm ?? null,
        ),
      },
      {
        key: 'finish',
        label: 'Финиш',
        icon: 'flag',
        value: metrics.finishSample
          ? formatProfileMeters(metrics.finishSample.elevationM)
          : '—',
        caption: buildCaption(
          locationLabels.finishName ?? '',
          isCompactLayout ? 'Финиш' : 'Конец маршрута',
        ),
      },
    ]
  }, [
    isCompactLayout,
    locationLabels.finishName,
    locationLabels.peakName,
    locationLabels.startName,
    metrics,
  ])

  return {
    metrics,
    chartPoints: chartGeometry.chartPoints,
    polylinePoints: chartGeometry.polylinePoints,
    areaPath: chartGeometry.areaPath,
    yAxisGuides: chartGeometry.yAxisGuides,
    locationLabels,
    keyPoints,
    activePoint,
    tooltipText,
    summaryCards,
    profileSummary,
    pointCards,
  }
}
