import React from 'react'
import { View } from 'react-native'

import MultiSelectField from '@/components/forms/MultiSelectField'

import type { CountriesFieldProps } from './types'

export const CountriesField = React.memo(function CountriesField({
  countries,
  isFiltersLoading,
  selectedCountryIds,
  styles,
  onChange,
}: CountriesFieldProps) {
  if (isFiltersLoading) {
    return (
      <View style={styles.filtersSkeleton}>
        <View style={styles.filtersSkeletonLabel} />
        <View style={styles.filtersSkeletonInput} />
      </View>
    )
  }

  return (
    <MultiSelectField
      label="Страны маршрута"
      items={countries}
      value={selectedCountryIds}
      onChange={onChange}
      labelField="title_ru"
      valueField="country_id"
      disabled={true}
      testID="travel-wizard.step-route.countries"
      accessibilityLabel="Страны маршрута"
    />
  )
})
