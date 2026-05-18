import { Alert, Image, Linking, Platform } from 'react-native'

import { openExternalUrl } from '@/utils/externalLinks'
import { showToastMessage } from '@/utils/toast'

import { getQuestClipboard } from './questWizardMedia'

export type QuestMapApp = 'google' | 'apple' | 'yandex' | 'organic' | 'mapsme'

type QuestMapPoint = {
  lat: number
  lng: number
  title?: string
}

const QUEST_MAP_PROTOCOLS = ['http:', 'https:', 'geo:', 'om:', 'organicmaps:', 'mapsme:'] as const

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
  const urls = {
    google: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    apple: `http://maps.apple.com/?ll=${lat},${lng}`,
    yandex: `https://yandex.ru/maps/?pt=${lng},${lat}&z=15`,
    organic_1: `om://map?ll=${lat},${lng}&z=17`,
    organic_2: `organicmaps://map?ll=${lat},${lng}&z=17`,
    organic_web: `https://omaps.app/?lat=${lat}&lon=${lng}&zoom=17`,
    mapsme: `mapsme://map?ll=${lat},${lng}&zoom=17&n=${name}`,
    geo: Platform.OS === 'android' ? `geo:${lat},${lng}?q=${lat},${lng}(${name})` : undefined,
  } as const

  if (app === 'organic') {
    return openQuestMapCandidates([urls.organic_1, urls.organic_2, urls.organic_web, urls.geo, urls.google])
  }
  if (app === 'mapsme') {
    return openQuestMapCandidates([urls.mapsme, urls.geo, urls.google])
  }
  return openQuestMapCandidates([urls[app]])
}

export const copyQuestCoords = async (point: Pick<QuestMapPoint, 'lat' | 'lng'>) => {
  const Clipboard = await getQuestClipboard()
  await Clipboard.setStringAsync(`${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`)
  notifyQuest('Координаты скопированы')
}
