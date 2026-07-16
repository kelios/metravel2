import { memo, useMemo } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

export interface AwardsTab {
  key: string
  label: string
  count?: number
}

interface Props {
  tabs: AwardsTab[]
  activeKey: string
  onChange: (key: string) => void
  testID?: string
  style?: StyleProp<ViewStyle>
}

/** Лёгкий generic сегмент-контрол для хаба наград (активная вкладка — нижний accent-бордер). */
function AwardsTabBar({ tabs, activeKey, onChange, testID, style }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={[styles.scroll, style]}
      testID={testID}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            testID={`awards-tab-${tab.key}`}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {tab.label}
            </Text>
            {tab.count != null ? (
              <View style={[styles.badge, active && styles.badgeActive]}>
                <Text
                  style={[styles.badgeText, active && styles.badgeTextActive]}
                >
                  {tab.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    scroll: { flexGrow: 0 },
    row: { flexDirection: 'row', gap: DESIGN_TOKENS.spacing.xs },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: colors.primary },
    label: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.textMuted,
    },
    labelActive: { color: colors.text },
    badge: {
      minWidth: 18,
      paddingHorizontal: 5,
      borderRadius: 999,
      backgroundColor: colors.backgroundTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeActive: { backgroundColor: colors.primary },
    badgeText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '700',
      color: colors.textMuted,
    },
    badgeTextActive: { color: '#FFFFFF' },
  })

export default memo(AwardsTabBar)
