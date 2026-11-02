import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * #2898: гость нажал «Добавить в план» — после входа/регистрации маршрут
 * попадает в план (статус «Хочу поехать»: «Планирую» сервер принимает только с датой), а не теряется на экране входа.
 * Тот же приём, что `utils/guestFavoriteIntent.ts`: одно отложенное действие,
 * живёт 7 дней, читается и удаляется один раз.
 */
export const GUEST_PLAN_INTENT_KEY = 'metravel:pendingPlanIntent'
export const GUEST_PLAN_INTENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type GuestPlanIntent = {
  id: string
  title: string
  url?: string
  imageUrl?: string
  country?: string
  city?: string
  travelYear?: string
  travelMonth?: string | string[]
  travelMonthName?: string
  createdAt: number
}

const text = (value: unknown, max: number) =>
  value === undefined || value === null || value === '' ? undefined : String(value).trim().slice(0, max) || undefined

export const saveGuestPlanIntent = async (intent: Omit<GuestPlanIntent, 'createdAt'>) => {
  const record: GuestPlanIntent = {
    id: String(intent.id),
    title: String(intent.title || '').trim().slice(0, 160),
    url: text(intent.url, 240),
    imageUrl: text(intent.imageUrl, 240),
    country: text(intent.country, 120),
    city: text(intent.city, 120),
    travelYear: intent.travelYear,
    travelMonth: intent.travelMonth,
    travelMonthName: text(intent.travelMonthName, 40),
    createdAt: Date.now(),
  }
  try {
    await AsyncStorage.setItem(GUEST_PLAN_INTENT_KEY, JSON.stringify(record))
  } catch {
    // Best effort: переход на вход не должен зависеть от хранилища.
  }
}

const isValid = (value: unknown): value is GuestPlanIntent => {
  if (!value || typeof value !== 'object') return false
  const intent = value as Partial<GuestPlanIntent>
  return typeof intent.id === 'string' && intent.id.length > 0
    && typeof intent.title === 'string'
    && typeof intent.createdAt === 'number'
}

/** Читает и удаляет отложенное «в план»; `null` — нет, испорчено или старше 7 дней. */
export const consumeGuestPlanIntent = async (
  maxAgeMs: number = GUEST_PLAN_INTENT_MAX_AGE_MS,
): Promise<GuestPlanIntent | null> => {
  try {
    const raw = await AsyncStorage.getItem(GUEST_PLAN_INTENT_KEY)
    if (!raw) return null
    await AsyncStorage.removeItem(GUEST_PLAN_INTENT_KEY)
    const parsed: unknown = JSON.parse(raw)
    if (!isValid(parsed)) return null
    if (Date.now() - parsed.createdAt > maxAgeMs) return null
    return parsed
  } catch {
    return null
  }
}
