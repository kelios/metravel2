import { PLAY_TESTING_URL } from '@/app/app'

describe('app download link', () => {
  it('uses the Google Play closed Alpha testing opt-in URL', () => {
    expect(PLAY_TESTING_URL).toBe('https://play.google.com/apps/testing/by.metravel.app')
    expect(PLAY_TESTING_URL).not.toContain('/apps/internaltest/')
  })
})
