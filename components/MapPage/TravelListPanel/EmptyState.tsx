import { View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { Text } from '@/ui/paper'
import Button from '@/components/ui/Button'
import { useThemedColors } from '@/hooks/useTheme'

import type { TravelListStyles } from './styles'
import { translate as i18nT } from '@/i18n'


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
      label: i18nT('map:components.MapPage.TravelListPanel.EmptyState.uvelichit_radius_poiska_527c2df0'),
      onPress: onExpandRadius,
      variant: 'primary',
      testID: 'empty-expand-radius',
    })
  }
  if (onResetFilters) {
    actions.push({
      label: i18nT('map:components.MapPage.TravelListPanel.EmptyState.sbrosit_filtry_9441f9e4'),
      onPress: onResetFilters,
      variant: 'outline',
      testID: 'empty-reset-filters',
    })
  }
  if (onOpenFilters) {
    actions.push({
      label: i18nT('map:components.MapPage.TravelListPanel.EmptyState.izmenit_filtry_f89a6d6d'),
      onPress: onOpenFilters,
      variant: 'ghost',
      testID: 'empty-open-filters',
    })
  }
  if (onClosePanel) {
    actions.push({
      label: i18nT('map:components.MapPage.TravelListPanel.EmptyState.vernutsya_na_kartu_59eb3e35'),
      onPress: onClosePanel,
      variant: 'ghost',
      testID: 'empty-back-to-map',
    })
  }

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle} accessibilityLabel={i18nT('map:components.MapPage.TravelListPanel.EmptyState.nichego_ne_nashlos_3ea759ca')}>
        <Feather name="map-pin" size={36} color={themeColors.textMuted} />
      </View>
      <Text style={styles.emptyText}>{i18nT('map:components.MapPage.TravelListPanel.EmptyState.nichego_ne_nashlos_3ea759ca')}</Text>
      <Text style={styles.emptyHint}>
        {actions.length > 0
          ? i18nT('map:components.MapPage.TravelListPanel.EmptyState.v_etoy_oblasti_net_mest_po_tekuschim_filtram_e47649dc')
          : i18nT('map:components.MapPage.TravelListPanel.EmptyState.v_etoy_oblasti_net_mest_po_tekuschim_filtram_4a50e9a9')}
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
