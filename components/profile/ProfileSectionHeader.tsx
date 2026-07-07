import { memo, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { globalFocusStyles } from '@/styles/globalFocus'

interface Props {
  title: string
  subtitle?: string
  /** «Назад к обзору» / навигация к родителю раздела (#590, хлебная крошка). */
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
  backLabel = 'Обзор',
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
          accessibilityLabel={`Назад к разделу «${backLabel}»`}
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
