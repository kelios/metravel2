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

export const GUEST_FAVORITE_INTENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const isValidStoredIntent = (value: unknown): value is GuestFavoriteIntent => {
  if (!value || typeof value !== 'object') return false
  const intent = value as Partial<GuestFavoriteIntent>
  return (
    typeof intent.id === 'string' &&
    intent.id.length > 0 &&
    (intent.type === 'travel' || intent.type === 'article') &&
    typeof intent.title === 'string' &&
    typeof intent.url === 'string' &&
    typeof intent.createdAt === 'number'
  )
}

/**
 * Reads and removes the pending guest favorite intent. Returns the intent when
 * it is well-formed and fresh enough to complete after auth, otherwise null.
 */
export const consumeGuestFavoriteIntent = async (
  maxAgeMs: number = GUEST_FAVORITE_INTENT_MAX_AGE_MS
): Promise<GuestFavoriteIntent | null> => {
  try {
    const raw = await AsyncStorage.getItem(GUEST_FAVORITE_INTENT_KEY)
    if (!raw) return null
    await AsyncStorage.removeItem(GUEST_FAVORITE_INTENT_KEY)

    const parsed: unknown = JSON.parse(raw)
    if (!isValidStoredIntent(parsed)) return null
    if (Date.now() - parsed.createdAt > maxAgeMs) return null
    return parsed
  } catch {
    return null
  }
}

