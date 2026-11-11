// #3231: schema.org `MobileApplication` для страницы /app. Идентификаторы и адреса
// витрин — из единственного источника `constants/appIdentity`, ничего своего.
import {
  ANDROID_APP_PACKAGE,
  APP_STORE_APP_ID,
  APP_STORE_APP_URL,
  GOOGLE_PLAY_APP_URL,
} from '@/constants/appIdentity'

const ORGANIZATION_ID = 'https://metravel.by/#organization'

type AppDownloadJsonLdInput = {
  /** Описание приложения — та же строка, что у страницы /app. */
  description: string
  /** Абсолютный canonical страницы /app. */
  pageUrl: string
}

export function buildAppDownloadJsonLd({ description, pageUrl }: AppDownloadJsonLdInput) {
  const base = {
    '@type': 'MobileApplication',
    name: 'MeTravel',
    description,
    applicationCategory: 'TravelApplication',
    isAccessibleForFree: true,
    publisher: { '@id': ORGANIZATION_ID },
    mainEntityOfPage: pageUrl,
  }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        ...base,
        '@id': `${pageUrl}#android`,
        operatingSystem: 'Android',
        identifier: ANDROID_APP_PACKAGE,
        url: GOOGLE_PLAY_APP_URL,
        installUrl: GOOGLE_PLAY_APP_URL,
      },
      {
        ...base,
        '@id': `${pageUrl}#ios`,
        operatingSystem: 'iOS',
        identifier: APP_STORE_APP_ID,
        url: APP_STORE_APP_URL,
        installUrl: APP_STORE_APP_URL,
      },
    ],
  }
}
