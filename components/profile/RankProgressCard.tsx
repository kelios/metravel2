import { memo, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { globalFocusStyles } from '@/styles/globalFocus'
import RankBar from '@/components/achievements/RankBar'
import type { UserRank } from '@/api/achievements'
import { translate as i18nT } from '@/i18n'


interface Props {
  rank: UserRank | null | undefined
  /** Тап ведёт к деталям наград/ранга (#587). */
  onPress?: () => void
  testID?: string
}

/**
 * Карточка прогресса ранга во вкладке «Уровень» (#587): объясняет, что значит уровень,
 * сколько XP до следующего и что он даёт, и ведёт к деталям наград по тапу.
 */
function RankProgressCard({ rank, onPress, testID }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  const explainer = !rank
    ? i18nT('profile:components.profile.RankProgressCard.zagruzhaem_uroven_ochki_opyta_i_znachki_5db32e6e')
    : rank.isMaxLevel
    ? i18nT('profile:components.profile.RankProgressCard.vy_dostigli_maksimalnogo_urovnya_otkryty_vse_e68fe23f')
    : rank.nextLevelMinPoints != null
      ? i18nT('profile:components.profile.RankProgressCard.zarabatyvayte_ochki_opyta_za_marshruty_otzyv_a62fafa3', { value1: rank.nextLevelTitle ?? '' })
      : i18nT('profile:components.profile.RankProgressCard.zarabatyvayte_ochki_opyta_za_marshruty_otzyv_e9fc47a5')

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={rank ? i18nT('profile:components.profile.RankProgressCard.uroven_value1_value2_e857944f', { value1: rank.level, value2: rank.title }) : i18nT('profile:components.profile.RankProgressCard.uroven_zagruzhaetsya_7d653c2f')}
      accessibilityHint={onPress ? i18nT('profile:components.profile.RankProgressCard.otkryt_detali_nagrad_i_urovnya_4b92f2a0') : undefined}
      style={({ pressed }) => [
        styles.card,
        globalFocusStyles.focusable,
        pressed && onPress ? { opacity: 0.9 } : null,
      ]}
      testID={testID ?? 'rank-progress-card'}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Feather name="trending-up" size={14} color={colors.primaryDark} />
          <Text style={styles.headerTitle}>{i18nT('profile:components.profile.RankProgressCard.vash_uroven_acf60230')}</Text>
        </View>
        {onPress ? (
          <View style={styles.detailsCta}>
            <Text style={styles.detailsText}>{i18nT('profile:components.profile.RankProgressCard.vse_nagrady_1aee7ee7')}</Text>
            <Feather name="chevron-right" size={14} color={colors.primaryDark} />
          </View>
        ) : null}
      </View>

      {rank ? (
        <RankBar rank={rank} />
      ) : (
        <View style={styles.loadingRank} testID="rank-progress-card-loading">
          <View style={styles.loadingBadge} />
          <View style={styles.loadingBody}>
            <View style={styles.loadingLineWide} />
            <View style={styles.loadingLineShort} />
          </View>
        </View>
      )}

      <Text style={styles.whatIsIt}>
        {i18nT('profile:components.profile.RankProgressCard.uroven_rastet_za_vashu_aktivnost_na_metravel_33350a74')}</Text>
      <Text style={styles.explainer}>{explainer}</Text>
    </Pressable>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      marginHorizontal: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    detailsCta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    detailsText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '700',
      color: colors.primaryText,
    },
    loadingRank: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    loadingBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundTertiary,
    },
    loadingBody: {
      flex: 1,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    loadingLineWide: {
      width: '58%',
      height: 12,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundTertiary,
    },
    loadingLineShort: {
      width: '36%',
      height: 10,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundTertiary,
    },
    whatIsIt: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 18,
      color: colors.text,
      fontWeight: '600',
    },
    explainer: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 18,
      color: colors.textMuted,
    },
  })

export default memo(RankProgressCard)
