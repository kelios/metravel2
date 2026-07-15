import type { TranslationKey } from '@/i18n'

export type BelarusTravelHubLink = {
  href: `/travels/${string}`
  titleKey: TranslationKey
  descriptionKey?: TranslationKey
}

export const BELARUS_TRAVEL_THEME_LINKS: readonly BelarusTravelHubLink[] = [
  {
    href: '/travels/kuda-poekhat-v-belarusi-na-vykhodnye-na-mashine-4-gotovykh-marshruta',
    titleKey: 'sharedStatic:travelsByHub.theme.weekend.title',
    descriptionKey: 'sharedStatic:travelsByHub.theme.weekend.description',
  },
  {
    href: '/travels/usadby-dvortsy-i-zamki-belarusi-19-marshrutov-vykhodnogo-dnia-iz-minska',
    titleKey: 'sharedStatic:travelsByHub.theme.castles.title',
    descriptionKey: 'sharedStatic:travelsByHub.theme.castles.description',
  },
  {
    href: '/travels/ozera-reki-ruchi-i-mesta-otdykha-u-vody-v-belarusi-33-proverennykh-mesta-s-foto-i-koordinatami',
    titleKey: 'sharedStatic:travelsByHub.theme.water.title',
    descriptionKey: 'sharedStatic:travelsByHub.theme.water.description',
  },
  {
    href: '/travels/zabroshennye-dvortsy-usadby-i-zamki-belarusi-38-atmosfernykh-mest-s-foto-i-koordinatami',
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
    href: '/travels/grodno-za-1-den-chto-posmotret-kak-doekhat-istoriia-goroda-legendy-i-glavnye-dostoprimechatelnosti',
    titleKey: 'sharedStatic:travelsByHub.city.grodno',
  },
  {
    href: '/travels/vitebsk-za-1-den-chto-posmotret-kuda-skhodit-i-pochemu-etot-gorod-khochetsia-pokazat-druziam-snova-i-snova',
    titleKey: 'sharedStatic:travelsByHub.city.vitebsk',
  },
  {
    href: '/travels/mogilev-gorod-istorii-legend-i-uiutnykh-ulits-chto-posmotret-i-kak-splanirovat-poezdku',
    titleKey: 'sharedStatic:travelsByHub.city.mogilev',
  },
  {
    href: '/travels/chto-posmotret-v-polotske-1',
    titleKey: 'sharedStatic:travelsByHub.city.polotsk',
  },
] as const

