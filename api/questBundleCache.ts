// api/questBundleCache.ts
// Персист сырого ApiQuestBundle в AsyncStorage для офлайн-прохождения квеста.
// Кэшируем именно СЫРОЙ (нормализованный) бандл — adaptBundle гоняет чекеры-функции
// ответов, которые не сериализуются, поэтому адаптация делается на клиенте при чтении.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ApiQuestBundle, ApiQuestMeta } from '@/api/quests';
import { readQuestOffline, saveQuestOffline } from '@/services/offline/questOfflineAdapter';

export const QUEST_BUNDLE_CACHE_PREFIX = 'quest-bundle:';
export const QUEST_BUNDLE_CACHE_VERSION = 1;

export const QUEST_LIST_CACHE_KEY = 'quest-list:v1';
export const QUEST_LIST_CACHE_VERSION = 1;

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
    const catalogBundle = await readQuestOffline(id);
    if (catalogBundle) return catalogBundle;
    try {
        const raw = await AsyncStorage.getItem(cacheKey(id));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CachedQuestBundleEnvelope>;
        if (!parsed || parsed.version !== QUEST_BUNDLE_CACHE_VERSION || !parsed.bundle) return null;
        // One-way migration: keep the legacy value readable until the catalog
        // commit succeeds, then remove it so it cannot remain a second writable
        // quest-package source.
        const migrated = await saveQuestOffline(parsed.bundle, { pinned: false, includePhotos: false });
        if (migrated) {
            await AsyncStorage.removeItem(cacheKey(id));
        }
        return parsed.bundle;
    } catch {
        // Приватный режим / повреждённый JSON — ведём себя как без кэша.
        return null;
    }
}

/** Пишет сырой бандл квеста в единый OfflineCatalog (best-effort). */
export async function writeCachedQuestBundle(
    questId: string,
    bundle: ApiQuestBundle,
    _savedAt: number = Date.now(),
): Promise<void> {
    const id = String(questId || '').trim();
    if (!id) return;
    try {
        await saveQuestOffline(bundle, { pinned: false, includePhotos: false });
    } catch (err) {
        console.warn('Failed to cache quest bundle for offline:', err);
    }
}

type CachedQuestsListEnvelope = {
    version: number;
    savedAt: number;
    list: ApiQuestMeta[];
};

/**
 * Снимает персональные поля каталога. Ключ `QUEST_LIST_CACHE_KEY` один на
 * устройство, а не на аккаунт: после выхода или входа под другим пользователем
 * прежний владелец отдавал бы следующему свои «Пройден» и свою оценку (#1793).
 *
 * Чистим и при записи (персональное не попадает в хранилище вовсе), и при
 * чтении — кэши, записанные прежними версиями клиента, иначе продолжали бы
 * отдавать чужой статус до первого удачного онлайн-обновления.
 *
 * Общие поля (`rating_avg`, `rating_count`, `completions_count`, `views_count`,
 * `first_completer`) одинаковы для всех и остаются в кэше — на `completions_count`
 * и `views_count` опирается офлайн-отбор популярных для промо-блока (#1798).
 */
function stripPersonalQuestFields(list: ApiQuestMeta[]): ApiQuestMeta[] {
    return list.map((quest) => ({
        ...quest,
        is_completed_by_me: false,
        user_rating: null,
        personal_status_unavailable: true,
    }));
}

/**
 * Читает сырой список квестов из офлайн-кэша (null — если нет/повреждён/другая
 * версия). Персональные поля снимаются: см. `stripPersonalQuestFields`.
 */
export async function readCachedQuestsList(): Promise<ApiQuestMeta[] | null> {
    try {
        const raw = await AsyncStorage.getItem(QUEST_LIST_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CachedQuestsListEnvelope>;
        if (!parsed || parsed.version !== QUEST_LIST_CACHE_VERSION || !Array.isArray(parsed.list)) {
            return null;
        }
        return stripPersonalQuestFields(parsed.list);
    } catch {
        // Приватный режим / повреждённый JSON — ведём себя как без кэша.
        return null;
    }
}

/**
 * Пишет сырой список квестов в офлайн-кэш (best-effort, ошибки записи глушим).
 * Персональные поля не сохраняются: см. `stripPersonalQuestFields`.
 */
export async function writeCachedQuestsList(
    list: ApiQuestMeta[],
    savedAt: number = Date.now(),
): Promise<void> {
    const envelope: CachedQuestsListEnvelope = {
        version: QUEST_LIST_CACHE_VERSION,
        savedAt,
        list: stripPersonalQuestFields(list),
    };
    try {
        await AsyncStorage.setItem(QUEST_LIST_CACHE_KEY, JSON.stringify(envelope));
    } catch (err) {
        console.warn('Failed to cache quests list for offline:', err);
    }
}
