import React from 'react'
import { Text, View, type StyleProp, type TextStyle } from 'react-native'
import Chip from '@/components/ui/Chip'
import Button from '@/components/ui/Button'
import { useMapCitySearch } from '@/hooks/map/useMapCitySearch'
import { translate as i18nT } from '@/i18n'
import { openExternalUrl } from '@/utils/externalLinks'

export default function MapCitySearchRecovery({ query, enabled, onSelect, hintStyle }: {
  query: string
  enabled: boolean
  onSelect: (coordinates: { lat: number; lng: number }) => void
  hintStyle?: StyleProp<TextStyle>
}) {
  const citySearch = useMapCitySearch({ query, enabled, onSelect })
  if (!citySearch.status) return null
  return (
    <View testID="map-city-search-recovery">
      {citySearch.status === 'idle' && (
        <Button testID="map-city-search-start" label={i18nT('map:placeSearch.cityLookup')} variant="outline" size="sm" onPress={citySearch.request} disabled={citySearch.coolingDown} />
      )}
      {citySearch.status === 'pending' && (
        <Text style={hintStyle} accessibilityLiveRegion="polite">{i18nT('map:placeSearch.cityPending')}</Text>
      )}
      {citySearch.status === 'error' && (
        <>
          <Text style={hintStyle} accessibilityLiveRegion="polite">{i18nT('map:placeSearch.cityError')}</Text>
          <Chip testID="map-city-search-retry" label={i18nT('map:placeSearch.cityRetry')} onPress={citySearch.retry} disabled={citySearch.coolingDown} />
        </>
      )}
      {citySearch.results.map((city, index) => (
        <Button
          key={city.id}
          testID={`map-city-search-result-${index}`}
          label={i18nT('map:placeSearch.citySelect', { city: city.label })}
          variant="outline"
          size="sm"
          onPress={() => citySearch.select(city)}
        />
      ))}
      {citySearch.results.length > 0 && (
        <Button testID="map-city-search-credit" label={i18nT('map:placeSearch.citySource')} variant="ghost" size="sm" onPress={() => { void openExternalUrl('https://www.openstreetmap.org/copyright') }} />
      )}
    </View>
  )
}
