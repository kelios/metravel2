import React, { useEffect, useMemo, useRef } from 'react'
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import MapIcon from './MapIcon'

type TransportMode = 'car' | 'bike' | 'foot'

interface RoutingStatusProps {
  isLoading: boolean
  error: string | boolean | null
  distance: number | null
  duration?: number | null
  transportMode: TransportMode
  isEstimated?: boolean
  elevationGain?: number | null
  elevationLoss?: number | null
  compact?: boolean
  onRetry?: () => void
}

const TRANSPORT_SPEED_KMH: Record<TransportMode, number> = {
  car: 60,
  bike: 20,
  foot: 5,
}

const PROGRESS_ANIM_DURATION_MS = 3000
const PRESSED_OPACITY_07 = { opacity: 0.7 }

function formatDuration(seconds: number, compact = false): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const totalMinutes = Math.round(seconds / 60)
  if (totalMinutes < 60) return compact ? `${totalMinutes}м` : `${totalMinutes} мин`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (m === 0) return compact ? `${h}ч` : `${h} ч`
  return compact ? `${h}ч ${m}м` : `${h} ч ${m} мин`
}

function estimateDurationSeconds(meters: number, mode: TransportMode): number {
  return (meters / 1000 / TRANSPORT_SPEED_KMH[mode]) * 3600
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} м`
  return `${(meters / 1000).toFixed(1)} км`
}

function MiniCard({
  icon,
  iconColor,
  value,
  label,
  styles,
  compact,
  extraStyle,
}: {
  icon: React.ComponentProps<typeof Feather>['name']
  iconColor: string
  value: string
  label: string
  styles: ReturnType<typeof getStyles>
  compact: boolean
  extraStyle?: any
}) {
  return (
    <View style={[styles.miniCard, compact && styles.miniCardCompact, extraStyle]}>
      <Feather name={icon} size={compact ? 12 : 14} color={iconColor} />
      <Text style={[styles.miniCardValue, compact && styles.miniCardValueCompact]}>{value}</Text>
      <Text style={[styles.miniCardLabel, compact && styles.miniCardLabelCompact]}>{label}</Text>
    </View>
  )
}

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
  onRetry,
}: RoutingStatusProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors, compact), [colors, compact])

  const progressAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!isLoading) return
    progressAnim.setValue(0)
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: PROGRESS_ANIM_DURATION_MS,
      useNativeDriver: false,
    }).start()
  }, [isLoading, progressAnim])

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  if (isLoading) {
    return (
      <View
        style={styles.container}
        accessibilityRole="progressbar"
        accessibilityLabel="Построение маршрута"
        accessibilityLiveRegion="polite"
        {...(Platform.OS === 'web'
          ? ({ role: 'progressbar', 'aria-busy': true, 'aria-live': 'polite' } as any)
          : null)}
      >
        <View style={styles.loadingContent}>
          <ActivityIndicator size="small" color={colors.info} />
          <Text style={styles.loadingText}>Построение маршрута…</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[styles.progressBar, { width: progressWidth, backgroundColor: colors.info }]}
          />
        </View>
      </View>
    )
  }

  if (error && typeof error === 'string' && error !== 'Using direct line') {
    return (
      <View
        style={[styles.container, styles.errorContainer]}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        {...(Platform.OS === 'web' ? ({ role: 'alert', 'aria-live': 'assertive' } as any) : null)}
      >
        <View style={styles.errorContent}>
          <Feather name="alert-circle" size={16} color={colors.danger} />
          <View style={styles.errorTextContainer}>
            <Text style={styles.errorTitle}>Ошибка маршрутизации</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        </View>
        {onRetry && (
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && PRESSED_OPACITY_07]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Повторить построение маршрута"
          >
            <Feather name="refresh-cw" size={13} color={colors.danger} />
            <Text style={styles.retryButtonText}>Повторить</Text>
          </Pressable>
        )}
      </View>
    )
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
    )
  }

  if (distance == null || distance <= 0) return null

  const durationSec =
    duration != null && duration > 0 ? duration : estimateDurationSeconds(distance, transportMode)
  const timeText = formatDuration(durationSec, compact)
  const showElevation =
    (transportMode === 'bike' || transportMode === 'foot') &&
    Number.isFinite(elevationGain as any) &&
    Number.isFinite(elevationLoss as any)
  const compactCardStyle = compact ? styles.miniCardCompactHalf : null

  return (
    <View style={[styles.container, styles.successContainer, compact && styles.successContainerCompact]}>
      <View style={styles.successHeader}>
        <MapIcon
          name={
            transportMode === 'car'
              ? 'directions-car'
              : transportMode === 'bike'
                ? 'directions-bike'
                : 'directions-walk'
          }
          size={compact ? 16 : 18}
          color={colors.success}
        />
        <Text style={styles.successTitle}>
          {isEstimated
            ? compact ? 'Оценка' : 'Оценка маршрута'
            : compact ? 'Маршрут готов' : 'Маршрут построен'}
        </Text>
      </View>
      <View style={styles.miniCardGrid}>
        <MiniCard
          icon="navigation"
          iconColor={colors.primary}
          value={formatDistance(distance)}
          label={compact ? 'Дистанция' : 'Расстояние'}
          styles={styles}
          compact={compact}
          extraStyle={compactCardStyle}
        />
        <MiniCard
          icon="clock"
          iconColor={colors.primary}
          value={timeText}
          label={compact ? 'Время' : 'Время в пути'}
          styles={styles}
          compact={compact}
          extraStyle={compactCardStyle}
        />
        {showElevation && (
          <>
            <MiniCard
              icon="trending-up"
              iconColor={colors.success}
              value={`${Math.round(Number(elevationGain))} м`}
              label="Набор"
              styles={styles}
              compact={compact}
              extraStyle={compactCardStyle}
            />
            <MiniCard
              icon="trending-down"
              iconColor={colors.danger}
              value={`${Math.round(Number(elevationLoss))} м`}
              label="Спуск"
              styles={styles}
              compact={compact}
              extraStyle={compactCardStyle}
            />
          </>
        )}
      </View>
    </View>
  )
}

export default React.memo(RoutingStatus)

const getStyles = (colors: ThemedColors, compact: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: compact ? 10 : 12,
      padding: compact ? 8 : 12,
      marginBottom: compact ? 6 : 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    loadingContent: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    loadingText: { fontSize: 13, fontWeight: '500', color: colors.info },
    progressBarContainer: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressBar: { height: '100%', borderRadius: 2 },
    errorContainer: { borderColor: colors.danger, backgroundColor: colors.dangerLight },
    errorContent: { flexDirection: 'row', gap: 10 },
    errorTextContainer: { flex: 1 },
    errorTitle: { fontSize: 13, fontWeight: '600', color: colors.danger, marginBottom: 2 },
    errorMessage: { fontSize: 12, color: colors.dangerDark, lineHeight: 16 },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.danger,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    retryButtonText: { fontSize: 12, fontWeight: '600', color: colors.danger },
    warningContainer: { borderColor: colors.warning, backgroundColor: colors.warningLight },
    warningContent: { flexDirection: 'row', gap: 10 },
    warningTextContainer: { flex: 1 },
    warningTitle: { fontSize: 13, fontWeight: '600', color: colors.warning, marginBottom: 2 },
    warningMessage: { fontSize: 12, color: colors.warningDark, lineHeight: 16 },
    successContainer: { borderColor: colors.borderLight, backgroundColor: colors.surface },
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
    },
    successTitle: { fontSize: compact ? 12 : 13, fontWeight: '600', color: colors.success },
    miniCardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: compact ? 8 : 10 },
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
    miniCardCompactHalf: { flexBasis: '48%', maxWidth: '48%', flexGrow: 0 },
    miniCardValue: {
      fontSize: compact ? 15 : 14,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    miniCardValueCompact: { fontSize: 15, lineHeight: 20 },
    miniCardLabel: { fontSize: 10, fontWeight: '500', color: colors.textMuted, textAlign: 'center' },
    miniCardLabelCompact: { fontSize: 10, fontWeight: '500', letterSpacing: 0.1 },
  })
