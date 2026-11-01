import { memo, useCallback, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { ADVENT_MAIN_DOORS, ADVENT_ROUTE } from '@/constants/advent'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAdventCampaign } from '@/hooks/useAdventCampaign'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import { globalFocusStyles } from '@/styles/globalFocus'

/** Карточка «Обзора» профиля: прогресс и серия адвента, возврат к дверце дня (#2866). Вне окна кампании не рендерится. */
function AdventProgressCard() {
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { isInWindow, openedCount, streak } = useAdventCampaign({ content: false })

  const handlePress = useCallback(() => {
    router.push(ADVENT_ROUTE as never)
  }, [router])

  if (!isInWindow) return null

  return (
    <Pressable
      testID="profile-advent-card"
      accessibilityRole="link"
      accessibilityLabel={`${i18nT('adventStatic:profile.title')}. ${i18nT('adventStatic:profile.cta')}`}
      onPress={handlePress}
      style={({ pressed }) => [styles.card, globalFocusStyles.focusable, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Feather name="gift" size={22} color={colors.primaryDark} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{i18nT('adventStatic:profile.title')}</Text>
        <Text style={styles.meta}>
          {i18nT('adventStatic:profile.progress', { value1: formatInteger(openedCount), value2: formatInteger(ADVENT_MAIN_DOORS) })}
          {' · '}
          {i18nT('adventStatic:profile.streak', { value1: formatInteger(streak) })}
        </Text>
        <Text style={styles.cta}>{i18nT('adventStatic:profile.cta')}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pressed: { opacity: 0.9 },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: DESIGN_TOKENS.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    textCol: { flex: 1, gap: 2 },
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    meta: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
    cta: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.primaryDark },
  })

export default memo(AdventProgressCard)
