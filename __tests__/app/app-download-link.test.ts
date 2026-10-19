import { APP_STORE_APP_URL, APP_STORE_LISTING_URLS, GOOGLE_PLAY_APP_URL } from '@/constants/appStore'

describe('app download link', () => {
  it('uses the public Google Play production listing URL', () => {
    expect(GOOGLE_PLAY_APP_URL).toBe(
      'https://play.google.com/store/apps/details?id=by.metravel.app',
    )
    expect(GOOGLE_PLAY_APP_URL).not.toContain('/apps/testing/')
    expect(GOOGLE_PLAY_APP_URL).not.toContain('/apps/internaltest/')
  })

  it('uses the public App Store listing URL without a storefront prefix', () => {
    expect(APP_STORE_APP_URL).toBe('https://apps.apple.com/app/id6801264369')
    expect(APP_STORE_LISTING_URLS).toEqual({ ios: APP_STORE_APP_URL, android: GOOGLE_PLAY_APP_URL })
  })
})
