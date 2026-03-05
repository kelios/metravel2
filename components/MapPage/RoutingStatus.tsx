import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface RoutingStatusProps {
  isLoading: boolean;
  error: string | boolean | null;
  distance: number | null;
  duration?: number | null;
  transportMode: 'car' | 'bike' | 'foot';
  isEstimated?: boolean;
  elevationGain?: number | null;
  elevationLoss?: number | null;
  compact?: boolean;
}

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} мин`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
};

const formatDurationCompact = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}м`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}ч`;
  return `${h}ч ${m}м`;
};

const getModeIcon = (mode: 'car' | 'bike' | 'foot') => {
  switch (mode) {
    case 'bike': return 'activity';
    case 'foot': return 'navigation';
    default: return 'navigation-2';
  }
};

const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
};

const estimateTime = (meters: number, mode: 'car' | 'bike' | 'foot', compact = false) => {
  const speeds = { car: 60, bike: 20, foot: 5 };
  const speed = speeds[mode];
  const hours = (meters / 1000) / speed;

  if (hours < 1) return compact ? `${Math.round(hours * 60)}м` : `${Math.round(hours * 60)} мин`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return compact ? `${h}ч` : `${h} ч`;
  return compact ? `${h}ч ${m}м` : `${h} ч ${m} мин`;
};

function RoutingStatus({
  isLoading,
  error,
  distance,
  duration,
  transportMode,
  isEstimated = false,
  elevationGain,
  elevationLoss,
  compact = false,
}: RoutingStatusProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors, compact), [colors, compact]);

  // ✅ УЛУЧШЕНИЕ: Анимированный прогресс-бар для лучшего UX
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      // Запускаем анимацию прогресс-бара
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 3000, // 3 секунды для полного заполнения
        useNativeDriver: false,
      }).start();
    }
  }, [isLoading, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="small" color={colors.info} />
          <Text style={styles.loadingText}>Построение маршрута…</Text>
        </View>
        {/* ✅ УЛУЧШЕНИЕ: Прогресс-бар для визуализации процесса */}
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressWidth,
                backgroundColor: colors.info,
              }
            ]}
          />
        </View>
      </View>
    );
  }

  if (error && typeof error === 'string' && error !== 'Using direct line') {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <View style={styles.errorContent}>
          <Feather name="alert-circle" size={16} color={colors.danger} />
          <View style={styles.errorTextContainer}>
            <Text style={styles.errorTitle}>Ошибка маршрутизации</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (error === 'Using direct line') {
    return (
      <View style={[styles.container, styles.warningContainer]}>
        <View style={styles.warningContent}>
          <Feather name="info" size={16} color={colors.warning} />
          <View style={styles.warningTextContainer}>
            <Text style={styles.warningTitle}>Прямая линия</Text>
            <Text style={styles.warningMessage}>
              Оптимальный маршрут недоступен, показана прямая линия
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (distance !== null && distance > 0) {
    const time = duration != null && duration > 0
      ? (compact ? formatDurationCompact(duration) : formatDuration(duration))
      : estimateTime(distance, transportMode, compact);
    const showElevation =
      (transportMode === 'bike' || transportMode === 'foot') &&
      Number.isFinite(elevationGain as any) &&
      Number.isFinite(elevationLoss as any);
    const compactCardStyle = compact
      ? (showElevation ? styles.miniCardCompactTwoCol : styles.miniCardCompactHalf)
      : null;

    return (
      <View style={[styles.container, styles.successContainer, compact && styles.successContainerCompact]}>
        <View style={[styles.successHeader, compact && styles.successHeaderCompact]}>
          <Feather name={getModeIcon(transportMode)} size={compact ? 14 : 16} color={colors.success} />
          <Text style={styles.successTitle}>
            {isEstimated ? (compact ? 'Оценка' : 'Оценка маршрута') : (compact ? 'Маршрут готов' : 'Маршрут построен')}
          </Text>
        </View>
        <View style={styles.miniCardGrid}>
          <View style={[styles.miniCard, compact && styles.miniCardCompact, compactCardStyle]}>
            <Feather name="map" size={compact ? 12 : 14} color={colors.primary} />
            <Text style={[styles.miniCardValue, compact && styles.miniCardValueCompact]}>
              {formatDistance(distance)}
            </Text>
            <Text style={[styles.miniCardLabel, compact && styles.miniCardLabelCompact]}>
              {compact ? 'Дистанция' : 'Расстояние'}
            </Text>
          </View>
          <View style={[styles.miniCard, compact && styles.miniCardCompact, compactCardStyle]}>
            <Feather name="clock" size={compact ? 12 : 14} color={colors.primary} />
            <Text style={[styles.miniCardValue, compact && styles.miniCardValueCompact]}>
              {time}
            </Text>
            <Text style={[styles.miniCardLabel, compact && styles.miniCardLabelCompact]}>
              {compact ? 'Время' : 'Время в пути'}
            </Text>
          </View>
          {showElevation && (
            <>
              <View style={[styles.miniCard, compact && styles.miniCardCompact, compactCardStyle]}>
                <Feather name="trending-up" size={compact ? 12 : 14} color={colors.success} />
                <Text style={[styles.miniCardValue, compact && styles.miniCardValueCompact]}>
                  {Math.round(Number(elevationGain))} м
                </Text>
                <Text style={[styles.miniCardLabel, compact && styles.miniCardLabelCompact]}>
                  Набор
                </Text>
              </View>
              <View style={[styles.miniCard, compact && styles.miniCardCompact, compactCardStyle]}>
                <Feather name="trending-down" size={compact ? 12 : 14} color={colors.danger} />
                <Text style={[styles.miniCardValue, compact && styles.miniCardValueCompact]}>
                  {Math.round(Number(elevationLoss))} м
                </Text>
                <Text style={[styles.miniCardLabel, compact && styles.miniCardLabelCompact]}>
                  Спуск
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  return null;
}

export default React.memo(RoutingStatus);

const getStyles = (colors: ThemedColors, compact: boolean) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: compact ? 10 : 12,
    padding: compact ? 8 : 12,
    marginBottom: compact ? 6 : 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.info,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  errorContainer: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  errorContent: {
    flexDirection: 'row',
    gap: 10,
  },
  errorTextContainer: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
    marginBottom: 2,
  },
  errorMessage: {
    fontSize: 12,
    color: colors.dangerDark,
    lineHeight: 16,
  },
  warningContainer: {
    borderColor: colors.warning,
    backgroundColor: colors.warningLight,
  },
  warningContent: {
    flexDirection: 'row',
    gap: 10,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
    marginBottom: 2,
  },
  warningMessage: {
    fontSize: 12,
    color: colors.warningDark,
    lineHeight: 16,
  },
  successContainer: {
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  successContainerCompact: {
    padding: 0,
    borderRadius: 0,
    marginBottom: 0,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: compact ? 6 : 8,
    marginBottom: compact ? 8 : 10,
    paddingBottom: 0,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  successHeaderCompact: {
    marginBottom: 8,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  successTitle: {
    fontSize: compact ? 12 : 13,
    fontWeight: '600',
    color: colors.success,
  },
  miniCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: compact ? 8 : 10,
  },
  miniCard: {
    flex: 1,
    minWidth: compact ? 70 : 80,
    alignItems: 'center',
    gap: compact ? 3 : 4,
    padding: compact ? 10 : 12,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
  },
  miniCardCompact: {
    minHeight: 0,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 0,
    borderColor: 'transparent',
    gap: 4,
    backgroundColor: colors.backgroundSecondary,
  },
  miniCardCompactHalf: {
    flexBasis: '48%',
    maxWidth: '48%',
    flexGrow: 0,
  },
  miniCardCompactTwoCol: {
    flexBasis: '48%',
    maxWidth: '48%',
    flexGrow: 0,
  },
  miniCardValue: {
    fontSize: compact ? 15 : 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  miniCardValueCompact: {
    fontSize: 15,
    lineHeight: 20,
  },
  miniCardLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
  },
  miniCardLabelCompact: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
