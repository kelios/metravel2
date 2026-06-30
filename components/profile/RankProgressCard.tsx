import { memo, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { globalFocusStyles } from '@/styles/globalFocus'
import RankBar from '@/components/achievements/RankBar'
import type { UserRank } from '@/api/achievements'

interface Props {
  rank: UserRank | null | undefined
  /** Тап ведёт к деталям наград/ранга (#587). */
  onPress?: () => void
  testID?: string
}

/**
 * Карточка прогресса ранга в «Обзоре» (#587): объясняет, что значит уровень,
 * сколько XP до следующего и что он даёт, и ведёт к деталям наград по тапу.
 */
function RankProgressCard({ rank, onPress, testID }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  const explainer = !rank
    ? 'Загружаем XP, уровень и значки.'
    : rank.isMaxLevel
    ? 'Вы достигли максимального уровня — открыты все привилегии.'
    : rank.nextLevelMinPoints != null
      ? `Зарабатывайте XP за маршруты, отзывы и активность, чтобы открыть уровень «${rank.nextLevelTitle ?? ''}».`
      : 'Зарабатывайте XP за маршруты, отзывы и активность, чтобы расти в ранге.'

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={rank ? `Ранг: уровень ${rank.level}, ${rank.title}` : 'Ранг загружается'}
      accessibilityHint={onPress ? 'Открыть детали наград и ранга' : undefined}
      style={({ pressed }) => [
        styles.card,
        globalFocusStyles.focusable,
        pressed && onPress ? { opacity: 0.9 } : null,
      ]}
      testID={testID ?? 'rank-progress-card'}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Feather name="trending-up" size={14} color={colors.primary} />
          <Text style={styles.headerTitle}>Ваш ранг</Text>
        </View>
        {onPress ? (
          <View style={styles.detailsCta}>
            <Text style={styles.detailsText}>Подробнее</Text>
            <Feather name="chevron-right" size={14} color={colors.primary} />
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
      color: colors.primary,
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
    explainer: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 18,
      color: colors.textMuted,
    },
  })

export default memo(RankProgressCard)
