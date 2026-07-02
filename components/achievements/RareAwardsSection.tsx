import { memo } from 'react'
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Feather } from '@expo/vector-icons'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useMyRareAwards } from '@/hooks/useAchievementsApi'
import { useAuthStore } from '@/stores/authStore'
import RareAwardCard from '@/components/achievements/RareAwardCard'
import SectionState from '@/components/achievements/SectionState'

interface Props {
  /** bare — без внешней карточки и заголовка (контент для хаба наград). */
  bare?: boolean
  testID?: string
  style?: StyleProp<ViewStyle>
}

function RareAwardsSection({ bare = false, testID, style }: Props) {
  const colors = useThemedColors()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data, isFetching, isError } = useMyRareAwards()
  const ownerName = useAuthStore((s) => s.username)
  const styles = getStyles(colors)

  // Тихо скрываем при ошибке/неавторизованном — секция необязательная.
  if (isError || !isAuthenticated) return null

  const body = (
    <SectionState isFetching={isFetching} hasData={data != null}>
      {data && data.length > 0 ? (
        <View style={styles.list}>
          {data.map((award) => (
            <RareAwardCard key={award.id} award={award} ownerName={ownerName} />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>
          Редкие награды вручает команда MeTravel за особый вклад в сообщество.
        </Text>
      )}
    </SectionState>
  )

  if (bare) {
    return (
      <View style={[styles.bare, style]} testID={testID}>
        {body}
      </View>
    )
  }

  return (
    <View style={[styles.card, style]} testID={testID}>
      <View style={styles.headerRow}>
        <Feather name="star" size={16} color={colors.primaryDark} />
        <Text style={styles.heading}>Редкие награды</Text>
      </View>
      {body}
    </View>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.md,
    },
    bare: { gap: DESIGN_TOKENS.spacing.md },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heading: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
    },
    list: { gap: DESIGN_TOKENS.spacing.sm },
    empty: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
  })

export default memo(RareAwardsSection)
