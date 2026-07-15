import React, { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { globalFocusStyles } from '@/styles/globalFocus'
import { translate as i18nT } from '@/i18n'


interface PersonalStatusSummaryProps {
  visited: number
  wishlist: number
  planned: number
  formatTripsCount: (count: number) => string
  onOpenCalendar: (status?: 'visited' | 'wishlist' | 'planned') => void
}

type Metric = {
  key: 'visited' | 'wishlist' | 'planned'
  label: string
  value: number
  icon: React.ComponentProps<typeof Feather>['name']
  tone: 'accent' | 'primary' | 'brand'
}

export function PersonalStatusSummary({
  visited,
  wishlist,
  planned,
  formatTripsCount,
  onOpenCalendar,
}: PersonalStatusSummaryProps) {
  const colors = useThemedColors()

  const metrics: Metric[] = useMemo(
    () => [
      { key: 'visited', label: i18nT('profile:components.profile.PersonalStatusSummary.byli_f66be49a'), value: visited, icon: 'check-circle', tone: 'accent' },
      { key: 'wishlist', label: i18nT('profile:components.profile.PersonalStatusSummary.hochu_45c64b91'), value: wishlist, icon: 'bookmark', tone: 'brand' },
      { key: 'planned', label: i18nT('profile:components.profile.PersonalStatusSummary.planiruyu_a106fd10'), value: planned, icon: 'calendar', tone: 'primary' },
    ],
    [visited, wishlist, planned],
  )

  const toneColor = (tone: Metric['tone']) =>
    tone === 'accent' ? colors.accent : tone === 'brand' ? colors.brand : colors.primary

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          marginHorizontal: DESIGN_TOKENS.spacing.md,
          marginBottom: DESIGN_TOKENS.spacing.md,
          padding: DESIGN_TOKENS.spacing.md,
          borderRadius: 20,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderLight,
          gap: DESIGN_TOKENS.spacing.md,
        },
        header: { gap: 4 },
        badgeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.borderLight,
        },
        badgeText: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.textMuted,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
        title: {
          ...DESIGN_TOKENS.typography.scale.h3,
          color: colors.text,
          marginTop: 6,
        },
        description: {
          fontSize: 13,
          lineHeight: 18,
          color: colors.textMuted,
        },
        grid: {
          flexDirection: 'row',
          gap: DESIGN_TOKENS.spacing.xs,
          flexWrap: 'wrap',
        },
        tile: {
          flexGrow: 1,
          flexBasis: 0,
          minWidth: 92,
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.borderLight,
          gap: 6,
        },
        tileInteractive: {
          ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
        },
        tileHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        tileLabel: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.textMuted,
        },
        tileValue: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
        },
        ctaRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
        },
        cta: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          paddingVertical: 8,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.primarySoft,
          ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
        },
        ctaText: {
          color: colors.primaryText,
          fontSize: 13,
          fontWeight: '700',
        },
      }),
    [colors],
  )

  return (
    <View style={styles.card} testID="personal-status-summary">
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <Feather name="user" size={11} color={colors.textMuted} />
          <Text style={styles.badgeText}>{i18nT('profile:components.profile.PersonalStatusSummary.lichnyy_kalendar_03637ad5')}</Text>
        </View>
        <Text style={styles.title}>{i18nT('profile:components.profile.PersonalStatusSummary.moi_statusy_poezdok_5a81aaa7')}</Text>
        <Text style={styles.description}>
          {i18nT('profile:components.profile.PersonalStatusSummary.zdes_tolko_vashi_lichnye_otmetki_gde_uzhe_by_f09ba557')}</Text>
      </View>

      <View style={styles.grid}>
        {metrics.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => onOpenCalendar(m.key)}
            testID={`personal-status-tile-${m.key}`}
            style={({ pressed }) => [
              styles.tile,
              styles.tileInteractive,
              globalFocusStyles.focusable,
              { opacity: pressed ? 0.88 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${m.label}: ${formatTripsCount(m.value)}`}
            accessibilityHint={i18nT('profile:components.profile.PersonalStatusSummary.otkryt_kalendar_s_etim_statusom_989d9f2c')}
          >
            <View style={styles.tileHeader}>
              <Feather name={m.icon} size={14} color={toneColor(m.tone)} />
              <Text style={styles.tileLabel}>{m.label}</Text>
            </View>
            <Text style={styles.tileValue}>{formatTripsCount(m.value)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.ctaRow}>
        <Pressable
          onPress={() => onOpenCalendar()}
          style={({ pressed }) => [styles.cta, globalFocusStyles.focusable, { opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={i18nT('profile:components.profile.PersonalStatusSummary.otkryt_kalendar_633a0592')}
        >
          <Feather name="calendar" size={14} color={colors.primaryDark} />
          <Text style={styles.ctaText}>{i18nT('profile:components.profile.PersonalStatusSummary.otkryt_kalendar_633a0592')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
