import { APP_STORE_APP_URL, GOOGLE_PLAY_APP_URL } from './appIdentity'

export { APP_STORE_APP_ID, APP_STORE_APP_URL, GOOGLE_PLAY_APP_URL } from './appIdentity'

export type AppStorePlatform = 'ios' | 'android'

/** Единственный источник адресов витрин: экраны не держат ссылки у себя. */
export const APP_STORE_LISTING_URLS: Record<AppStorePlatform, string> = {
  ios: APP_STORE_APP_URL,
  android: GOOGLE_PLAY_APP_URL,
}
