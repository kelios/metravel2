import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface RoutingStatusProps {
  isLoading: boolean;
  error: string | boolean | null;
  distance: number | null;
  transportMode: 'car' | 'bike' | 'foot';
}

const getModeLabel = (mode: 'car' | 'bike' | 'foot') => {
  switch (mode) {
    case 'bike': return 'Велосипед';
    case 'foot': return 'Пешком';
    default: return 'Автомобиль';
  }
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

const estimateTime = (meters: number, mode: 'car' | 'bike' | 'foot') => {
  const speeds = { car: 60, bike: 20, foot: 5 };
  const speed = speeds[mode];
  const hours = (meters / 1000) / speed;
  
  if (hours < 1) return `${Math.round(hours * 60)} мин`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
};

export default function RoutingStatus({
  isLoading,
  error,
  distance,
  transportMode,
}: RoutingStatusProps) {
  const themeColors = useThemedColors();
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="small" color={themeColors.info} />
          <Text style={styles.loadingText}>Построение маршрута…</Text>
        </View>
      </View>
    );
  }

  if (error && typeof error === 'string' && error !== 'Using direct line') {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <View style={styles.errorContent}>
          <Feather name="alert-circle" size={16} color={DESIGN_TOKENS.colors.danger} />
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
          <Feather name="info" size={16} color={DESIGN_TOKENS.colors.warning} />
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
    const time = estimateTime(distance, transportMode);
    return (
      <View style={[styles.container, styles.successContainer]}>
        <View style={styles.successHeader}>
          <Feather name={getModeIcon(transportMode)} size={16} color={DESIGN_TOKENS.colors.success} />
          <Text style={styles.successTitle}>Маршрут построен</Text>
        </View>
        <View style={styles.successStats}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Расстояние:</Text>
            <Text style={styles.statValue}>{formatDistance(distance)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Время:</Text>
            <Text style={styles.statValue}>{time}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Способ:</Text>
            <Text style={styles.statValue}>{getModeLabel(transportMode)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    ...DESIGN_TOKENS.shadowsNative.light,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
    color: DESIGN_TOKENS.colors.info,
  },
  errorContainer: {
    borderColor: DESIGN_TOKENS.colors.danger,
    backgroundColor: DESIGN_TOKENS.colors.dangerLight,
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
    color: DESIGN_TOKENS.colors.danger,
    marginBottom: 2,
  },
  errorMessage: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.dangerDark,
    lineHeight: 16,
  },
  warningContainer: {
    borderColor: DESIGN_TOKENS.colors.warning,
    backgroundColor: DESIGN_TOKENS.colors.warningLight,
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
    color: DESIGN_TOKENS.colors.warning,
    marginBottom: 2,
  },
  warningMessage: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.warningDark,
    lineHeight: 16,
  },
  successContainer: {
    borderColor: DESIGN_TOKENS.colors.success,
    backgroundColor: DESIGN_TOKENS.colors.successLight,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: DESIGN_TOKENS.colors.successLight,
  },
  successTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.success,
  },
  successStats: {
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.textMuted,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.text,
  },
});
