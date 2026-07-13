// api/questBundleCache.ts
// Персист сырого ApiQuestBundle в AsyncStorage для офлайн-прохождения квеста.
// Кэшируем именно СЫРОЙ (нормализованный) бандл — adaptBundle гоняет чекеры-функции
// ответов, которые не сериализуются, поэтому адаптация делается на клиенте при чтении.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ApiQuestBundle } from '@/api/quests';

export const QUEST_BUNDLE_CACHE_PREFIX = 'quest-bundle:';
export const QUEST_BUNDLE_CACHE_VERSION = 1;

type CachedQuestBundleEnvelope = {
    version: number;
    savedAt: number;
    bundle: ApiQuestBundle;
};

const cacheKey = (questId: string): string => `${QUEST_BUNDLE_CACHE_PREFIX}${questId}`;

/** Читает сырой бандл квеста из офлайн-кэша (null — если нет/повреждён/другая версия). */
export async function readCachedQuestBundle(questId: string): Promise<ApiQuestBundle | null> {
    const id = String(questId || '').trim();
    if (!id) return null;
    try {
        const raw = await AsyncStorage.getItem(cacheKey(id));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CachedQuestBundleEnvelope>;
        if (!parsed || parsed.version !== QUEST_BUNDLE_CACHE_VERSION || !parsed.bundle) return null;
        return parsed.bundle;
    } catch {
        // Приватный режим / повреждённый JSON — ведём себя как без кэша.
        return null;
    }
}

/** Пишет сырой бандл квеста в офлайн-кэш (best-effort, ошибки записи глушим). */
export async function writeCachedQuestBundle(
    questId: string,
    bundle: ApiQuestBundle,
    savedAt: number = Date.now(),
): Promise<void> {
    const id = String(questId || '').trim();
    if (!id) return;
    const envelope: CachedQuestBundleEnvelope = {
        version: QUEST_BUNDLE_CACHE_VERSION,
        savedAt,
        bundle,
    };
    try {
        await AsyncStorage.setItem(cacheKey(id), JSON.stringify(envelope));
    } catch (err) {
        console.warn('Failed to cache quest bundle for offline:', err);
    }
}
