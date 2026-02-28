import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import Feather from '@expo/vector-icons/Feather';

import type { ParsedRoutePreview } from '@/types/travelRoutes';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { calculateRouteDistanceKm } from '@/utils/routeFileParser';

type Props = {
  preview: ParsedRoutePreview;
  onDownloadTrack?: () => void | Promise<void>;
  canDownloadTrack?: boolean;
  isDownloadPending?: boolean;
  placeHints?: Array<{ name: string; coord: string }>;
  transportHints?: string[];
  keyPointLabels?: {
    startName?: string | null;
    peakName?: string | null;
    finishName?: string | null;
  };
};

const CHART_HEIGHT = 120;
const CHART_PADDING = 8;

const round = (value: number): number => Math.round(value * 10) / 10;
const formatKm = (value: number): string => `${round(value)} км`;

export default function RouteElevationProfile({
  preview,
  onDownloadTrack,
  canDownloadTrack = false,
  isDownloadPending = false,
  placeHints = [],
  transportHints = [],
  keyPointLabels,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [width, setWidth] = useState(0);

  const metrics = useMemo(() => {
    const samples = Array.isArray(preview?.elevationProfile) ? preview.elevationProfile : [];
    const totalDistanceKm = calculateRouteDistanceKm(preview?.linePoints ?? []);
    const elevations = samples.map((s) => s.elevationM).filter((v) => Number.isFinite(v));
    const hasElevation = elevations.length >= 2;

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
      };
    }

    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const elevationRange = Math.max(1, maxElevation - minElevation);
    const startSample = samples[0] ?? null;
    const finishSample = samples[samples.length - 1] ?? null;
    const peakSample = samples.reduce((peak, current) =>
      current.elevationM > peak.elevationM ? current : peak,
    samples[0]);

    let ascent = 0;
    let descent = 0;
    for (let i = 1; i < samples.length; i += 1) {
      const delta = samples[i].elevationM - samples[i - 1].elevationM;
      if (delta > 0) ascent += delta;
      if (delta < 0) descent += Math.abs(delta);
    }

    const avgClimbMPerKm = totalDistanceKm > 0 ? ascent / totalDistanceKm : null;

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
    };
  }, [preview]);

  const locationLabels = useMemo(() => {
    const parseCoord = (coord: string): { lat: number; lng: number } | null => {
      const [latStr, lngStr] = String(coord ?? '').replace(/;/g, ',').split(',');
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    };
    const haversineMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
      const toRad = (v: number) => (v * Math.PI) / 180;
      const R = 6371000;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLng / 2);
      const h = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    };

    const linePoints = Array.isArray(preview?.linePoints) ? preview.linePoints : [];
    if (linePoints.length < 2) {
      return { startName: null as string | null, peakName: null as string | null, finishName: null as string | null };
    }
    const startCoord = parseCoord(linePoints[0]?.coord ?? '');
    const finishCoord = parseCoord(linePoints[linePoints.length - 1]?.coord ?? '');

    let peakPoint = linePoints[0] ?? null;
    for (const p of linePoints) {
      if (
        Number.isFinite(p?.elevation as number) &&
        (!Number.isFinite(peakPoint?.elevation as number) || Number(p.elevation) > Number(peakPoint?.elevation))
      ) {
        peakPoint = p;
      }
    }
    const peakCoord = parseCoord(String(peakPoint?.coord ?? ''));
    const hints = (Array.isArray(placeHints) ? placeHints : [])
      .map((p) => ({ name: String(p.name ?? '').trim(), coord: parseCoord(String(p.coord ?? '')) }))
      .filter((p): p is { name: string; coord: { lat: number; lng: number } } => Boolean(p.name && p.coord));

    const resolveName = (target: { lat: number; lng: number } | null): string | null => {
      if (!target || hints.length === 0) return null;
      let best: { name: string; dist: number } | null = null;
      for (const h of hints) {
        const dist = haversineMeters(target, h.coord);
        if (!best || dist < best.dist) best = { name: h.name, dist };
      }
      if (!best) return null;
      return best.dist <= 30000 ? best.name : null;
    };

    const fallback = {
      startName: resolveName(startCoord),
      peakName: resolveName(peakCoord),
      finishName: resolveName(finishCoord),
    };

    return {
      startName: keyPointLabels?.startName ?? fallback.startName,
      peakName: keyPointLabels?.peakName ?? fallback.peakName,
      finishName: keyPointLabels?.finishName ?? fallback.finishName,
    };
  }, [keyPointLabels?.finishName, keyPointLabels?.peakName, keyPointLabels?.startName, placeHints, preview]);

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

  const keyPoints = useMemo(() => {
    const samples = Array.isArray(preview?.elevationProfile) ? preview.elevationProfile : [];
    if (!metrics || !metrics.hasElevation || width <= 0 || samples.length < 2) return null;

    const chartW = Math.max(1, width - CHART_PADDING * 2);
    const chartH = CHART_HEIGHT - CHART_PADDING * 2;
    const totalDistance = Math.max(0.001, metrics.totalDistanceKm);

    const toPoint = (sample: { distanceKm: number; elevationM: number } | null) => {
      if (!sample) return null;
      const x = CHART_PADDING + (sample.distanceKm / totalDistance) * chartW;
      const y =
        CHART_PADDING +
        (1 - (sample.elevationM - metrics.minElevation) / metrics.elevationRange) * chartH;
      return { x, y };
    };

    return {
      start: toPoint(metrics.startSample),
      peak: toPoint(metrics.peakSample),
      finish: toPoint(metrics.finishSample),
    };
  }, [metrics, preview, width]);

  const pointTitles = useMemo(() => {
    const startElevation = metrics.startSample ? `${Math.round(metrics.startSample.elevationM)} м` : null;
    const peakElevation = metrics.peakSample ? `${Math.round(metrics.peakSample.elevationM)} м` : null;
    const peakDistance = metrics.peakSample ? formatKm(metrics.peakSample.distanceKm) : null;
    const finishElevation = metrics.finishSample ? `${Math.round(metrics.finishSample.elevationM)} м` : null;

    const startName = locationLabels.startName ?? '';
    const peakName = locationLabels.peakName ?? '';
    const finishName = locationLabels.finishName ?? '';

    return {
      start: [startName, startElevation ? `(${startElevation})` : null].filter(Boolean).join(' '),
      peak: [peakName, peakElevation ? `(${peakElevation}${peakDistance ? `, ${peakDistance}` : ''})` : null]
        .filter(Boolean)
        .join(' '),
      finish: [finishName, finishElevation ? `(${finishElevation})` : null].filter(Boolean).join(' '),
    };
  }, [locationLabels.finishName, locationLabels.peakName, locationLabels.startName, metrics.finishSample, metrics.peakSample, metrics.startSample]);

  const summaryCards = useMemo(() => {
    if (!metrics.hasElevation) {
      return [
        { label: 'Дистанция', value: `${round(metrics.totalDistanceKm)} км` },
        { label: 'Высоты', value: 'Не найдены' },
      ];
    }
    const cards = [
      { label: 'Дистанция', value: `${round(metrics.totalDistanceKm)} км` },
      { label: 'Набор', value: `+${Math.round(metrics.ascent)} м` },
      { label: 'Сброс', value: `-${Math.round(metrics.descent)} м` },
      { label: 'Мин высота', value: `${Math.round(metrics.minElevation ?? 0)} м` },
      { label: 'Макс высота', value: `${Math.round(metrics.maxElevation ?? 0)} м` },
    ];
    if (Number.isFinite(metrics.avgClimbMPerKm as number)) {
      cards.push({ label: 'Средний набор', value: `${Math.round(metrics.avgClimbMPerKm as number)} м/км` });
    }
    return cards;
  }, [metrics]);

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
      <View style={styles.headerRow}>
        <Text style={styles.title}>Профиль высот</Text>
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
          <View key={`${card.label}-${card.value}`} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{card.label}</Text>
            <Text style={styles.summaryValue}>{card.value}</Text>
          </View>
        ))}
      </View>

      {metrics.hasElevation && width > 0 ? (
        <View style={styles.chartWrap}>
          <Svg width={width} height={CHART_HEIGHT}>
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
            <Polyline
              points={polylinePoints}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {keyPoints?.start ? (
              <Circle cx={keyPoints.start.x} cy={keyPoints.start.y} r={3.5} fill={colors.primary} />
            ) : null}
            {keyPoints?.peak ? (
              <Circle cx={keyPoints.peak.x} cy={keyPoints.peak.y} r={4} fill={colors.info} />
            ) : null}
            {keyPoints?.finish ? (
              <Circle cx={keyPoints.finish.x} cy={keyPoints.finish.y} r={3.5} fill={colors.primaryDark} />
            ) : null}
          </Svg>
          <View style={styles.axisLabels}>
            <Text style={styles.axisText}>0 км</Text>
            <Text style={styles.axisText}>{formatKm(metrics.totalDistanceKm)}</Text>
          </View>
          {(locationLabels.startName || locationLabels.peakName || locationLabels.finishName || transportHints.length > 0) ? (
            <View style={styles.tagsRow}>
              {(locationLabels.startName || locationLabels.peakName || locationLabels.finishName) ? (
                <View style={styles.namedPlacesRow}>
                  <Text style={[styles.placeName, styles.placeNameStart]} numberOfLines={1}>
                    {pointTitles.start}
                  </Text>
                  <Text style={[styles.placeName, styles.placeNamePeak]} numberOfLines={1}>
                    {pointTitles.peak}
                  </Text>
                  <Text style={[styles.placeName, styles.placeNameFinish]} numberOfLines={1}>
                    {pointTitles.finish}
                  </Text>
                </View>
              ) : null}
              {transportHints.length > 0 ? (
                <Text style={styles.tagItem}>Транспорт: {transportHints.join(', ')}</Text>
              ) : null}
            </View>
          ) : null}
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
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    downloadBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    downloadBtnPressed: {
      opacity: 0.85,
      backgroundColor: colors.backgroundSecondary,
    },
    downloadBtnDisabled: {
      opacity: 0.45,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    summaryCard: {
      minWidth: 128,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 2,
    },
    summaryValue: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.text,
      fontWeight: '700',
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
    tagsRow: {
      marginTop: 2,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      marginHorizontal: DESIGN_TOKENS.spacing.sm,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    namedPlacesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    placeName: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '700',
      flex: 1,
    },
    placeNameStart: {
      textAlign: 'left',
    },
    placeNamePeak: {
      textAlign: 'center',
    },
    placeNameFinish: {
      textAlign: 'right',
    },
    tagItem: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.text,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: 4,
      fontWeight: '600',
    },
  });
