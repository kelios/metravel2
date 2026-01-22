import React, { useMemo } from 'react'
import { Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import Button from '@/components/ui/Button'

export const PointsListPagination: React.FC<{
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
}> = ({ page, perPage, total, onPageChange }) => {
  const colors = useThemedColors()

  const totalPages = useMemo(() => {
    const safePerPage = Math.max(1, Number(perPage) || 1)
    const safeTotal = Math.max(0, Number(total) || 0)
    return Math.max(1, Math.ceil(safeTotal / safePerPage))
  }, [perPage, total])

  if (totalPages <= 1) return null

  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <View
      style={{
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        paddingVertical: DESIGN_TOKENS.spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.background,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DESIGN_TOKENS.spacing.md,
      }}
    >
      <Button
        label="Назад"
        onPress={() => onPageChange(page - 1)}
        disabled={!canPrev}
        size="sm"
        variant="secondary"
        accessibilityLabel="Предыдущая страница"
      />

      <Text style={{ color: colors.textMuted, fontWeight: '600' as any }}>
        Страница {page} из {totalPages}
      </Text>

      <Button
        label="Вперёд"
        onPress={() => onPageChange(page + 1)}
        disabled={!canNext}
        size="sm"
        variant="secondary"
        accessibilityLabel="Следующая страница"
      />
    </View>
  )
}
