import React, { useMemo } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

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
      <TouchableOpacity
        onPress={() => onPageChange(page - 1)}
        disabled={!canPrev}
        accessibilityRole="button"
        accessibilityLabel="Предыдущая страница"
        style={{
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          paddingVertical: DESIGN_TOKENS.spacing.sm,
          borderRadius: DESIGN_TOKENS.radii.md,
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: canPrev ? 1 : 0.5,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: '700' as any }}>Назад</Text>
      </TouchableOpacity>

      <Text style={{ color: colors.textMuted, fontWeight: '600' as any }}>
        Страница {page} из {totalPages}
      </Text>

      <TouchableOpacity
        onPress={() => onPageChange(page + 1)}
        disabled={!canNext}
        accessibilityRole="button"
        accessibilityLabel="Следующая страница"
        style={{
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          paddingVertical: DESIGN_TOKENS.spacing.sm,
          borderRadius: DESIGN_TOKENS.radii.md,
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: canNext ? 1 : 0.5,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: '700' as any }}>Вперёд</Text>
      </TouchableOpacity>
    </View>
  )
}
