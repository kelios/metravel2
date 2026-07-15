import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'


interface Props {
  isVerified?: boolean
  organizerStatus?: 'experienced' | null
  /** small — компактный значок-иконка (для карточек), full — с подписью. */
  size?: 'small' | 'full'
  style?: StyleProp<ViewStyle>
  testID?: string
}

function VerifiedBadge({
  isVerified,
  organizerStatus,
  size = 'full',
  style,
  testID,
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  const showExperienced = organizerStatus === 'experienced'
  if (!isVerified && !showExperienced) return null

  if (size === 'small') {
    // Компактный режим: только галочка проверенного (для карточек автора).
    if (!isVerified) return null
    return (
      <View
        style={[styles.iconOnly, style]}
        accessibilityRole="image"
        accessibilityLabel={i18nT('profile:components.profile.VerifiedBadge.proverennyy_uchastnik_18cc793a')}
        testID={testID ?? 'verified-badge'}
      >
        <Feather name="check-circle" size={14} color={colors.primaryDark} />
      </View>
    )
  }

  return (
    <View style={[styles.row, style]} testID={testID ?? 'verified-badge'}>
      {isVerified ? (
        <View
          style={styles.verifiedChip}
          accessibilityRole="image"
          accessibilityLabel={i18nT('profile:components.profile.VerifiedBadge.proverennyy_uchastnik_18cc793a')}
        >
          <Feather name="check-circle" size={13} color={colors.primaryDark} />
          <Text style={styles.verifiedText}>{i18nT('profile:components.profile.VerifiedBadge.proverennyy_08a597c4')}</Text>
        </View>
      ) : null}
      {showExperienced ? (
        <View
          style={styles.organizerChip}
          accessibilityRole="image"
          accessibilityLabel={i18nT('profile:components.profile.VerifiedBadge.organizator_s_opytom_4f5500a5')}
          testID="organizer-badge"
        >
          <Feather name="award" size={13} color={colors.textOnPrimary} />
          <Text style={styles.organizerText}>{i18nT('profile:components.profile.VerifiedBadge.organizator_s_opytom_4f5500a5')}</Text>
        </View>
      ) : null}
    </View>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    iconOnly: { alignItems: 'center', justifyContent: 'center' },
    verifiedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    verifiedText: { fontSize: 12, fontWeight: '700', color: colors.primaryText },
    organizerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    organizerText: { fontSize: 12, fontWeight: '700', color: colors.textOnPrimary },
  })

export default memo(VerifiedBadge)
