import React, { useMemo, type ReactNode } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

/**
 * Шапка панели «Подобрать по описанию» (#2459): заголовок, подсказка и строка
 * ввода одной геометрии для живой панели и для первого кадра `/search`
 * (`SearchPageSkeleton`). Модуль нарочно лёгкий — без карточек и рейла, — чтобы
 * путь первого кадра не тянул чанк подбора.
 */
export const AI_SEARCH_INPUT_ROW_MIN_HEIGHT = 48

export function useAiSearchPanelFrameStyles() {
  const colors = useThemedColors()
  return useMemo(() => createFrameStyles(colors), [colors])
}

type FrameProps = {
  inputRow: ReactNode
  children?: ReactNode
  testID?: string
}

export function AiSearchPanelFrame({ inputRow, children, testID }: FrameProps) {
  const styles = useAiSearchPanelFrameStyles()
  const heading = i18nT('aiPicksStatic:search.title')
  return (
    <View
      style={styles.panel}
      testID={testID}
      accessibilityLabel={heading}
      accessibilityRole={Platform.OS === 'web' ? ('region' as never) : undefined}
    >
      <Text
        style={styles.title}
        accessibilityRole={Platform.OS === 'web' ? ('heading' as never) : undefined}
        aria-level={2 as never}
      >
        {heading}
      </Text>
      <Text style={styles.hint}>{i18nT('aiPicksStatic:search.hint')}</Text>
      <View style={styles.inputRow}>{inputRow}</View>
      {children}
    </View>
  )
}

/** Первый кадр `/search`: та же шапка с неактивной строкой ввода вместо `TextInput`. */
export function AiSearchPanelPlaceholder() {
  const styles = useAiSearchPanelFrameStyles()
  const colors = useThemedColors()
  return (
    <AiSearchPanelFrame
      testID="ai-search-panel-placeholder"
      inputRow={
        <>
          <Feather name="search" size={18} color={colors.textMuted} />
          <Text style={styles.placeholderText} numberOfLines={1}>
            {i18nT('aiPicksStatic:search.placeholder')}
          </Text>
        </>
      }
    />
  )
}

function createFrameStyles(colors: ThemedColors) {
  return StyleSheet.create({
    panel: {
      marginTop: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.xxs,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    hint: {
      fontSize: 13,
      color: colors.textMuted,
    },
    inputRow: {
      marginTop: DESIGN_TOKENS.spacing.xs,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      minHeight: AI_SEARCH_INPUT_ROW_MIN_HEIGHT,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      minHeight: 44,
      fontSize: 16,
      color: colors.text,
      ...Platform.select({ web: { outlineStyle: 'none' as never } }),
    },
    placeholderText: {
      flex: 1,
      minHeight: 44,
      lineHeight: 44,
      fontSize: 16,
      color: colors.textMuted,
    },
    clearButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
