import Feather from '@expo/vector-icons/Feather'
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

type BenefitRow = {
  icon: React.ComponentProps<typeof Feather>['name']
  label: string
}

/**
 * INV2-07: three concrete reasons to create a MeTravel account, tied to what the
 * visitor was already doing (quests, map favorites, own routes / PDF book).
 * Shared so the registration screen states the value proposition explicitly.
 */
export default function AuthBenefits() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const rows: BenefitRow[] = [
    { icon: 'flag', label: i18nT('authStatic:authScreen.benefit.quests') },
    { icon: 'map-pin', label: i18nT('authStatic:authScreen.benefit.favorites') },
    { icon: 'book-open', label: i18nT('authStatic:authScreen.benefit.book') },
  ]

  return (
    <View style={styles.list} accessibilityRole="list">
      {rows.map((row) => (
        <View key={row.icon} style={styles.row} accessibilityRole="text">
          <View style={styles.iconWrap}>
            <Feather name={row.icon} size={18} color={colors.primary} />
          </View>
          <Text style={styles.label}>{row.label}</Text>
        </View>
      ))}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    list: {
      gap: DESIGN_TOKENS.spacing.sm,
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: DESIGN_TOKENS.radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    label: {
      flex: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 20,
      fontWeight: '600',
      color: colors.text,
    },
  })
