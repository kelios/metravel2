/**
 * RouteStats — визуальные карточки статистики построенного маршрута
 * Используется в FiltersPanelRouteSection для отображения результатов маршрута
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface RouteStatsProps {
  distance: number | null;
  duration: number | null;
  transportMode: 'car' | 'bike' | 'foot';
  elevationGain?: number | null;
  elevationLoss?: number | null;
  isEstimated?: boolean;
}

const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
};

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} мин`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
};

const getModeLabel = (mode: 'car' | 'bike' | 'foot'): string => {
  switch (mode) {
    case 'bike': return 'Велосипед';
    case 'foot': return 'Пешком';
    default: return 'Авто';
  }
};

const getModeIcon = (mode: 'car' | 'bike' | 'foot'): React.ComponentProps<typeof Feather>['name'] => {
  switch (mode) {
    case 'bike': return 'activity';
    case 'foot': return 'navigation';
    default: return 'navigation-2';
  }
};

const RouteStats: React.FC<RouteStatsProps> = ({
  distance,
  duration,
  transportMode,
  elevationGain,
  elevationLoss,
  isEstimated = false,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const hasDistance = distance !== null && distance > 0;
  const hasDuration = duration !== null && duration > 0;
  const showElevation =
    (transportMode === 'bike' || transportMode === 'foot') &&
    Number.isFinite(elevationGain as number) &&
    Number.isFinite(elevationLoss as number);

  useEffect(() => {
    if (hasDistance) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,
      }).start();
    }
  }, [hasDistance, fadeAnim]);

  if (!hasDistance) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]} testID="route-stats-cards">
      {isEstimated && (
        <View style={styles.estimatedBadge}>
          <Feather name="info" size={12} color={colors.warning} />
          <Text style={styles.estimatedText}>Оценочные данные</Text>
        </View>
      )}
      <View style={styles.grid}>
        {/* Distance card */}
        <View style={styles.statCard}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
            <Feather name="map" size={16} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>{formatDistance(distance!)}</Text>
          <Text style={styles.statLabel}>Расстояние</Text>
        </View>

        {/* Duration card */}
        {hasDuration && (
          <View style={styles.statCard}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
              <Feather name="clock" size={16} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{formatDuration(duration!)}</Text>
            <Text style={styles.statLabel}>Время в пути</Text>
          </View>
        )}

        {/* Transport mode card */}
        <View style={styles.statCard}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
            <Feather name={getModeIcon(transportMode)} size={16} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>{getModeLabel(transportMode)}</Text>
          <Text style={styles.statLabel}>Транспорт</Text>
        </View>

        {/* Elevation cards */}
        {showElevation && (
          <>
            <View style={styles.statCard}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
                <Feather name="trending-up" size={16} color={colors.success} />
              </View>
              <Text style={styles.statValue}>{Math.round(Number(elevationGain))} м</Text>
              <Text style={styles.statLabel}>Набор высоты</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
                <Feather name="trending-down" size={16} color={colors.danger} />
              </View>
              <Text style={styles.statValue}>{Math.round(Number(elevationLoss))} м</Text>
              <Text style={styles.statLabel}>Спуск</Text>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
};

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      marginTop: 8,
      gap: 8,
    },
    estimatedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.mutedBackground ?? colors.backgroundSecondary,
      alignSelf: 'flex-start',
    },
    estimatedText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.warning,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statCard: {
      flex: 1,
      minWidth: 90,
      alignItems: 'center',
      gap: 4,
      padding: 10,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({ transition: 'transform 0.2s ease, box-shadow 0.2s ease' } as any)
        : null),
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    statValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
    },
  });

export default React.memo(RouteStats);
