import React, { useMemo, useState } from 'react'
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg'
import Feather from '@expo/vector-icons/Feather'

import type { ParsedRoutePreview } from '@/types/travelRoutes'
import { useThemedColors } from '@/hooks/useTheme'
import { calculateRouteDistanceKm } from '@/utils/routeFileParser'
import { createRouteElevationProfileStyles } from './RouteElevationProfile.styles'
import {
  CHART_HEIGHT,
  CHART_PADDING,
  formatProfileKm,
  formatProfileMeters,
  getLocalPointerX,
  getPeakRoutePoint,
  parseProfileCoord,
  resolveNearestHintName,
} from './RouteElevationProfile.utils'

type Props = {
  title?: string
  lineColor?: string
  preview: ParsedRoutePreview
  onDownloadTrack?: () => void | Promise<void>
  canDownloadTrack?: boolean
  isDownloadPending?: boolean
  placeHints?: Array<{ name: string; coord: string }>
  transportHints?: string[]
  keyPointLabels?: {
    startName?: string | null
    peakName?: string | null
    finishName?: string | null
  }
}

export default function RouteElevationProfile({
  title = 'Профиль высот',
  lineColor,
  preview,
  onDownloadTrack,
  canDownloadTrack = false,
  isDownloadPending = false,
  placeHints = [],
  transportHints = [],
  keyPointLabels,
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(
    () => createRouteElevationProfileStyles(colors),
    [colors],
  )
  const chartLineColor = lineColor || colors.primary
  const chartAreaColor = colors.primaryAlpha30
  const [width, setWidth] = useState(0)
  const [activeSampleIndex, setActiveSampleIndex] = useState<number | null>(
    null,
  )
  const isCompactLayout = width > 0 && width < 520

  const metrics = useMemo(() => {
    const samples = Array.isArray(preview?.elevationProfile)
      ? preview.elevationProfile
      : []
    const totalDistanceKm = calculateRouteDistanceKm(preview?.linePoints ?? [])
    const elevations = samples
      .map((s) => s.elevationM)
      .filter((v) => Number.isFinite(v))
    const hasElevation = elevations.length >= 2

    if (!hasElevation) {
      return {
        totalDistanceKm,
        hasElevation: false,
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

    const minElevation = Math.min(...elevations)
    const maxElevation = Math.max(...elevations)
    const elevationRange = Math.max(1, maxElevation - minElevation)
    const startSample = samples[0] ?? null
    const finishSample = samples[samples.length - 1] ?? null
    const peakSample = samples.reduce(
      (peak, current) =>
        current.elevationM > peak.elevationM ? current : peak,
      samples[0],
    )

    let ascent = 0
    let descent = 0
    for (let i = 1; i < samples.length; i += 1) {
      const delta = samples[i].elevationM - samples[i - 1].elevationM
      if (delta > 0) ascent += delta
      if (delta < 0) descent += Math.abs(delta)
    }

    const avgClimbMPerKm = totalDistanceKm > 0 ? ascent / totalDistanceKm : null

    return {
      totalDistanceKm,
      hasElevation: true,
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

  const chartPoints = useMemo(() => {
    const samples = Array.isArray(preview?.elevationProfile)
      ? preview.elevationProfile
      : []
    if (!metrics || !metrics.hasElevation || width <= 0 || samples.length < 2)
      return []

    const chartW = Math.max(1, width - CHART_PADDING * 2)
    const chartH = CHART_HEIGHT - CHART_PADDING * 2
    const totalDistance = Math.max(0.001, metrics.totalDistanceKm)
    const minElevation = metrics.minElevation ?? 0

    return samples.map((sample, index) => ({
      index,
      sample,
      x: CHART_PADDING + (sample.distanceKm / totalDistance) * chartW,
      y:
        CHART_PADDING +
        (1 - (sample.elevationM - minElevation) / metrics.elevationRange) *
          chartH,
    }))
  }, [metrics, preview, width])

  const polylinePoints = useMemo(
    () => chartPoints.map((point) => `${point.x},${point.y}`).join(' '),
    [chartPoints],
  )

  const areaPath = useMemo(() => {
    if (chartPoints.length < 2) return ''
    const baselineY = CHART_HEIGHT - CHART_PADDING
    const first = chartPoints[0]
    const last = chartPoints[chartPoints.length - 1]
    const pointPath = chartPoints
      .map((point) => `${point.x},${point.y}`)
      .join(' ')
    return `M ${first.x} ${baselineY} L ${pointPath} L ${last.x} ${baselineY} Z`
  }, [chartPoints])

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
    return chartPoints[activeSampleIndex] ?? null
  }, [activeSampleIndex, chartPoints])

  const yAxisGuides = useMemo(() => {
    if (!metrics.hasElevation || width <= 0) return []
    const guideCount = isCompactLayout ? 2 : 3
    const chartWidth = Math.max(1, width - CHART_PADDING * 2)
    return Array.from({ length: guideCount }, (_, index) => {
      const progress = index / (guideCount - 1)
      const elevation =
        (metrics.maxElevation ?? 0) - metrics.elevationRange * progress
      const y = CHART_PADDING + (CHART_HEIGHT - CHART_PADDING * 2) * progress
      return {
        key: `guide-${index}`,
        y,
        x1: CHART_PADDING,
        x2: CHART_PADDING + chartWidth,
        label: formatProfileMeters(elevation),
      }
    })
  }, [isCompactLayout, metrics, width])

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

  if (!metrics) {
    return null
  }

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width)
    if (nextWidth !== width) {
      setWidth(nextWidth)
    }
  }

  const updateActivePoint = (locationX: number) => {
    if (chartPoints.length < 2) return
    let nextIndex = 0
    let minDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < chartPoints.length; i += 1) {
      const distance = Math.abs(chartPoints[i].x - locationX)
      if (distance < minDistance) {
        minDistance = distance
        nextIndex = i
      }
    }
    setActiveSampleIndex(nextIndex)
  }

  return (
    <View
      testID="route-elevation-profile"
      style={styles.container}
      onLayout={handleLayout}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{profileSummary}</Text>
        </View>
        {canDownloadTrack && onDownloadTrack ? (
          <Pressable
            onPress={() => void onDownloadTrack()}
            accessibilityRole="button"
            accessibilityLabel="Скачать трек"
            style={({ pressed }) => [
              styles.downloadBtn,
              pressed && styles.downloadBtnPressed,
              isDownloadPending && styles.downloadBtnDisabled,
            ]}
            disabled={isDownloadPending}
          >
            <Feather name="download" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.summaryGrid}>
        {summaryCards.map((card) => (
          <View
            key={`${card.label}-${card.value}`}
            style={[
              styles.summaryCard,
              card.accent && styles.summaryCardAccent,
            ]}
          >
            <View
              style={[
                styles.summaryIconWrap,
                card.accent && styles.summaryIconWrapAccent,
              ]}
            >
              <Feather
                name={card.icon as React.ComponentProps<typeof Feather>['name']}
                size={14}
                color={card.accent ? colors.primary : colors.textMuted}
              />
            </View>
            <Text style={styles.summaryLabel}>{card.label}</Text>
            <Text style={styles.summaryValue}>{card.value}</Text>
          </View>
        ))}
      </View>

      {metrics.hasElevation && width > 0 ? (
        <View style={styles.chartWrap}>
          <View style={styles.chartMetaRow}>
            <View
              style={[
                styles.chartMetaBadge,
                isCompactLayout && styles.chartMetaBadgeCompact,
              ]}
            >
              {!isCompactLayout ? (
                <Text style={styles.chartMetaLabel}>Мин</Text>
              ) : null}
              <Text style={styles.chartMetaValue}>
                {formatProfileMeters(metrics.minElevation ?? 0)}
              </Text>
            </View>
            <View
              style={[
                styles.chartMetaBadge,
                styles.chartMetaBadgePeak,
                isCompactLayout && styles.chartMetaBadgeCompact,
              ]}
            >
              {!isCompactLayout ? (
                <Text style={styles.chartMetaLabel}>Пик</Text>
              ) : null}
              <Text style={styles.chartMetaValue}>
                {formatProfileMeters(metrics.maxElevation ?? 0)}
              </Text>
            </View>
          </View>
          {activePoint && tooltipText ? (
            <View
              style={[
                styles.tooltip,
                {
                  pointerEvents: 'none',
                  left: Math.max(
                    8,
                    Math.min(
                      activePoint.x - (isCompactLayout ? 44 : 52),
                      width - (isCompactLayout ? 98 : 116),
                    ),
                  ),
                  top: Math.max(8, activePoint.y - (isCompactLayout ? 34 : 44)),
                },
              ]}
            >
              <Text style={styles.tooltipTitle}>{tooltipText.title}</Text>
              {!isCompactLayout ? (
                <Text style={styles.tooltipSubtitle}>
                  {tooltipText.subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Svg width={width} height={CHART_HEIGHT}>
            {yAxisGuides.map((guide) => (
              <Line
                key={guide.key}
                x1={guide.x1}
                y1={guide.y}
                x2={guide.x2}
                y2={guide.y}
                stroke={colors.borderLight}
                strokeWidth={1}
                strokeDasharray="2 4"
                opacity={0.75}
              />
            ))}
            <Rect
              x={0}
              y={0}
              width={width}
              height={CHART_HEIGHT}
              fill="transparent"
            />
            {keyPoints?.peak ? (
              <Line
                x1={keyPoints.peak.x}
                y1={CHART_PADDING}
                x2={keyPoints.peak.x}
                y2={CHART_HEIGHT - CHART_PADDING}
                stroke={colors.info}
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.7}
              />
            ) : null}
            {areaPath ? (
              <Path d={areaPath} fill={chartAreaColor} opacity={0.7} />
            ) : null}
            <Polyline
              points={polylinePoints}
              fill="none"
              stroke={chartLineColor}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {keyPoints?.start ? (
              <Circle
                cx={keyPoints.start.x}
                cy={keyPoints.start.y}
                r={3.5}
                fill={chartLineColor}
              />
            ) : null}
            {keyPoints?.peak ? (
              <Circle
                cx={keyPoints.peak.x}
                cy={keyPoints.peak.y}
                r={4}
                fill={colors.info}
              />
            ) : null}
            {keyPoints?.finish ? (
              <Circle
                cx={keyPoints.finish.x}
                cy={keyPoints.finish.y}
                r={3.5}
                fill={colors.primaryDark}
              />
            ) : null}
            {activePoint ? (
              <>
                <Line
                  x1={activePoint.x}
                  y1={CHART_PADDING}
                  x2={activePoint.x}
                  y2={CHART_HEIGHT - CHART_PADDING}
                  stroke={colors.primary}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.45}
                />
                <Circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r={5}
                  fill={colors.surface}
                  stroke={colors.primary}
                  strokeWidth={2}
                />
              </>
            ) : null}
          </Svg>
          <View style={[styles.yAxisLabels, { pointerEvents: 'none' }]}>
            {yAxisGuides.map((guide) => (
              <Text
                key={`${guide.key}-label`}
                style={[
                  styles.yAxisText,
                  isCompactLayout && styles.yAxisTextCompact,
                  {
                    top: guide.y - 8,
                  },
                ]}
              >
                {guide.label}
              </Text>
            ))}
          </View>
          <View
            style={styles.chartHitArea}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(event) =>
              updateActivePoint(event.nativeEvent.locationX)
            }
            onResponderMove={(event) =>
              updateActivePoint(event.nativeEvent.locationX)
            }
            onResponderRelease={() => setActiveSampleIndex(null)}
            {...(Platform.OS === 'web'
              ? ({
                  onPointerMove: (event: any) => {
                    const nextLocationX = getLocalPointerX(event)
                    if (typeof nextLocationX === 'number') {
                      updateActivePoint(nextLocationX)
                    }
                  },
                  onPointerLeave: () => setActiveSampleIndex(null),
                } as any)
              : null)}
          />
          <View style={styles.axisLabels}>
            <Text style={styles.axisText}>0 км</Text>
            <Text style={styles.axisText}>
              {formatProfileKm(metrics.totalDistanceKm)}
            </Text>
          </View>
          {pointCards.length > 0 || transportHints.length > 0 ? (
            <View style={styles.tagsRow}>
              {pointCards.length > 0 ? (
                <View
                  style={[
                    styles.pointCardsGrid,
                    isCompactLayout && styles.pointCardsGridCompact,
                  ]}
                >
                  {pointCards.map((point) => (
                    <View
                      key={point.key}
                      style={[
                        styles.pointCard,
                        isCompactLayout && styles.pointCardCompact,
                      ]}
                    >
                      <View style={styles.pointCardHeader}>
                        <Feather
                          name={
                            point.icon as React.ComponentProps<
                              typeof Feather
                            >['name']
                          }
                          size={13}
                          color={
                            point.key === 'peak' ? colors.info : colors.primary
                          }
                        />
                        <Text style={styles.pointCardLabel}>{point.label}</Text>
                      </View>
                      <Text style={styles.pointCardValue}>{point.value}</Text>
                      <Text
                        style={styles.pointCardCaption}
                        numberOfLines={isCompactLayout ? 1 : 2}
                      >
                        {isCompactLayout
                          ? point.caption.split(' • ')[0]
                          : point.caption}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {transportHints.length > 0 ? (
                <View style={styles.transportWrap}>
                  <Feather
                    name="navigation"
                    size={13}
                    color={colors.textMuted}
                  />
                  <Text style={styles.tagItem}>
                    Транспорт: {transportHints.join(', ')}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
