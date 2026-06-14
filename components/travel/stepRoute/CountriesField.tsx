import React from 'react'
import { Text, View } from 'react-native'

import type { CountriesFieldProps } from './types'

export const CountriesField = React.memo(function CountriesField({
  countries,
  isFiltersLoading,
  selectedCountryIds,
  styles,
}: CountriesFieldProps) {
  if (isFiltersLoading) {
    return (
      <View style={styles.filtersSkeleton}>
        <View style={styles.filtersSkeletonLabel} />
        <View style={styles.filtersSkeletonInput} />
      </View>
    )
  }

  const selectedIdSet = new Set((selectedCountryIds || []).map((id) => String(id)))
  const selectedCountries = (countries || []).filter((country: any) => (
    selectedIdSet.has(String(country?.country_id))
  ))

  return (
    <View
      style={styles.countrySummary}
      testID="travel-wizard.step-route.countries"
      accessibilityLabel="Страны маршрута"
    >
      <Text style={styles.countrySummaryLabel}>Страны маршрута</Text>
      <View style={styles.countrySummaryChips}>
        {selectedCountries.length > 0 ? (
          selectedCountries.map((country: any) => (
            <View key={String(country?.country_id)} style={styles.countrySummaryChip}>
              <Text style={styles.countrySummaryChipText}>{String(country?.title_ru || country?.title || country?.name || 'Страна')}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.countrySummaryEmpty}>Пока не определены</Text>
        )}
      </View>
    </View>
  )
})
