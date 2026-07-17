import { memo, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { UserRank } from '@/api/achievements'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import Button from '@/components/ui/Button'
import { translate as i18nT } from '@/i18n'


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
        <Feather name="compass" size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{i18nT('profile:components.profile.ProfileFirstStepsCard.s_chego_nachat_19b582d7')}</Text>
        <Text style={styles.description}>
          {i18nT('profile:components.profile.ProfileFirstStepsCard.dobavte_pervyy_marshrut_ili_otkroyte_kvest_c_36989c35')}</Text>
        <View style={styles.actions}>
          <Button
            label={i18nT('profile:components.profile.ProfileFirstStepsCard.sozdat_marshrut_cd4cd9b3')}
            onPress={onCreateRoute}
            variant="primary"
            size="sm"
            icon={<Feather name="map" size={15} color={colors.textOnPrimary} />}
            accessibilityLabel={i18nT('profile:components.profile.ProfileFirstStepsCard.sozdat_pervyy_marshrut_9e1d0895')}
          />
          <Button
            label={i18nT('profile:components.profile.ProfileFirstStepsCard.nachat_kvest_b9119ff2')}
            onPress={onStartQuest}
            variant="outline"
            size="sm"
            icon={<Feather name="flag" size={15} color={colors.primaryDark} />}
            accessibilityLabel={i18nT('profile:components.profile.ProfileFirstStepsCard.nachat_pervyy_kvest_74ad02e8')}
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
