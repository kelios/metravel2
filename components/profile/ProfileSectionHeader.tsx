import { memo, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { globalFocusStyles } from '@/styles/globalFocus'
import { translate as i18nT } from '@/i18n'


interface Props {
  title: string
  subtitle?: string
  /** Навигация к родительскому разделу профиля (#590, хлебная крошка). */
  onBack?: () => void
  backLabel?: string
  testID?: string
}

/**
 * Единый заголовок раздела профиля (#590): консистентная типографика и отступы,
 * опциональная «крошка» назад — чтобы ориентироваться между разделами.
 */
function ProfileSectionHeader({
  title,
  subtitle,
  onBack,
  backLabel = i18nT('profile:components.profile.ProfileSectionHeader.uroven_e2239f0f'),
  testID,
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  return (
    <View style={styles.wrap} testID={testID}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={i18nT('profile:components.profile.ProfileSectionHeader.nazad_k_razdelu_value1_3ca73e99', { value1: backLabel })}
          style={({ pressed }) => [
            styles.crumb,
            globalFocusStyles.focusable,
            pressed ? { opacity: 0.7 } : null,
          ]}
        >
          <Feather name="chevron-left" size={14} color={colors.primaryDark} />
          <Text style={styles.crumbText}>{backLabel}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      gap: 2,
    },
    crumb: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      alignSelf: 'flex-start',
      marginBottom: 4,
      paddingVertical: 2,
    },
    crumbText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '700',
      color: colors.primaryText,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: '800',
      color: colors.text,
    },
    subtitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 18,
      color: colors.textMuted,
    },
  })

export default memo(ProfileSectionHeader)
