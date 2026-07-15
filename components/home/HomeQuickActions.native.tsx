// Native-only quick-entry chips on the home tab. Complements the bottom dock by
// surfacing the core features (map, places, quests, random route) above the fold.
// Web has a no-op sibling (HomeQuickActions.tsx) — web home has its own layout.

import { memo, useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { NavigationIconName } from '@/constants/navigationIcons'
import { useThemedColors } from '@/hooks/useTheme'
import { hapticImpact } from '@/utils/haptics'
import NavigationIcon from '@/components/layout/NavigationIcon'
import { translate as i18nT } from '@/i18n'


type QuickAction = {
  key: string
  label: string
  icon: NavigationIconName
  route: string
}

const ACTIONS: QuickAction[] = [
  { key: 'map', get label() { return i18nT('homeStatic:components.home.HomeQuickActions.karta_46f4c169') }, icon: 'map', route: '/map' },
  { key: 'places', get label() { return i18nT('homeStatic:components.home.HomeQuickActions.mesta_18e916bd') }, icon: 'map-pin', route: '/places' },
  { key: 'quests', get label() { return i18nT('homeStatic:components.home.HomeQuickActions.kvesty_a89f2d6d') }, icon: 'quest-route', route: '/quests' },
  { key: 'roulette', get label() { return i18nT('homeStatic:components.home.HomeQuickActions.sluchaynyy_marshrut_5924f56b') }, icon: 'dice', route: '/roulette' },
]

function HomeQuickActions() {
  const colors = useThemedColors()
  const router = useRouter()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {ACTIONS.map((action) => (
        <Pressable
          key={action.key}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          onPress={() => {
            hapticImpact('light')
            router.push(action.route as never)
          }}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <NavigationIcon name={action.icon} size={16} color={colors.primaryDark} />
          <Text style={styles.chipText} numberOfLines={1}>
            {action.label}
          </Text>
        </Pressable>
      ))}
      <View style={styles.endSpacer} />
    </ScrollView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xxs,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      minHeight: 40,
    },
    chipPressed: {
      opacity: 0.85,
      backgroundColor: colors.primarySoft,
    },
    chipText: {
      ...DESIGN_TOKENS.typography.scale.bodySmall,
      color: colors.text,
      fontWeight: '700',
    },
    endSpacer: {
      width: DESIGN_TOKENS.spacing.xs,
    },
  })

export default memo(HomeQuickActions)
