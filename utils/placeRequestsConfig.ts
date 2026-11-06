import { Platform } from 'react-native'

import { getFixedTranslator, SUPPORTED_LOCALES } from '@/i18n'

export const isPlaceRequestsPilotEnabled = () =>
  Platform.OS === 'web' && process.env.EXPO_PUBLIC_BELARUS_PLACE_CONTRIBUTIONS !== 'false'

export function matchesPlaceRequestsCountry(country: string | null) {
  const value = country?.trim().toLowerCase()
  return !value || value === 'by' || SUPPORTED_LOCALES.some((locale) =>
    getFixedTranslator(locale)('places:contributions.countryBelarus').toLowerCase() === value)
}
