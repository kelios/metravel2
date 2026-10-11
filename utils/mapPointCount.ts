import { translate as i18nT, translatePlural } from '@/i18n'
import { formatInteger } from '@/i18n/format'

export type MapPointCountScope = 'radius' | 'loaded'

/** Map totals count point records, without inferring unique place identity. */
export const getMapPointLabel = (count: number): string =>
  translatePlural('map:components.MapPage.TravelListPanel.helpers.placeNoun', count)

export const formatMapPoints = (count: number): string => `${formatInteger(count)} ${getMapPointLabel(count)}`

export const qualifyMapPointCount = (label: string, scope?: MapPointCountScope): string =>
  scope === 'loaded' ? i18nT('map:utils.mapPointCount.loadedCount', { value1: label }) : label
