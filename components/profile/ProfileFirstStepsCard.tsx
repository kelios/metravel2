import { memo, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import type { UserRank } from '@/api/achievements'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import Button from '@/components/ui/Button'

interface Props {
  travelsCount: number
  rank: UserRank | null | undefined
  onCreateRoute: () => void
  onStartQuest: () => void
  testID?: string
}

function hasProgress(rank: UserRank | null | undefined): boolean {
  if (!rank) return false
  return (rank.totalPoints ?? 0) > 0 || (rank.badgesCount ?? 0) > 0
}

function ProfileFirstStepsCard({
  travelsCount,
  rank,
  onCreateRoute,
  onStartQuest,
  testID,
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  if (travelsCount > 0 || hasProgress(rank)) return null

  return (
    <View style={styles.card} testID={testID ?? 'profile-first-steps-card'}>
      <View style={styles.iconWrap}>
        <Feather name="compass" size={18} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>С чего начать</Text>
        <Text style={styles.description}>
          Добавьте первый маршрут или откройте квест, чтобы профиль начал собирать ваш прогресс.
        </Text>
        <View style={styles.actions}>
          <Button
            label="Создать маршрут"
            onPress={onCreateRoute}
            variant="primary"
            size="sm"
            icon={<Feather name="map" size={15} color={colors.textOnPrimary} />}
            accessibilityLabel="Создать первый маршрут"
          />
          <Button
            label="Начать квест"
            onPress={onStartQuest}
            variant="outline"
            size="sm"
            icon={<Feather name="flag" size={15} color={colors.primary} />}
            accessibilityLabel="Начать первый квест"
          />
        </View>
      </View>
    </View>
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
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
    },
    description: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 20,
      color: colors.textMuted,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingTop: DESIGN_TOKENS.spacing.xxs,
    },
  })

export default memo(ProfileFirstStepsCard)
