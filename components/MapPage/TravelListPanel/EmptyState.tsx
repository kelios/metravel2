import { View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { Text } from '@/ui/paper'
import Button from '@/components/ui/Button'
import { useThemedColors } from '@/hooks/useTheme'

import type { TravelListStyles } from './styles'

export function EmptyState({
  styles,
  onExpandRadius,
  onResetFilters,
  onOpenFilters,
  onClosePanel,
}: {
  styles: TravelListStyles
  onExpandRadius?: () => void
  onResetFilters?: () => void
  onOpenFilters?: () => void
  onClosePanel?: () => void
}) {
  const themeColors = useThemedColors()
  const actions: Array<{
    label: string
    onPress: () => void
    variant: 'primary' | 'outline' | 'ghost'
    testID: string
  }> = []
  if (onExpandRadius) {
    actions.push({
      label: 'Увеличить радиус поиска',
      onPress: onExpandRadius,
      variant: 'primary',
      testID: 'empty-expand-radius',
    })
  }
  if (onResetFilters) {
    actions.push({
      label: 'Сбросить фильтры',
      onPress: onResetFilters,
      variant: 'outline',
      testID: 'empty-reset-filters',
    })
  }
  if (onOpenFilters) {
    actions.push({
      label: 'Изменить фильтры',
      onPress: onOpenFilters,
      variant: 'ghost',
      testID: 'empty-open-filters',
    })
  }
  if (onClosePanel) {
    actions.push({
      label: 'Вернуться на карту',
      onPress: onClosePanel,
      variant: 'ghost',
      testID: 'empty-back-to-map',
    })
  }

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle} accessibilityLabel="Ничего не нашлось">
        <Feather name="map-pin" size={36} color={themeColors.textMuted} />
      </View>
      <Text style={styles.emptyText}>Ничего не нашлось</Text>
      <Text style={styles.emptyHint}>
        {actions.length > 0
          ? 'В этой области нет мест по текущим фильтрам. Выберите действие ниже:'
          : 'В этой области нет мест по текущим фильтрам. Измените радиус или фильтры поиска.'}
      </Text>
      <View style={styles.emptyActions}>
        {actions.map((action) => (
          <Button
            key={action.testID}
            label={action.label}
            onPress={action.onPress}
            variant={action.variant}
            size="sm"
            testID={action.testID}
          />
        ))}
      </View>
    </View>
  )
}
