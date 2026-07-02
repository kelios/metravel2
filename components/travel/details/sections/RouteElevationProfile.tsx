import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import Svg, { Circle, Line } from 'react-native-svg'
import Feather from '@expo/vector-icons/Feather'

import type { ParsedRoutePreview } from '@/types/travelRoutes'
import { useThemedColors } from '@/hooks/useTheme'
import { createRouteElevationProfileStyles } from './RouteElevationProfile.styles'
import { ChartStaticLayers } from './routeElevationProfile/ChartStaticLayers'
import {
  CHART_HEIGHT,
  CHART_PADDING,
  formatProfileKm,
  formatProfileMeters,
  getLocalPointerX,
} from './RouteElevationProfile.utils'
import {
  findNearestIndex,
  useRouteElevationModel,
  type ChartPoint,
} from './routeElevationProfile/useRouteElevationModel'

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

  const {
    metrics,
    chartPoints,
    polylinePoints,
    areaPath,
    yAxisGuides,
    keyPoints,
    activePoint,
    tooltipText,
    summaryCards,
    profileSummary,
    pointCards,
  } = useRouteElevationModel({
    preview,
    width,
    isCompactLayout,
    activeSampleIndex,
    placeHints,
    keyPointLabels,
  })

  const chartPointsRef = useRef<ChartPoint[]>(chartPoints)
  chartPointsRef.current = chartPoints
  const rafRef = useRef<number | null>(null)
  const pendingXRef = useRef<number | null>(null)

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextWidth = Math.round(event.nativeEvent.layout.width)
      setWidth((prev) => (prev === nextWidth ? prev : nextWidth))
    },
    [],
  )

  const updateActivePoint = useCallback((locationX: number) => {
    pendingXRef.current = locationX
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const x = pendingXRef.current
      if (x == null) return
      const pts = chartPointsRef.current
      if (pts.length < 2) return
      setActiveSampleIndex(findNearestIndex(pts, x))
    })
  }, [])

  const clearActivePoint = useCallback(() => {
    pendingXRef.current = null
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setActiveSampleIndex(null)
  }, [])

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

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
            accessibilityLabel="Скачать трек в GPX"
            accessibilityState={{ disabled: isDownloadPending, busy: isDownloadPending }}
            style={({ pressed }) => [
              styles.downloadBtn,
              pressed && styles.downloadBtnPressed,
              isDownloadPending && styles.downloadBtnDisabled,
            ]}
            disabled={isDownloadPending}
          >
            {isDownloadPending ? (
              <ActivityIndicator size="small" color={colors.primaryDark} />
            ) : (
              <Feather name="download" size={14} color={colors.primaryDark} />
            )}
            <Text style={styles.downloadBtnText}>
              {isDownloadPending ? 'Скачивание…' : 'GPX'}
            </Text>
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
            <ChartStaticLayers
              width={width}
              yAxisGuides={yAxisGuides}
              areaPath={areaPath}
              polylinePoints={polylinePoints}
              chartAreaColor={chartAreaColor}
              chartLineColor={chartLineColor}
              borderLightColor={colors.borderLight}
              infoColor={colors.info}
              primaryDarkColor={colors.primaryDark}
              keyPoints={keyPoints}
            />
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
            onMoveShouldSetResponder={() => Platform.OS === 'web'}
            onResponderGrant={(event) =>
              updateActivePoint(event.nativeEvent.locationX)
            }
            onResponderMove={(event) =>
              updateActivePoint(event.nativeEvent.locationX)
            }
            onResponderRelease={clearActivePoint}
            {...(Platform.OS === 'web'
              ? ({
                  onPointerMove: (event: any) => {
                    const nextLocationX = getLocalPointerX(event)
                    if (typeof nextLocationX === 'number') {
                      updateActivePoint(nextLocationX)
                    }
                  },
                  onPointerLeave: clearActivePoint,
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
