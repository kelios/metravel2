import { translate as i18nT } from '@/i18n'

import { loadExpoLocation } from './QuestsScreen.helpers'

export type QuestCatalogLocationResult =
  | { coords: { lat: number; lng: number } }
  | { failure: string }

/**
 * Позиция игрока для «Рядом» и карты каталога (#2389: отдельный чанк, грузится
 * по этим действиям). `null` — запрос отменён до определения позиции.
 */
export async function requestQuestCatalogLocation(
  isCancelled: () => boolean,
): Promise<QuestCatalogLocationResult | null> {
  try {
    const Location = await loadExpoLocation()
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (isCancelled()) return null
    if (status !== 'granted') {
      return { failure: i18nT('quests:screens.tabs.QuestsScreen.geolokatsiya_zapreschena_pokazyvaem_ves_kata_b7ae192f') }
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.LocationAccuracy.Balanced,
    })
    return { coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } }
  } catch (error) {
    console.warn('Error requesting nearby location', error)
    return { failure: i18nT('quests:screens.tabs.QuestsScreen.ne_udalos_opredelit_mestopolozhenie_proverte_34451827') }
  }
}
