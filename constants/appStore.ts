export const GOOGLE_PLAY_APP_URL =
  'https://play.google.com/store/apps/details?id=by.metravel.app'

/** Apple ID приложения в App Store Connect (не bundle id). */
export const APP_STORE_APP_ID = '6801264369'

/**
 * Ссылка без кода страны: App Store сам откроет витрину пользователя
 * (приложение доступно в 175 странах и регионах).
 */
export const APP_STORE_APP_URL = `https://apps.apple.com/app/id${APP_STORE_APP_ID}`

export type AppStorePlatform = 'ios' | 'android'

/** Единственный источник адресов витрин: экраны не держат ссылки у себя. */
export const APP_STORE_LISTING_URLS: Record<AppStorePlatform, string> = {
  ios: APP_STORE_APP_URL,
  android: GOOGLE_PLAY_APP_URL,
}
