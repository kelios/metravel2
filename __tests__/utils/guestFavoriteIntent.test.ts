import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  GUEST_FAVORITE_INTENT_KEY,
  GUEST_FAVORITE_INTENT_MAX_AGE_MS,
  consumeGuestFavoriteIntent,
  saveGuestFavoriteIntent,
} from '@/utils/guestFavoriteIntent'

describe('guestFavoriteIntent', () => {
  beforeEach(async () => {
    ;(AsyncStorage as any).__reset?.()
    await AsyncStorage.removeItem(GUEST_FAVORITE_INTENT_KEY)
  })

  it('consume returns a fresh saved intent and removes it from storage', async () => {
    await saveGuestFavoriteIntent({
      id: '42',
      type: 'article',
      title: 'Гайд по Минску',
      url: '/article/minsk-guide',
      source: 'article_detail',
    })

    const intent = await consumeGuestFavoriteIntent()

    expect(intent).toMatchObject({
      id: '42',
      type: 'article',
      title: 'Гайд по Минску',
      url: '/article/minsk-guide',
    })
    expect(await AsyncStorage.getItem(GUEST_FAVORITE_INTENT_KEY)).toBeNull()
    // Second consume is a no-op: the intent completes at most once.
    expect(await consumeGuestFavoriteIntent()).toBeNull()
  })

  it('consume drops a stale intent', async () => {
    const stale = {
      id: '7',
      type: 'travel',
      title: 'Old trip',
      url: '/travels/old-trip',
      createdAt: Date.now() - GUEST_FAVORITE_INTENT_MAX_AGE_MS - 1000,
    }
    await AsyncStorage.setItem(GUEST_FAVORITE_INTENT_KEY, JSON.stringify(stale))

    expect(await consumeGuestFavoriteIntent()).toBeNull()
    expect(await AsyncStorage.getItem(GUEST_FAVORITE_INTENT_KEY)).toBeNull()
  })

  it('consume tolerates malformed payloads', async () => {
    await AsyncStorage.setItem(GUEST_FAVORITE_INTENT_KEY, 'not-json{')
    expect(await consumeGuestFavoriteIntent()).toBeNull()

    await AsyncStorage.setItem(GUEST_FAVORITE_INTENT_KEY, JSON.stringify({ id: 1, type: 'quest' }))
    expect(await consumeGuestFavoriteIntent()).toBeNull()
  })
})
