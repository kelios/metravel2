import AsyncStorage from '@react-native-async-storage/async-storage'

// Гостевой прогресс квеста — device-local, без токена. Аналог серверного
// ApiQuestProgress, но хранится в AsyncStorage под ключом на quest_id.
// Токен API требуется на /quest-progress/, поэтому до логина всё локально;
// после логина — миграция replay'ем через штатный авторизованный эндпоинт.

export const GUEST_QUEST_PROGRESS_PREFIX = 'guestQuestProgress:v1:'

// Сколько «настоящих» точек (без intro) гость может пройти до мягкого гейта.
export const GUEST_QUEST_FREE_STEPS = 2

export type GuestQuestProgress = {
  currentIndex: number
  unlockedIndex: number
  answers: Record<string, string>
  attempts: Record<string, number>
  hints: Record<string, boolean>
  showMap: boolean
  completed?: boolean
}

const guestQuestKey = (questId: string): string => `${GUEST_QUEST_PROGRESS_PREFIX}${questId}`

export async function loadGuestQuestProgress(questId: string): Promise<GuestQuestProgress | null> {
  const id = String(questId || '').trim()
  if (!id) return null
  try {
    const raw = await AsyncStorage.getItem(guestQuestKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      currentIndex: Number(parsed.currentIndex) || 0,
      unlockedIndex: Number(parsed.unlockedIndex) || 0,
      answers: parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {},
      attempts: parsed.attempts && typeof parsed.attempts === 'object' ? parsed.attempts : {},
      hints: parsed.hints && typeof parsed.hints === 'object' ? parsed.hints : {},
      showMap: parsed.showMap !== false,
      completed: Boolean(parsed.completed),
    }
  } catch {
    // Приватный режим браузера / повреждённый JSON — ведём себя как без прогресса.
    return null
  }
}

export async function saveGuestQuestProgress(questId: string, progress: GuestQuestProgress): Promise<void> {
  const id = String(questId || '').trim()
  if (!id) return
  try {
    await AsyncStorage.setItem(guestQuestKey(id), JSON.stringify(progress))
  } catch {
    // Best effort: storage может быть недоступен (приватный режим) — не роняем квест.
  }
}

export async function clearGuestQuestProgress(questId: string): Promise<void> {
  const id = String(questId || '').trim()
  if (!id) return
  try {
    await AsyncStorage.removeItem(guestQuestKey(id))
  } catch {
    // noop
  }
}

// Сколько «настоящих» точек (answers по questSteps) гость уже прошёл.
export function countGuestAnsweredSteps(
  answers: Record<string, string>,
  questStepIds: string[],
): number {
  let count = 0
  for (const stepId of questStepIds) {
    if (answers[stepId]) count += 1
  }
  return count
}
