import React from 'react'
import { Text, View } from 'react-native'

import type { CountriesFieldProps } from './types'
import { translate as i18nT } from '@/i18n'


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
      accessibilityLabel={i18nT('travel:components.travel.stepRoute.CountriesField.strany_marshruta_8520db78')}
    >
      <Text style={styles.countrySummaryLabel}>{i18nT('travel:components.travel.stepRoute.CountriesField.strany_marshruta_8520db78')}</Text>
      <View style={styles.countrySummaryChips}>
        {selectedCountries.length > 0 ? (
          selectedCountries.map((country: any) => (
            <View key={String(country?.country_id)} style={styles.countrySummaryChip}>
              <Text style={styles.countrySummaryChipText}>{String(country?.title_ru || country?.title || country?.name || i18nT('travel:common.country'))}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.countrySummaryEmpty}>{i18nT('travel:components.travel.stepRoute.CountriesField.poka_ne_opredeleny_94042315')}</Text>
        )}
      </View>
    </View>
  )
})
