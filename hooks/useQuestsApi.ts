// hooks/useQuestsApi.ts
// Хуки и адаптеры для работы с квестами через бэкенд API
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QuestStep, QuestFinale, QuestCity } from '@/components/quests/QuestWizard';
import type {
    ApiQuestMeta,
    ApiQuestBundle,
    ApiQuestStep,
    ApiQuestCity,
    ApiQuestFinale,
    ApiQuestProgress,
} from '@/src/api/quests';
import {
    fetchQuestsList,
    fetchQuestByQuestId,
    fetchQuestCities,
    fetchOrCreateProgress,
    updateProgress as apiUpdateProgress,
    deleteProgress as apiDeleteProgress,
} from '@/src/api/quests';

// ===================== ТИПЫ ФРОНТЕНДА =====================

/** Метаданные квеста для каталогов/поиска (фронтенд формат) */
export type QuestMeta = {
    id: string;
    title: string;
    points: number;
    cityId: string;
    lat: number;
    lng: number;
    durationMin?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    tags?: string[];
    petFriendly?: boolean;
    cover?: any;
};

// ===================== АДАПТЕРЫ: API → Frontend =====================

/** Нормализация ответа пользователя (дублирует логику из data файлов) */
function normalize(s: string): string {
    return s
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,;:!?'„""–—-]/g, '')
        .replace(/ё/g, 'е')
        .trim();
}

/** Создаёт функцию проверки ответа из бэкенд-конфига */
function buildAnswerChecker(answerType: string, answerValue: string): (input: string) => boolean {
    switch (answerType) {
        case 'any':
            return () => true;

        case 'exact': {
            const target = answerValue.toLowerCase();
            return (input: string) => {
                const n = normalize(input);
                // Пробуем как число
                const asNum = parseInt(input, 10);
                if (!Number.isNaN(asNum) && String(asNum) === target) return true;
                return n === target;
            };
        }

        case 'exact_any': {
            try {
                const variants: string[] = JSON.parse(answerValue);
                return (input: string) => {
                    const n = normalize(input);
                    return variants.some(v => n === v.toLowerCase());
                };
            } catch {
                return () => false;
            }
        }

        case 'range': {
            try {
                const { min, max } = JSON.parse(answerValue);
                return (input: string) => {
                    const n = parseInt(input, 10);
                    return !Number.isNaN(n) && n >= min && n <= max;
                };
            } catch {
                return () => false;
            }
        }

        case 'any_text': {
            try {
                const { min_length } = JSON.parse(answerValue);
                return (input: string) => normalize(input).length >= (min_length || 1);
            } catch {
                return (input: string) => normalize(input).length > 0;
            }
        }

        case 'any_number':
            return (input: string) => !Number.isNaN(parseInt(input, 10));

        case 'approx': {
            try {
                const { target, tolerance } = JSON.parse(answerValue);
                return (input: string) => {
                    const val = parseFloat(input.replace(',', '.'));
                    return !Number.isNaN(val) && Math.abs(val - target) < tolerance;
                };
            } catch {
                return () => false;
            }
        }

        case 'function': {
            // Fallback: пробуем eval (только для миграции, в проде не должно быть)
            try {
                // eslint-disable-next-line no-eval
                const fn = eval(`(${answerValue})`);
                if (typeof fn === 'function') return fn;
            } catch { /* ignore */ }
            return () => false;
        }

        default:
            return () => false;
    }
}

/** Конвертирует шаг из API формата во фронтенд формат */
function adaptStep(apiStep: ApiQuestStep): QuestStep {
    return {
        id: apiStep.id,
        title: apiStep.title,
        location: apiStep.location,
        story: apiStep.story,
        task: apiStep.task,
        hint: apiStep.hint || undefined,
        answer: buildAnswerChecker(apiStep.answer_type, apiStep.answer_value),
        lat: typeof apiStep.lat === 'string' ? parseFloat(apiStep.lat) : apiStep.lat,
        lng: typeof apiStep.lng === 'string' ? parseFloat(apiStep.lng) : apiStep.lng,
        mapsUrl: apiStep.maps_url,
        image: apiStep.image_url || undefined,
        inputType: apiStep.input_type,
    };
}

/** Конвертирует финал из API формата */
function adaptFinale(apiFinale: ApiQuestFinale): QuestFinale {
    return {
        text: apiFinale.text,
        video: apiFinale.video_url || undefined,
        poster: apiFinale.poster_url || undefined,
    };
}

/** Конвертирует город из API формата */
function adaptCity(apiCity: ApiQuestCity): QuestCity {
    return {
        name: apiCity.name || undefined,
        lat: parseFloat(String(apiCity.lat)),
        lng: parseFloat(String(apiCity.lng)),
    };
}

/** Тип бандла для фронтенда (совместим с QuestWizardProps) */
export type FrontendQuestBundle = {
    title: string;
    steps: QuestStep[];
    finale: QuestFinale;
    intro?: QuestStep;
    storageKey?: string;
    city?: QuestCity;
    coverUrl?: string;
};

/** Конвертирует полный бандл из API формата */
export function adaptBundle(apiBundle: ApiQuestBundle): FrontendQuestBundle {
    let steps: QuestStep[] = [];
    try {
        const rawSteps: ApiQuestStep[] = typeof apiBundle.steps === 'string'
            ? JSON.parse(apiBundle.steps)
            : apiBundle.steps;
        steps = rawSteps.map(adaptStep);
    } catch (e) {
        console.error('Error parsing quest steps:', e);
    }

    let intro: QuestStep | undefined;
    try {
        if (apiBundle.intro) {
            const rawIntro: ApiQuestStep = typeof apiBundle.intro === 'string'
                ? JSON.parse(apiBundle.intro)
                : apiBundle.intro;
            intro = { ...adaptStep(rawIntro), id: 'intro' };
        }
    } catch (e) {
        console.error('Error parsing quest intro:', e);
    }

    return {
        title: apiBundle.title,
        steps,
        finale: adaptFinale(apiBundle.finale),
        intro,
        storageKey: apiBundle.storage_key,
        city: adaptCity(apiBundle.city),
    };
}

/** Конвертирует метаданные квеста из API формата */
export function adaptMeta(apiMeta: ApiQuestMeta): QuestMeta {
    return {
        id: apiMeta.quest_id,
        title: apiMeta.title,
        points: parseInt(String(apiMeta.points), 10) || 0,
        cityId: apiMeta.city_id,
        lat: parseFloat(String(apiMeta.lat)),
        lng: parseFloat(String(apiMeta.lng)),
        durationMin: apiMeta.duration_min ?? undefined,
        difficulty: (apiMeta.difficulty as 'easy' | 'medium' | 'hard') || undefined,
        tags: apiMeta.tags ? Object.keys(apiMeta.tags) : undefined,
        petFriendly: apiMeta.pet_friendly,
        cover: apiMeta.cover_url || undefined,
    };
}

// ===================== ХУКИ =====================

/** Ленивый fallback на локальный реестр при недоступности API */
async function fallbackQuestsList(): Promise<QuestMeta[]> {
    try {
        const mod = await import('@/components/quests/registry');
        const allMeta: any[] = (mod as any).ALL_QUESTS_META || [];
        return allMeta.map((m: any) => ({
            id: m.id,
            title: m.title,
            points: m.points ?? 0,
            cityId: m.cityId ?? '',
            lat: m.lat ?? 0,
            lng: m.lng ?? 0,
            durationMin: m.durationMin,
            difficulty: m.difficulty,
            tags: m.tags,
            petFriendly: m.petFriendly,
            cover: m.cover,
        }));
    } catch {
        return [];
    }
}

async function fallbackQuestBundle(questId: string): Promise<FrontendQuestBundle | null> {
    try {
        const mod = await import('@/components/quests/registry');
        const getQuestById: (id: string) => any = (mod as any).getQuestById;
        const b = getQuestById(questId);
        return b || null;
    } catch {
        return null;
    }
}

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
                if (!cancelled) {
                    setQuests(data.map(adaptMeta));
                    setLoading(false);
                }
            })
            .catch(async (err) => {
                if (cancelled) return;
                console.warn('API unavailable, falling back to local registry:', err?.message);
                const local = await fallbackQuestsList();
                if (!cancelled) {
                    setQuests(local);
                    setError(local.length ? null : (err?.message || 'Ошибка загрузки квестов'));
                    setLoading(false);
                }
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
            .catch(async () => {
                if (cancelled) return;
                console.warn('API unavailable for quest cities, falling back to local data');
                try {
                    const mod = await import('@/components/quests/cityQuests');
                    const localCities: any[] = (mod as any).CITIES || [];
                    if (!cancelled) {
                        setCities(localCities.map((c: any) => ({
                            id: c.id,
                            name: c.name || '',
                            lat: c.lat ?? 0,
                            lng: c.lng ?? 0,
                        })));
                    }
                } catch { /* ignore */ }
                if (!cancelled) setLoading(false);
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
                if (!cancelled) {
                    setBundle(adaptBundle(data));
                    setLoading(false);
                }
            })
            .catch(async (err) => {
                if (cancelled) return;
                console.warn('API unavailable for quest bundle, falling back to local registry:', err?.message);
                const local = await fallbackQuestBundle(questId);
                if (!cancelled) {
                    setBundle(local);
                    setError(local ? null : (err?.message || 'Квест не найден'));
                    setLoading(false);
                }
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
    const progressIdRef = useRef<number | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingDataRef = useRef<any>(null);

    // Загрузка прогресса при маунте
    useEffect(() => {
        if (!questId || !isAuthenticated) return;

        let cancelled = false;
        fetchOrCreateProgress(questId)
            .then((data) => {
                if (!cancelled) {
                    setProgress(data);
                    progressIdRef.current = data.id;
                }
            })
            .catch((err) => {
                console.warn('Could not load quest progress from server:', err);
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

    return { progress, syncing, saveProgress, resetProgress };
}
