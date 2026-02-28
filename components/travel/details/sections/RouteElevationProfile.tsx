import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import type { ParsedRoutePreview } from '@/types/travelRoutes';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { calculateRouteDistanceKm } from '@/utils/routeFileParser';

type Props = {
  preview: ParsedRoutePreview;
};

const CHART_HEIGHT = 120;
const CHART_PADDING = 8;

const round = (value: number): number => Math.round(value * 10) / 10;

export default function RouteElevationProfile({ preview }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [width, setWidth] = useState(0);

  const metrics = useMemo(() => {
    const samples = Array.isArray(preview?.elevationProfile) ? preview.elevationProfile : [];
    const linePointsCount = Array.isArray(preview?.linePoints) ? preview.linePoints.length : 0;

    const totalDistanceKm = calculateRouteDistanceKm(preview?.linePoints ?? []);
    const elevations = samples.map((s) => s.elevationM).filter((v) => Number.isFinite(v));
    const hasElevation = elevations.length >= 2;

    if (!hasElevation) {
      return {
        linePointsCount,
        totalDistanceKm,
        hasElevation: false,
        minElevation: null as number | null,
        maxElevation: null as number | null,
        elevationRange: 1,
        ascent: 0,
        descent: 0,
        avgClimbMPerKm: null as number | null,
      };
    }

    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const elevationRange = Math.max(1, maxElevation - minElevation);

    let ascent = 0;
    let descent = 0;
    for (let i = 1; i < samples.length; i += 1) {
      const delta = samples[i].elevationM - samples[i - 1].elevationM;
      if (delta > 0) ascent += delta;
      if (delta < 0) descent += Math.abs(delta);
    }

    const avgClimbMPerKm = totalDistanceKm > 0 ? ascent / totalDistanceKm : null;

    return {
      linePointsCount,
      totalDistanceKm,
      hasElevation: true,
      minElevation,
      maxElevation,
      elevationRange,
      ascent,
      descent,
      avgClimbMPerKm,
    };
  }, [preview]);

  const polylinePoints = useMemo(() => {
    const samples = Array.isArray(preview?.elevationProfile) ? preview.elevationProfile : [];
    if (!metrics || !metrics.hasElevation || width <= 0 || samples.length < 2) return '';

    const chartW = Math.max(1, width - CHART_PADDING * 2);
    const chartH = CHART_HEIGHT - CHART_PADDING * 2;
    const totalDistance = Math.max(0.001, metrics.totalDistanceKm);

    return samples
      .map((sample) => {
        const x = CHART_PADDING + (sample.distanceKm / totalDistance) * chartW;
        const y =
          CHART_PADDING +
          (1 - (sample.elevationM - metrics.minElevation) / metrics.elevationRange) * chartH;
        return `${x},${y}`;
      })
      .join(' ');
  }, [metrics, preview, width]);

  if (!metrics) {
    return null;
  }

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== width) {
      setWidth(nextWidth);
    }
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Text style={styles.title}>Профиль высот</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaItem}>Точек трека: {metrics.linePointsCount}</Text>
        <Text style={styles.metaItem}>Дистанция: {round(metrics.totalDistanceKm)} км</Text>
        {metrics.hasElevation ? (
          <>
            <Text style={styles.metaItem}>Набор: +{Math.round(metrics.ascent)} м</Text>
            <Text style={styles.metaItem}>Сброс: -{Math.round(metrics.descent)} м</Text>
            <Text style={styles.metaItem}>Мин: {Math.round(metrics.minElevation ?? 0)} м</Text>
            <Text style={styles.metaItem}>Макс: {Math.round(metrics.maxElevation ?? 0)} м</Text>
            {Number.isFinite(metrics.avgClimbMPerKm as number) ? (
              <Text style={styles.metaItem}>Средний набор: {Math.round(metrics.avgClimbMPerKm as number)} м/км</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.metaItem}>Высоты в файле не найдены</Text>
        )}
      </View>

      {metrics.hasElevation && width > 0 ? (
        <View style={styles.chartWrap}>
          <Svg width={width} height={CHART_HEIGHT}>
            <Polyline
              points={polylinePoints}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
          <View style={styles.axisLabels}>
            <Text style={styles.axisText}>{Math.round(metrics.minElevation ?? 0)} м</Text>
            <Text style={styles.axisText}>{Math.round(metrics.maxElevation ?? 0)} м</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      marginTop: DESIGN_TOKENS.spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      padding: DESIGN_TOKENS.spacing.md,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    metaItem: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    chartWrap: {
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      overflow: 'hidden',
    },
    axisLabels: {
      marginTop: 2,
      marginHorizontal: DESIGN_TOKENS.spacing.sm,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    axisText: {
      fontSize: 11,
      color: colors.textMuted,
    },
  });
