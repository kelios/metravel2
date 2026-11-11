import type { TranslationKey } from '@/i18n'

export type BelarusTravelHubLink = {
  href: `/travels/${string}`
  titleKey: TranslationKey
  descriptionKey?: TranslationKey
}

export const BELARUS_TRAVEL_THEME_LINKS: readonly BelarusTravelHubLink[] = [
  {
    href: '/travels/kuda-poekhat-v-belarusi-na-vykhodnye-4-marshruta',
    titleKey: 'sharedStatic:travelsByHub.theme.weekend.title',
    descriptionKey: 'sharedStatic:travelsByHub.theme.weekend.description',
  },
  {
    href: '/travels/zamki-i-usadby-belarusi-19-marshrutov-iz-minska',
    titleKey: 'sharedStatic:travelsByHub.theme.castles.title',
    descriptionKey: 'sharedStatic:travelsByHub.theme.castles.description',
  },
  {
    href: '/travels/otdykh-u-vody-v-belarusi-33-proverennykh-mesta',
    titleKey: 'sharedStatic:travelsByHub.theme.water.title',
    descriptionKey: 'sharedStatic:travelsByHub.theme.water.description',
  },
  {
    href: '/travels/zabroshennye-usadby-i-zamki-belarusi-38-mest',
    titleKey: 'sharedStatic:travelsByHub.theme.abandoned.title',
    descriptionKey: 'sharedStatic:travelsByHub.theme.abandoned.description',
  },
] as const

export const BELARUS_TRAVEL_CITY_LINKS: readonly BelarusTravelHubLink[] = [
  {
    href: '/travels/minsk-za-vykhodnye-putevoditel-po-stolitse-belarusi',
    titleKey: 'sharedStatic:travelsByHub.city.minsk',
  },
  {
    href: '/travels/grodno-za-1-den-chto-posmotret-i-kak-doekhat',
    titleKey: 'sharedStatic:travelsByHub.city.grodno',
  },
  {
    href: '/travels/vitebsk-za-1-den-chto-posmotret-i-kuda-skhodit',
    titleKey: 'sharedStatic:travelsByHub.city.vitebsk',
  },
  {
    href: '/travels/mogilev-chto-posmotret-za-vykhodnye',
    titleKey: 'sharedStatic:travelsByHub.city.mogilev',
  },
  {
    href: '/travels/chto-posmotret-v-polotske-1',
    titleKey: 'sharedStatic:travelsByHub.city.polotsk',
  },
] as const

