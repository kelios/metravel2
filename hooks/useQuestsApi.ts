// hooks/useQuestsApi.ts
// Хуки для работы с квестами через бэкенд API.
// Чистые адаптеры и типы вынесены в utils/questAdapters.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ApiQuestMeta, ApiQuestProgress, QuestReview } from '@/api/quests';
import {
    fetchQuestsList,
    fetchQuestByQuestId,
    fetchQuestCities,
    fetchOrCreateProgress,
    fetchQuestReviews,
    updateProgress as apiUpdateProgress,
    deleteProgress as apiDeleteProgress,
} from '@/api/quests';
import { queryKeys } from '@/api/queryKeys';
import {
    adaptMeta,
    adaptBundle,
    normalizeQuestCountryCode,
} from '@/utils/questAdapters';
import { devWarn } from '@/utils/logger';
import type { QuestMeta, FrontendQuestBundle } from '@/utils/questAdapters';
import { translate as i18nT } from '@/i18n'


// Re-export types for backward compatibility
export type { QuestMeta, FrontendQuestBundle };
export { adaptBundle, adaptMeta };

type PendingQuestProgressData = {
    currentIndex: number;
    unlockedIndex: number;
    answers: Record<string, string>;
    attempts: Record<string, number>;
    hints: Record<string, boolean>;
    showMap: boolean;
    completed?: boolean;
};

const getErrorMessage = (error: unknown, fallback: string): string =>
    error instanceof Error && typeof error.message === 'string' ? error.message : fallback;

// Полный список квестов кешируется под одним ключом queryKeys.quests(), чтобы
// экран квестов, промо-блок главной и три мета-хука детали (rating/completion/
// pioneer) дедуплицировались в один запрос /quests/. Держим список «свежим»
// ~30 мин и в кеше ~60 мин.
export const QUESTS_LIST_STALE_TIME = 30 * 60 * 1000;
export const QUESTS_LIST_GC_TIME = 60 * 60 * 1000;

// ===================== ХУКИ =====================

/** Хук для загрузки списка квестов */
export function useQuestsList(opts?: { enabled?: boolean }) {
    const enabled = opts?.enabled ?? true;
    const { data, isPending, error } = useQuery<ApiQuestMeta[]>({
        queryKey: queryKeys.quests(),
        queryFn: fetchQuestsList,
        enabled,
        staleTime: QUESTS_LIST_STALE_TIME,
        gcTime: QUESTS_LIST_GC_TIME,
    });

    const quests = useMemo<QuestMeta[]>(
        () => (data ?? []).map(adaptMeta),
        [data],
    );

    // Группировка по городу
    const cityQuestsIndex = useMemo(() => {
        const index: Record<string, QuestMeta[]> = {};
        for (const q of quests) {
            (index[q.cityId] ||= []).push(q);
        }
        return index;
    }, [quests]);

    const errorMessage = error
        ? getErrorMessage(error, i18nT('quests:hooks.useQuestsApi.oshibka_zagruzki_kvestov_cdefd63b'))
        : null;
    if (error) devWarn('Failed to load quests list:', errorMessage);

    return { quests, cityQuestsIndex, loading: enabled && isPending, error: errorMessage };
}

/** Хук для загрузки городов с квестами */
export function useQuestCities() {
    const [cities, setCities] = useState<Array<{ id: string; name: string; lat: number; lng: number; countryCode?: string }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const loadCities = async () => {
            setLoading(true);
            try {
                const data = await fetchQuestCities();
                if (cancelled) return;

                const safeCities = Array.isArray(data) ? data : [];
                setCities(safeCities.map(c => {
                    const lat = parseFloat(String(c.lat));
                    const lng = parseFloat(String(c.lng));
                    const countryCode = normalizeQuestCountryCode(c.country_code, lat, lng);

                    return {
                        id: String(c.id),
                        name: c.name || '',
                        lat,
                        lng,
                        countryCode,
                    };
                }));
            } catch (err: unknown) {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : String(err);
                devWarn('Failed to load quest cities:', message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void loadCities();
        return () => { cancelled = true; };
    }, []);

    return { cities, loading };
}

// Сессионный памятник списка квестов для фонового дообогащения бандла тегами:
// без него каждое открытие детали дёргало бы полный пагинированный список.
let questsListForTagsPromise: ReturnType<typeof fetchQuestsList> | null = null;
const fetchQuestsListMemoized = () => {
    if (!questsListForTagsPromise) {
        questsListForTagsPromise = fetchQuestsList().catch((err) => {
            questsListForTagsPromise = null;
            throw err;
        });
    }
    return questsListForTagsPromise;
};

/** Хук для загрузки полного бандла квеста по quest_id */
export function useQuestBundle(questId: string | undefined) {
    const [bundle, setBundle] = useState<FrontendQuestBundle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);

    const refetch = useCallback(() => {
        setReloadToken((t) => t + 1);
    }, []);

    useEffect(() => {
        if (!questId) {
            setBundle(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);
        setBundle(null);

        fetchQuestByQuestId(questId)
            .then(async (rawBundle) => {
                if (cancelled) return;

                const adaptedBundle = adaptBundle(rawBundle);
                // cover_url теперь приходит в детальном бандле (#729, verified prod).
                // Полный список /quests/ подгружаем ЛЕНИВО, только если обложки в
                // детали почему-то нет (легаси/кэш) — экономит запрос всего списка
                // на каждое открытие квеста.
                if (!adaptedBundle.coverUrl) {
                    const list = await fetchQuestsList().catch(() => null);
                    if (cancelled) return;
                    const matchedMeta = Array.isArray(list)
                        ? list.find((quest) => String(quest?.quest_id) === questId)
                        : null;
                    const coverFallback = matchedMeta ? adaptMeta(matchedMeta).cover : undefined;
                    if (coverFallback) {
                        adaptedBundle.coverUrl = coverFallback;
                    }
                }

                setBundle(adaptedBundle);
                setLoading(false);

                // Теги в detail-API отсутствуют, а от них зависит поведение карты
                // (кольцевые `loop`-квесты замыкают маршрут к старту). Дотягиваем
                // их фоном из списка (с AsyncStorage-кэшем для офлайна), не
                // блокируя первый рендер бандла.
                void fetchQuestsListMemoized()
                    .then((list) => {
                        if (cancelled || !Array.isArray(list)) return;
                        const matchedMeta = list.find((quest) => String(quest?.quest_id) === questId);
                        const tags = matchedMeta ? adaptMeta(matchedMeta).tags : undefined;
                        if (!tags?.length) return;
                        setBundle((prev) => (prev && prev.questId === String(questId) ? { ...prev, tags } : prev));
                    })
                    .catch(() => {});
            })
            .catch((err) => {
                if (cancelled) return;
                const message = getErrorMessage(err, i18nT('quests:hooks.useQuestsApi.kvest_ne_nayden_af9ac6a4'));
                console.warn('Failed to load quest bundle:', message);
                setError(message);
                setLoading(false);
            });

        return () => { cancelled = true; };
    }, [questId, reloadToken]);

    return { bundle, loading, error, refetch };
}

/** Хук для загрузки публичных отзывов о квесте (читалка чужих отзывов) */
export function useQuestReviews(questId: string | undefined, enabled = true) {
    return useQuery<QuestReview[]>({
        queryKey: queryKeys.questReviews(questId),
        queryFn: () => fetchQuestReviews(questId!),
        enabled: enabled && !!questId,
        staleTime: 60 * 1000,
    });
}

const PROGRESS_SYNC_DEBOUNCE_MS = 2000;

/** Хук для синхронизации прогресса квеста с бэкендом (для авторизованных) */
export function useQuestProgressSync(questId: string | undefined, isAuthenticated: boolean) {
    const [progress, setProgress] = useState<ApiQuestProgress | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [progressLoading, setProgressLoading] = useState(isAuthenticated && !!questId);
    const progressIdRef = useRef<number | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingDataRef = useRef<PendingQuestProgressData | null>(null);
    const isAuthenticatedRef = useRef(isAuthenticated);
    isAuthenticatedRef.current = isAuthenticated;

    // Загрузка прогресса при маунте
    useEffect(() => {
        if (!questId || !isAuthenticated) {
            setProgressLoading(false);
            return;
        }

        let cancelled = false;
        setProgressLoading(true);
        fetchOrCreateProgress(questId)
            .then((data) => {
                if (!cancelled) {
                    setProgress(data);
                    progressIdRef.current = data.id;
                }
            })
            .catch((err) => {
                console.warn('Could not load quest progress from server:', err);
            })
            .finally(() => {
                if (!cancelled) setProgressLoading(false);
            });

        return () => { cancelled = true; };
    }, [questId, isAuthenticated]);

    // Flush pending debounced save
    const flushSync = useCallback(async () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        const data = pendingDataRef.current;
        if (!data || !isAuthenticated || !progressIdRef.current) return;
        pendingDataRef.current = null;

        setSyncing(true);
        try {
            const updated = await apiUpdateProgress(progressIdRef.current, {
                current_index: data.currentIndex,
                unlocked_index: data.unlockedIndex,
                answers: data.answers,
                attempts: data.attempts,
                hints: data.hints,
                show_map: data.showMap,
                completed: data.completed,
            });
            setProgress(updated);
        } catch (err) {
            console.warn('Could not save quest progress to server:', err);
        } finally {
            setSyncing(false);
        }
    }, [isAuthenticated]);

    // Flush pending save on unmount — иначе изменение, сделанное за <2 сек до ухода
    // со страницы, теряется (debounce-таймер просто очищался). Делаем state-free
    // запрос, чтобы не дёргать setState на размонтированном компоненте.
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            const data = pendingDataRef.current;
            if (!data || !isAuthenticatedRef.current || !progressIdRef.current) return;
            pendingDataRef.current = null;
            void apiUpdateProgress(progressIdRef.current, {
                current_index: data.currentIndex,
                unlocked_index: data.unlockedIndex,
                answers: data.answers,
                attempts: data.attempts,
                hints: data.hints,
                show_map: data.showMap,
                completed: data.completed,
            }).catch((err) => {
                console.warn('Could not flush quest progress on unmount:', err);
            });
        };
    }, []);

    // Сохранение прогресса на сервер (с дебаунсом 2 сек)
    const saveProgress = useCallback((data: PendingQuestProgressData) => {
        if (!isAuthenticated || !progressIdRef.current) return;

        pendingDataRef.current = data;

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            flushSync();
        }, PROGRESS_SYNC_DEBOUNCE_MS);
    }, [isAuthenticated, flushSync]);

    // Сброс прогресса
    const resetProgress = useCallback(async () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        pendingDataRef.current = null;

        if (!isAuthenticated || !progressIdRef.current) return;
        try {
            await apiDeleteProgress(progressIdRef.current);
            setProgress(null);
            progressIdRef.current = null;
        } catch (err) {
            console.warn('Could not delete quest progress from server:', err);
        }
    }, [isAuthenticated]);

    return { progress, progressLoading, syncing, saveProgress, resetProgress };
}
