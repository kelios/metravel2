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
import { translate as i18nT } from '@/i18n'


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
  if (totalMinutes < 60) return compact ? i18nT('map:components.MapPage.RoutingStatus.value1_m_0adff6ff', { value1: totalMinutes }) : i18nT('map:components.MapPage.RoutingStatus.value1_min_6e3c22ce', { value1: totalMinutes })
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (m === 0) return compact ? i18nT('map:components.MapPage.RoutingStatus.value1_ch_ee64dc1f', { value1: h }) : i18nT('map:components.MapPage.RoutingStatus.value1_ch_39ade1be', { value1: h })
  return compact ? i18nT('map:components.MapPage.RoutingStatus.value1_ch_value2_m_dc3e9fbc', { value1: h, value2: m }) : i18nT('map:components.MapPage.RoutingStatus.value1_ch_value2_min_b2532ef4', { value1: h, value2: m })
}

function estimateDurationSeconds(meters: number, mode: TransportMode): number {
  return (meters / 1000 / TRANSPORT_SPEED_KMH[mode]) * 3600
}

function formatDistance(meters: number): string {
  if (meters < 1000) return i18nT('map:components.MapPage.RoutingStatus.value1_m_c093a0f2', { value1: Math.round(meters) })
  return i18nT('map:components.MapPage.RoutingStatus.value1_km_eff5e281', { value1: (meters / 1000).toFixed(1) })
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
        accessibilityLabel={i18nT('map:components.MapPage.RoutingStatus.postroenie_marshruta_3af96c59')}
        accessibilityLiveRegion="polite"
        {...(Platform.OS === 'web'
          ? ({ role: 'progressbar', 'aria-busy': true, 'aria-live': 'polite' } as any)
          : null)}
      >
        <View style={styles.loadingContent}>
          <ActivityIndicator size="small" color={colors.info} />
          <Text style={styles.loadingText}>{i18nT('map:components.MapPage.RoutingStatus.postroenie_marshruta_3180d207')}</Text>
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
            <Text style={styles.errorTitle}>{i18nT('map:components.MapPage.RoutingStatus.oshibka_marshrutizatsii_c5fdf700')}</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        </View>
        {onRetry && (
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && PRESSED_OPACITY_07]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={i18nT('map:components.MapPage.RoutingStatus.povtorit_postroenie_marshruta_8f17d9ea')}
          >
            <Feather name="refresh-cw" size={13} color={colors.danger} />
            <Text style={styles.retryButtonText}>{i18nT('map:components.MapPage.RoutingStatus.povtorit_a4d0f601')}</Text>
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
            <Text style={styles.warningTitle}>{i18nT('map:components.MapPage.RoutingStatus.pryamaya_liniya_22799f17')}</Text>
            <Text style={styles.warningMessage}>
              {i18nT('map:components.MapPage.RoutingStatus.optimalnyy_marshrut_nedostupen_pokazana_prya_cc230e83')}</Text>
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
            ? compact ? i18nT('map:components.MapPage.RoutingStatus.otsenka_a67b6a48') : i18nT('map:components.MapPage.RoutingStatus.otsenka_marshruta_1442f3ad')
            : compact ? i18nT('map:components.MapPage.RoutingStatus.marshrut_gotov_e3f45980') : i18nT('map:components.MapPage.RoutingStatus.marshrut_postroen_16d8f712')}
        </Text>
      </View>
      <View style={styles.miniCardGrid}>
        <MiniCard
          icon="navigation"
          iconColor={colors.primary}
          value={formatDistance(distance)}
          label={compact ? i18nT('map:components.MapPage.RoutingStatus.distantsiya_ff61fc7c') : i18nT('map:components.MapPage.RoutingStatus.rasstoyanie_0eb5f0ce')}
          styles={styles}
          compact={compact}
          extraStyle={compactCardStyle}
        />
        <MiniCard
          icon="clock"
          iconColor={colors.primary}
          value={timeText}
          label={compact ? i18nT('map:components.MapPage.RoutingStatus.vremya_aa260887') : i18nT('map:components.MapPage.RoutingStatus.vremya_v_puti_436c3037')}
          styles={styles}
          compact={compact}
          extraStyle={compactCardStyle}
        />
        {showElevation && (
          <>
            <MiniCard
              icon="trending-up"
              iconColor={colors.success}
              value={i18nT('map:components.MapPage.RoutingStatus.value1_m_c093a0f2', { value1: Math.round(Number(elevationGain)) })}
              label={i18nT('map:components.MapPage.RoutingStatus.nabor_d6b0e427')}
              styles={styles}
              compact={compact}
              extraStyle={compactCardStyle}
            />
            <MiniCard
              icon="trending-down"
              iconColor={colors.danger}
              value={i18nT('map:components.MapPage.RoutingStatus.value1_m_c093a0f2', { value1: Math.round(Number(elevationLoss)) })}
              label={i18nT('map:components.MapPage.RoutingStatus.spusk_d1ac5e92')}
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
