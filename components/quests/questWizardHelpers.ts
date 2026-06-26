import { Alert, Image, Linking, Platform } from 'react-native'

import { openExternalUrl } from '@/utils/externalLinks'
import { showToastMessage } from '@/utils/toast'
import {
  buildGoogleMapsUrl,
  buildOpenStreetMapUrl,
  buildOrganicMapsUrl,
  buildWazeUrl,
  buildYandexNaviUrl,
} from '@/components/MapPage/Map/mapLinks'

import { getQuestClipboard } from './questWizardMedia'

export type QuestMapApp = 'google' | 'apple' | 'yandex' | 'organic' | 'mapsme' | 'waze' | 'osm'

type QuestMapPoint = {
  lat: number
  lng: number
  title?: string
}

const QUEST_MAP_PROTOCOLS = [
  'http:',
  'https:',
  'geo:',
  'om:',
  'organicmaps:',
  'mapsme:',
  'waze:',
  'yandexnavi:',
  'yandexmaps:',
] as const

export const notifyQuest = (message: string) => {
  void showToastMessage({ text1: message, type: 'info', visibilityTime: 2500 })
}

export const confirmQuestAsync = (title: string, message: string): Promise<boolean> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`))
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
        { text: 'ОК', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })
}

export const resolveQuestUri = (src: any | undefined): string | undefined => {
  if (!src) return undefined
  if (typeof src === 'string') return src
  // @ts-ignore -- Image.resolveAssetSource is a RN internal API not in public type declarations
  return Image.resolveAssetSource?.(src)?.uri
}

export const detectQuestMapApps = async () => {
  let hasOrganic = false
  let hasMapsme = false

  try {
    const om = await Linking.canOpenURL('om://map')
    const om2 = await Linking.canOpenURL('organicmaps://')
    hasOrganic = Boolean(om || om2)
  } catch {
    hasOrganic = false
  }

  try {
    const mm = await Linking.canOpenURL('mapsme://map')
    hasMapsme = Boolean(mm)
  } catch {
    hasMapsme = false
  }

  return { hasOrganic, hasMapsme }
}

const openQuestMapCandidates = async (candidates: Array<string | undefined>) => {
  for (const url of candidates) {
    if (!url) continue
    try {
      const opened = await openExternalUrl(url, { allowedProtocols: [...QUEST_MAP_PROTOCOLS] })
      if (opened) return true
    } catch {
      // Ignore failed attempts and continue with fallbacks.
    }
  }

  notifyQuest('Не удалось открыть карты. Проверьте, что установлено нужное приложение.')
  return false
}

export const openQuestMap = async (point: QuestMapPoint, app: QuestMapApp) => {
  const { lat, lng } = point
  const name = encodeURIComponent(point.title || 'Point')
  const coord = `${lat},${lng}`
  const urls = {
    google: buildGoogleMapsUrl(coord),
    apple: `http://maps.apple.com/?ll=${lat},${lng}`,
    yandex: buildYandexNaviUrl(coord),
    organic_best: buildOrganicMapsUrl(coord, point.title),
    organic_web: `https://omaps.app/map?v=1&ll=${lat},${lng}&n=${name}`,
    mapsme: `mapsme://map?ll=${lat},${lng}&zoom=17&n=${name}`,
    geo: Platform.OS === 'android' ? `geo:${lat},${lng}?q=${lat},${lng}(${name})` : undefined,
    waze: buildWazeUrl(coord),
    osm: buildOpenStreetMapUrl(coord),
  } as const

  if (app === 'organic') {
    return openQuestMapCandidates([urls.organic_best, urls.organic_web, urls.geo, urls.google])
  }
  if (app === 'mapsme') {
    return openQuestMapCandidates([urls.mapsme, urls.geo, urls.google])
  }
  if (app === 'waze') return openQuestMapCandidates([urls.waze, urls.google])
  if (app === 'osm') return openQuestMapCandidates([urls.osm])
  return openQuestMapCandidates([urls[app]])
}

export const copyQuestCoords = async (point: Pick<QuestMapPoint, 'lat' | 'lng'>) => {
  const Clipboard = await getQuestClipboard()
  await Clipboard.setStringAsync(`${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`)
  notifyQuest('Координаты скопированы')
}
