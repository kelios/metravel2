import { getLocaleDefinition, i18n, resolveSupportedLocale } from '@/i18n'

/** Active language code for frontend-owned geocoder requests. */
export const getMapGeocoderLanguage = (): string =>
  getLocaleDefinition(resolveSupportedLocale([i18n.resolvedLanguage])).geocoderLanguage
