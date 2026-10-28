import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

type Props = {
  testID: string
  title: string
  children: ReactNode
}

export default function AppStatsSection({ testID, title, children }: Props) {
  const colors = useThemedColors()
  return (
    <View
      testID={testID}
      style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
    width: '100%',
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '700',
  },
})
