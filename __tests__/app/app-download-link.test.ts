import { GOOGLE_PLAY_APP_URL } from '@/constants/appStore'

describe('app download link', () => {
  it('uses the public Google Play production listing URL', () => {
    expect(GOOGLE_PLAY_APP_URL).toBe(
      'https://play.google.com/store/apps/details?id=by.metravel.app',
    )
    expect(GOOGLE_PLAY_APP_URL).not.toContain('/apps/testing/')
    expect(GOOGLE_PLAY_APP_URL).not.toContain('/apps/internaltest/')
  })
})
