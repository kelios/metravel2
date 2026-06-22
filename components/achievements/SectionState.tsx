import { memo, type ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

interface Props {
  /** Запрос реально грузится (RQ `isFetching`), а не disabled/idle. */
  isFetching: boolean
  /** В кэше есть пригодные для отрисовки данные. */
  hasData: boolean
  /** Текст пустого состояния. null/undefined — пустое состояние не рисуем. */
  emptyText?: string | null
  children: ReactNode
}

/**
 * Терминальное состояние секции достижений без вечного спиннера.
 * - fetching без данных → индикатор загрузки.
 * - нет данных и не fetching (disabled/idle/empty) → пустой текст или ничего.
 * - есть данные → children.
 */
function SectionState({ isFetching, hasData, emptyText, children }: Props) {
  const colors = useThemedColors()

  if (hasData) return <>{children}</>

  if (isFetching) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (emptyText == null) return null

  return (
    <Text style={[styles.empty, { color: colors.textMuted }]}>{emptyText}</Text>
  )
}

const styles = StyleSheet.create({
  loading: { paddingVertical: DESIGN_TOKENS.spacing.lg, alignItems: 'center' },
  empty: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 20,
  },
})

export default memo(SectionState)
