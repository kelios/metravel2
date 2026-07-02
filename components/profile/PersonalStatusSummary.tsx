import React, { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { globalFocusStyles } from '@/styles/globalFocus'

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
      { key: 'visited', label: 'Были', value: visited, icon: 'check-circle', tone: 'accent' },
      { key: 'wishlist', label: 'Хочу', value: wishlist, icon: 'bookmark', tone: 'brand' },
      { key: 'planned', label: 'Планирую', value: planned, icon: 'calendar', tone: 'primary' },
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
          <Text style={styles.badgeText}>Личный календарь</Text>
        </View>
        <Text style={styles.title}>Мои статусы поездок</Text>
        <Text style={styles.description}>
          Здесь только ваши личные отметки: где уже были, что сохранили и что в планах.
        </Text>
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
            accessibilityHint="Открыть календарь с этим статусом"
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
          accessibilityLabel="Открыть календарь"
        >
          <Feather name="calendar" size={14} color={colors.primaryDark} />
          <Text style={styles.ctaText}>Открыть календарь</Text>
        </Pressable>
      </View>
    </View>
  )
}
