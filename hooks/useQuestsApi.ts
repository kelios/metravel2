// hooks/useQuestsApi.ts
// Хуки для работы с квестами через бэкенд API.
// Чистые адаптеры и типы вынесены в utils/questAdapters.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiQuestProgress } from '@/api/quests';
import {
    fetchQuestsList,
    fetchQuestByQuestId,
    fetchQuestCities,
    fetchOrCreateProgress,
    updateProgress as apiUpdateProgress,
    deleteProgress as apiDeleteProgress,
} from '@/api/quests';
import {
    adaptMeta,
    adaptBundle,
} from '@/utils/questAdapters';
import type { QuestMeta, FrontendQuestBundle } from '@/utils/questAdapters';

// Re-export types for backward compatibility
export type { QuestMeta, FrontendQuestBundle };
export { adaptBundle, adaptMeta };

// ===================== ХУКИ =====================

/** Хук для загрузки списка квестов */
export function useQuestsList() {
    const [quests, setQuests] = useState<QuestMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        fetchQuestsList()
            .then((data) => {
                if (cancelled) return;
                setQuests(data.map(adaptMeta));
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                console.warn('Failed to load quests list:', err?.message);
                setError(err?.message || 'Ошибка загрузки квестов');
                setLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    // Группировка по городу
    const cityQuestsIndex = useMemo(() => {
        const index: Record<string, QuestMeta[]> = {};
        for (const q of quests) {
            (index[q.cityId] ||= []).push(q);
        }
        return index;
    }, [quests]);

    return { quests, cityQuestsIndex, loading, error };
}

/** Хук для загрузки городов с квестами */
export function useQuestCities() {
    const [cities, setCities] = useState<Array<{ id: string; name: string; lat: number; lng: number }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetchQuestCities()
            .then((data) => {
                if (!cancelled) {
                    setCities(data.map(c => ({
                        id: String(c.id),
                        name: c.name || '',
                        lat: parseFloat(String(c.lat)),
                        lng: parseFloat(String(c.lng)),
                    })));
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (cancelled) return;
                console.warn('Failed to load quest cities:', err?.message);
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    return { cities, loading };
}

/** Хук для загрузки полного бандла квеста по quest_id */
export function useQuestBundle(questId: string | undefined) {
    const [bundle, setBundle] = useState<FrontendQuestBundle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            .then((data) => {
                if (cancelled) return;
                setBundle(adaptBundle(data));
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                console.warn('Failed to load quest bundle:', err?.message);
                setError(err?.message || 'Квест не найден');
                setLoading(false);
            });

        return () => { cancelled = true; };
    }, [questId]);

    return { bundle, loading, error };
}

const PROGRESS_SYNC_DEBOUNCE_MS = 2000;

/** Хук для синхронизации прогресса квеста с бэкендом (для авторизованных) */
export function useQuestProgressSync(questId: string | undefined, isAuthenticated: boolean) {
    const [progress, setProgress] = useState<ApiQuestProgress | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [progressLoading, setProgressLoading] = useState(isAuthenticated && !!questId);
    const progressIdRef = useRef<number | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingDataRef = useRef<any>(null);

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

    // Flush on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    // Сохранение прогресса на сервер (с дебаунсом 2 сек)
    const saveProgress = useCallback((data: {
        currentIndex: number;
        unlockedIndex: number;
        answers: Record<string, string>;
        attempts: Record<string, number>;
        hints: Record<string, boolean>;
        showMap: boolean;
        completed?: boolean;
    }) => {
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
