// api/questBundleCache.ts
// Персист сырого ApiQuestBundle в AsyncStorage для офлайн-прохождения квеста.
// Кэшируем именно СЫРОЙ (нормализованный) бандл — adaptBundle гоняет чекеры-функции
// ответов, которые не сериализуются, поэтому адаптация делается на клиенте при чтении.
//
// Язык контента (#2197): сохранённый квест — ОДНА запись `quest:{questId}` в
// OfflineCatalog, его снимок несёт `content_locale`, поэтому любая сохранённая
// копия читается как есть (лучше пройти квест на другом языке, чем потерять его
// без сети), а список офлайна не плодит дубли одного квеста по языкам. Легаси-
// ключ `quest-bundle:{id}` — копия до переводов, то есть `ru`; форма бандла
// выросла только необязательными полями, поэтому его версия не меняется.
// Каталог — `quest-list:v2:{locale}`; чтение — своя локаль, затем остальные,
// затем легаси `quest-list:v1` (это `ru`, не мигрируется; первая запись v2 его
// удаляет).
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ApiQuestBundle, ApiQuestMeta } from '@/api/quests';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { readQuestOffline, saveQuestOffline } from '@/services/offline/questOfflineAdapter';

export const QUEST_BUNDLE_CACHE_PREFIX = 'quest-bundle:';
export const QUEST_BUNDLE_CACHE_VERSION = 1;

export const QUEST_LIST_CACHE_KEY_PREFIX = 'quest-list:v2:';
export const QUEST_LIST_CACHE_VERSION = 2;
export const questListCacheKey = (locale: string): string => `${QUEST_LIST_CACHE_KEY_PREFIX}${locale}`;
export const LEGACY_QUEST_LIST_CACHE_KEY = 'quest-list:v1';
const LEGACY_QUEST_LIST_CACHE_VERSION = 1;

type CachedQuestBundleEnvelope = {
    version: number;
    savedAt: number;
    bundle: ApiQuestBundle;
};

const cacheKey = (questId: string): string => `${QUEST_BUNDLE_CACHE_PREFIX}${questId}`;

/** Public offline packages must never supply a previous account's metadata. */
function stripBundleIdentity(bundle: ApiQuestBundle): ApiQuestBundle {
    const publicBundle = { ...bundle };
    delete publicBundle.is_completed_by_me;
    delete publicBundle.user_rating;
    return publicBundle;
}

/** Читает сырой бандл квеста из офлайн-кэша (null — если нет/повреждён/другая версия). */
export async function readCachedQuestBundle(questId: string): Promise<ApiQuestBundle | null> {
    const id = String(questId || '').trim();
    if (!id) return null;
    const catalogBundle = await readQuestOffline(id);
    if (catalogBundle) return stripBundleIdentity(catalogBundle);
    try {
        const raw = await AsyncStorage.getItem(cacheKey(id));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CachedQuestBundleEnvelope>;
        if (!parsed || parsed.version !== QUEST_BUNDLE_CACHE_VERSION || !parsed.bundle) return null;
        // One-way migration: keep the legacy value readable until the catalog
        // commit succeeds, then remove it so it cannot remain a second writable
        // quest-package source.
        const migrated = await saveQuestOffline(stripBundleIdentity(parsed.bundle), { pinned: false, includePhotos: false });
        if (migrated) {
            await AsyncStorage.removeItem(cacheKey(id));
        }
        return stripBundleIdentity(parsed.bundle);
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
        await saveQuestOffline(stripBundleIdentity(bundle), { pinned: false, includePhotos: false });
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
 * Снимает персональные поля каталога. Ключ каталога один на
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

async function readQuestsListEnvelope(key: string, version: number): Promise<ApiQuestMeta[] | null> {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CachedQuestsListEnvelope>;
        if (!parsed || parsed.version !== version || !Array.isArray(parsed.list)) return null;
        return parsed.list;
    } catch {
        // Приватный режим / повреждённый JSON — ведём себя как без кэша.
        return null;
    }
}

/**
 * Читает сырой список квестов из офлайн-кэша (null — если нет/повреждён/другая
 * версия): сначала копия на `locale`, затем на любой другой локали, затем
 * легаси-копия до переводов. Персональные поля снимаются: см.
 * `stripPersonalQuestFields`.
 */
export async function readCachedQuestsList(locale: string): Promise<ApiQuestMeta[] | null> {
    const fallbacks = SUPPORTED_LOCALES.filter((item) => item !== locale);
    for (const candidate of [locale, ...fallbacks]) {
        const list = await readQuestsListEnvelope(questListCacheKey(candidate), QUEST_LIST_CACHE_VERSION);
        if (list) return stripPersonalQuestFields(list);
    }
    const legacy = await readQuestsListEnvelope(LEGACY_QUEST_LIST_CACHE_KEY, LEGACY_QUEST_LIST_CACHE_VERSION);
    return legacy ? stripPersonalQuestFields(legacy) : null;
}

/**
 * Пишет сырой список квестов на `locale` в офлайн-кэш (best-effort, ошибки
 * записи глушим). Персональные поля не сохраняются: см. `stripPersonalQuestFields`.
 * После записи легаси `quest-list:v1` недостижим — копия v2 читается раньше, —
 * поэтому удаляется, а не держит в хранилище лишний каталог.
 */
export async function writeCachedQuestsList(
    list: ApiQuestMeta[],
    locale: string,
    savedAt: number = Date.now(),
): Promise<void> {
    const envelope: CachedQuestsListEnvelope = {
        version: QUEST_LIST_CACHE_VERSION,
        savedAt,
        list: stripPersonalQuestFields(list),
    };
    try {
        await AsyncStorage.setItem(questListCacheKey(locale), JSON.stringify(envelope));
        await AsyncStorage.removeItem(LEGACY_QUEST_LIST_CACHE_KEY);
    } catch (err) {
        console.warn('Failed to cache quests list for offline:', err);
    }
}
