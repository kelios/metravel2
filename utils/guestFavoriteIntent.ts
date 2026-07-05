import AsyncStorage from '@react-native-async-storage/async-storage'

export const GUEST_FAVORITE_INTENT_KEY = 'metravel:pendingFavoriteIntent'

export type GuestFavoriteIntent = {
  id: string
  type: 'travel' | 'article'
  title: string
  url: string
  imageUrl?: string
  source?: string
  createdAt: number
}

const normalizeIntent = (intent: Omit<GuestFavoriteIntent, 'createdAt'>): GuestFavoriteIntent => ({
  id: String(intent.id),
  type: intent.type,
  title: String(intent.title || '').trim().slice(0, 160),
  url: String(intent.url || '').trim().slice(0, 240),
  imageUrl: intent.imageUrl ? String(intent.imageUrl).trim().slice(0, 240) : undefined,
  source: intent.source ? String(intent.source).trim().slice(0, 120) : undefined,
  createdAt: Date.now(),
})

export const saveGuestFavoriteIntent = async (intent: Omit<GuestFavoriteIntent, 'createdAt'>) => {
  try {
    await AsyncStorage.setItem(GUEST_FAVORITE_INTENT_KEY, JSON.stringify(normalizeIntent(intent)))
  } catch {
    // Best effort: auth redirect must not be blocked by unavailable storage.
  }
}

