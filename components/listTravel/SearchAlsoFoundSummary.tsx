import { memo, useMemo, type ReactNode } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

/**
 * Высота строки-сводки одна во всех состояниях («ищем», «нашлось», «ничего»):
 * строка занимает место над карточками с первого кадра активного запроса, и
 * ответ источников меняет только её текст, а не положение карточек (CLS).
 */
export const SEARCH_ALSO_FOUND_ROW_HEIGHT = 48

export type SearchAlsoFoundStatus = 'loading' | 'empty' | 'found'

type Props = {
  status: SearchAlsoFoundStatus
  label: string
  expanded: boolean
  onToggle: () => void
  /** Раскрытый список; появляется только по тапу пользователя. */
  children?: ReactNode
}

function SearchAlsoFoundSummary({ status, label, expanded, onToggle, children }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const found = status === 'found'

  const rowContent = (
    <>
      {status === 'loading' ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <Feather name="compass" size={18} color={found ? colors.primaryText : colors.textMuted} />
      )}
      <Text style={[styles.label, !found && styles.labelMuted]} numberOfLines={1}>
        {label}
      </Text>
      {found ? (
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primaryText} />
      ) : null}
    </>
  )

  return (
    <View style={styles.root} testID="search-also-found">
      {found ? (
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={[styles.row, styles.rowPressable]}
          testID="search-also-found-toggle"
        >
          {rowContent}
        </Pressable>
      ) : (
        <View
          style={styles.row}
          testID={`search-also-found-${status}`}
          accessibilityLiveRegion="polite"
        >
          {rowContent}
        </View>
      )}
      {found && expanded ? children : null}
    </View>
  )
}

function createStyles(colors: ThemedColors) {
  const type = DESIGN_TOKENS.typography.scale
  return StyleSheet.create({
    root: {
      marginBottom: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    row: {
      height: SEARCH_ALSO_FOUND_ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
    },
    rowPressable: Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : {},
    label: { ...type.bodyStrong, flex: 1, minWidth: 0, color: colors.primaryText },
    labelMuted: { ...type.bodySmall, color: colors.textMuted },
  })
}

export default memo(SearchAlsoFoundSummary)
