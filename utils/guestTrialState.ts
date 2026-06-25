import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const GUEST_FAVORITES_KEY = 'guestFavorites:v1';
export const GUEST_QUEST_PREVIEW_KEY = 'guestQuestPreview:v1';

type GuestQuestPreviewEntry = {
  questId: string;
  cityId?: string;
  stepId?: string;
  savedAt: number;
};

const isAndroidGuestTrialEnabled = () => Platform.OS === 'android';

export const getGuestFavoritesStorageKey = (userId: string | null): string => {
  if (!userId && isAndroidGuestTrialEnabled()) return GUEST_FAVORITES_KEY;
  return userId ? `metravel_favorites_${userId}` : 'metravel_favorites';
};

export async function recordGuestQuestPreview(params: {
  questId: string;
  cityId?: string;
  stepId?: string;
}): Promise<void> {
  if (!isAndroidGuestTrialEnabled()) return;

  const questId = String(params.questId || '').trim();
  if (!questId) return;

  try {
    const raw = await AsyncStorage.getItem(GUEST_QUEST_PREVIEW_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const entries: GuestQuestPreviewEntry[] = Array.isArray(parsed) ? parsed : [];
    const nextEntry: GuestQuestPreviewEntry = {
      questId,
      cityId: params.cityId ? String(params.cityId) : undefined,
      stepId: params.stepId ? String(params.stepId) : undefined,
      savedAt: Date.now(),
    };
    const next = [
      ...entries.filter((entry) => entry?.questId !== questId),
      nextEntry,
    ].slice(-30);
    await AsyncStorage.setItem(GUEST_QUEST_PREVIEW_KEY, JSON.stringify(next));
  } catch {
    // Guest trial analytics/state is best effort and must not block preview.
  }
}
