import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { Menu } from '@/ui/paper'
import type { ThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import type { PlacesCatalogPage } from '@/utils/placesCatalog'
import type { PlacesStyles } from './PlacesScreen.styles'
import { PRESSED_OPACITY } from './PlacesScreen.helpers'

export type CatalogScopeStatus = 'idle' | 'loading' | 'error' | 'ready'

export function PlacesScopeStatus({ status, onRetry, styles, colors }: {
  status: CatalogScopeStatus
  onRetry: () => void
  styles: PlacesStyles
  colors: ThemedColors
}) {
  const { t } = useTranslation()
  if (status !== 'loading' && status !== 'error') return null
  return (
    <View testID={`places-scope-${status}`} style={styles.countryMenuStatus}>
      {status === 'loading' ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      <Text style={styles.hintText} accessibilityRole={status === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite">
        {status === 'loading'
          ? t('map:screens.tabs.PlacesScreen.zagruzhaem_a0cca9ea')
          : t('map:screens.tabs.PlacesScreen.filterLoadFailed')}
      </Text>
      {status === 'error' ? (
        <Button label={t('map:screens.tabs.PlacesScreen.povtorit_e910f968')} variant="secondary" size="sm" onPress={onRetry} testID="places-scope-retry" />
      ) : null}
    </View>
  )
}

export default function PlacesCountryMenu({ compact = false, visible, selectedCountry, countryFacets, catalogTotal, showLoadedCounts, scopeStatus, onRetry, onShow, onDismiss, onSelect, styles, colors }: {
  compact?: boolean
  visible: boolean
  selectedCountry: string | null
  countryFacets: PlacesCatalogPage['countryFacets']
  catalogTotal: number
  showLoadedCounts: boolean
  scopeStatus: CatalogScopeStatus
  onRetry: () => void
  onShow: () => void
  onDismiss: () => void
  onSelect: (country: string | null) => void
  styles: PlacesStyles
  colors: ThemedColors
}) {
  const { t } = useTranslation()
  const countryLabel = selectedCountry ?? t('map:screens.tabs.PlacesScreen.vse_strany_08494525')
  return (
    <Menu visible={visible} onDismiss={onDismiss} contentStyle={styles.countryMenuContent} anchor={
      <Pressable onPress={onShow} accessibilityRole="button" accessibilityLabel={t('map:screens.tabs.PlacesScreen.vybrat_stranu_a7b66c0c')} accessibilityState={{ expanded: visible }} testID="places-country-select"
        style={({ pressed }) => [compact ? styles.compactCountrySelect : styles.countrySelect, selectedCountry && (compact ? styles.compactCountrySelectActive : styles.countrySelectActive), pressed && PRESSED_OPACITY]}>
        <View style={styles.iconSlot16}><Feather name="globe" size={16} color={selectedCountry ? colors.primary : colors.textMuted} /></View>
        {compact ? (
          <Text style={[styles.compactCountrySelectValue, !!selectedCountry && styles.compactCountrySelectValueActive]} numberOfLines={1}>{countryLabel}</Text>
        ) : (
          <View style={styles.countrySelectTextBlock}>
            <Text style={styles.countrySelectLabel}>{t('map:screens.tabs.PlacesScreen.strana_f749c62d')}</Text>
            <Text style={styles.countrySelectValue} numberOfLines={1}>{countryLabel}{showLoadedCounts && !selectedCountry ? ` (${catalogTotal})` : ''}</Text>
          </View>
        )}
        <View style={styles.iconSlot16}><Feather name="chevron-down" size={16} color={colors.textMuted} /></View>
      </Pressable>
    }>
      <Menu.Item style={styles.countryMenuItem} title={showLoadedCounts ? t('map:screens.tabs.PlacesScreen.vse_strany_value1_7f58288c', { value1: catalogTotal }) : t('map:screens.tabs.PlacesScreen.vse_strany_08494525')} onPress={() => onSelect(null)}
        leadingIcon={({ size }) => <Feather name={selectedCountry ? 'circle' : 'check-circle'} size={size} color={selectedCountry ? colors.textMuted : colors.primary} />}
        titleStyle={selectedCountry ? styles.countryMenuItemText : styles.countryMenuItemTextActive} />
      {countryFacets.map((group) => (
        <Menu.Item key={group.name} style={styles.countryMenuItem} title={`${group.name} (${group.count})`} onPress={() => onSelect(group.name)}
          leadingIcon={({ size }) => <Feather name={selectedCountry === group.name ? 'check-circle' : 'circle'} size={size} color={selectedCountry === group.name ? colors.primary : colors.textMuted} />}
          titleStyle={selectedCountry === group.name ? styles.countryMenuItemTextActive : styles.countryMenuItemText} />
      ))}
      <PlacesScopeStatus status={scopeStatus} onRetry={onRetry} styles={styles} colors={colors} />
    </Menu>
  )
}
