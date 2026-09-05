// hooks/useQuestsApi.ts
// Хуки для работы с квестами через бэкенд API.
// Чистые адаптеры и типы вынесены в utils/questAdapters.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiQuestMeta, ApiQuestProgress, QuestReview } from '@/api/quests';
import {
    fetchQuestsList,
    fetchQuestsPreview,
    fetchQuestByQuestId,
    fetchOrCreateProgress,
    fetchQuestProgress,
    fetchQuestReviews,
    updateProgress as apiUpdateProgress,
    deleteProgress as apiDeleteProgress,
} from '@/api/quests';
import { queryKeys } from '@/api/queryKeys';
import { QUESTS_LIST_GC_TIME, QUESTS_LIST_STALE_TIME } from '@/hooks/questsListCachePolicy';
import { questsListQueryOptions } from '@/hooks/questsListQuery';
import {
    adaptMeta,
    adaptBundle,
} from '@/utils/questAdapters';
import { selectPopularQuests } from '@/utils/questPopularity';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
    hasQuestProgressStarted,
    mergeQuestProgress,
    normalizeQuestProgressSnapshot,
    snapshotFromServerProgress,
    toQuestProgressServerPayload,
} from '@/utils/questProgressMerge';
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
    skipped?: Record<string, boolean>;
    earlyFinish?: boolean;
    /** Клиентские времена для слияния с параллельным устройством (на сервер не уходят) */
    updatedAt?: number;
    answeredAt?: Record<string, number>;
};

const getErrorMessage = (error: unknown, fallback: string): string =>
    error instanceof Error && typeof error.message === 'string' ? error.message : fallback;

// Полный список квестов кешируется под одним ключом queryKeys.quests(), чтобы
// экран квестов, промо-блок главной и три мета-хука детали (rating/completion/
// pioneer) дедуплицировались в один запрос /quests/. Держим список «свежим»
// ~30 мин и в кеше ~60 мин.
//
// #1393: и само определение запроса, и времена кеша живут в листовых модулях
// `questsListQuery` / `questsListCachePolicy`. Ре-экспорта отсюда намеренно
// НЕТ: он оставлял бы открытой ровно ту дверь, которую задача закрывала, —
// импорт двух констант из модуля, который тянет за собой адаптеры и таблицу
// контуров стран.

// ===================== ХУКИ =====================

/** Хук для загрузки списка квестов */
export function useQuestsList(opts?: { enabled?: boolean }) {
    const enabled = opts?.enabled ?? true;
    const { data, isPending, error } = useQuery<ApiQuestMeta[]>({
        ...questsListQueryOptions(),
        enabled,
    });

    const quests = useMemo<QuestMeta[]>(
        () => (data ?? []).map(adaptMeta),
        [data],
    );

    const errorMessage = error
        ? getErrorMessage(error, i18nT('quests:hooks.useQuestsApi.oshibka_zagruzki_kvestov_cdefd63b'))
        : null;
    if (error) devWarn('Failed to load quests list:', errorMessage);

    return { quests, loading: enabled && isPending, error: errorMessage };
}

/**
 * Первые N квестов каталога для промо-блоков (главная показывает два).
 * Ключ отдельный от queryKeys.quests(): полный каталог грузится страницами и
 * весит сотни килобайт, а промо-блоку хватает одного лёгкого запроса. Если
 * полный список уже в кеше (пришли с экрана квестов) — берём срез из него и в
 * сеть не идём.
 */
export function useQuestsPreview(limit: number, opts?: { enabled?: boolean }) {
    const enabled = opts?.enabled ?? true;
    const queryClient = useQueryClient();

    const { data, isPending, error } = useQuery<ApiQuestMeta[]>({
        queryKey: queryKeys.questsPreview(limit),
        queryFn: ({ signal }) => fetchQuestsPreview(limit, { signal }),
        enabled,
        staleTime: QUESTS_LIST_STALE_TIME,
        gcTime: QUESTS_LIST_GC_TIME,
        initialData: () => {
            // Полный каталог в кэше лежит в порядке id, а промо-блок показывает
            // популярные (#1798): без пересортировки блок мигал бы выборкой по
            // id всякий раз, когда главную открывают после экрана квестов.
            const fullList = queryClient.getQueryData<ApiQuestMeta[]>(queryKeys.quests());
            return fullList?.length ? selectPopularQuests(fullList, limit) : undefined;
        },
        // Возраст среза = возраст каталога, из которого он взят: иначе свежий
        // initialData вечно считался бы актуальным и промо-блок не обновлялся.
        initialDataUpdatedAt: () => queryClient.getQueryState(queryKeys.quests())?.dataUpdatedAt,
    });

    const quests = useMemo<QuestMeta[]>(
        () => (data ?? []).map(adaptMeta),
        [data],
    );

    const errorMessage = error
        ? getErrorMessage(error, i18nT('quests:hooks.useQuestsApi.oshibka_zagruzki_kvestov_cdefd63b'))
        : null;
    if (error) devWarn('Failed to load quests preview:', errorMessage);

    return { quests, loading: enabled && isPending, error: errorMessage };
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
                        if (!matchedMeta) return;
                        // An empty tag set is still a completed classification:
                        // ordinary quests must switch from the temporary map
                        // skeleton to the default walking route. Dropping `[]`
                        // here left every untagged quest paused indefinitely.
                        const tags = adaptMeta(matchedMeta).tags ?? [];
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
// Ретрай отложенного прогресса при офлайне: первый повтор через 2 сек, дальше
// удвоение до минуты. Число попыток не ограничено, пока экран квеста открыт —
// потерять часовое прохождение дороже нескольких лишних запросов.
const PROGRESS_RETRY_BASE_MS = 2000;
const PROGRESS_RETRY_MAX_MS = 60 * 1000;

/**
 * Отправка отложенного прогресса с защитой от затирания параллельного устройства:
 * перед PATCH забираем текущее серверное состояние и шлём слитое. Иначе телефон,
 * вернувшийся из офлайна, стёр бы ответы, записанные другим устройством.
 * Возвращает актуальную серверную запись (PATCH пропускается, если серверу
 * добавлять нечего).
 */
const pushMergedProgress = async (
    questId: string,
    data: PendingQuestProgressData,
): Promise<ApiQuestProgress> => {
    const serverProgress = await fetchOrCreateProgress(questId);
    const { merged, serverNeedsPush } = mergeQuestProgress(
        normalizeQuestProgressSnapshot(data),
        snapshotFromServerProgress(serverProgress),
    );

    if (!serverNeedsPush) return serverProgress;
    return apiUpdateProgress(serverProgress.id, toQuestProgressServerPayload(merged));
};

/** Хук для синхронизации прогресса квеста с бэкендом (для авторизованных) */
export function useQuestProgressSync(questId: string | undefined, isAuthenticated: boolean) {
    const [progress, setProgress] = useState<ApiQuestProgress | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [progressLoading, setProgressLoading] = useState(isAuthenticated && !!questId);
    const progressIdRef = useRef<number | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryAttemptRef = useRef(0);
    const inFlightRef = useRef(false);
    const flushQueuedRef = useRef(false);
    const mountedRef = useRef(true);
    const pendingDataRef = useRef<PendingQuestProgressData | null>(null);
    const isAuthenticatedRef = useRef(isAuthenticated);
    isAuthenticatedRef.current = isAuthenticated;
    // questId нужен флашу на размонтировании (эффект с пустыми deps) — держим в ref.
    const questIdRef = useRef(questId);
    questIdRef.current = questId;
    // flushSync и планировщик ретраев ссылаются друг на друга: держим актуальный
    // флаш в ref, чтобы таймеры и слушатели не вызывали стейл-замыкание.
    const flushSyncRef = useRef<(() => Promise<void>) | null>(null);
    const { isConnected } = useNetworkStatus();

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Немедленный флаш отложенного прогресса (возврат сети/приложения, появление
    // progress id). Сбрасывает бэкофф, чтобы не ждать следующий шаг ретрая.
    const flushPendingNow = useCallback(() => {
        if (!pendingDataRef.current) return;
        retryAttemptRef.current = 0;
        void flushSyncRef.current?.();
    }, []);

    // Чтение прогресса при маунте. Именно чтение: создавать строку здесь нельзя —
    // открытие экрана прохождением не является (#1803). Пока игрок ничего не
    // сделал, `progressIdRef` остаётся пустым, и на сервере записи нет.
    useEffect(() => {
        if (!questId || !isAuthenticated) {
            setProgressLoading(false);
            return;
        }

        let cancelled = false;
        setProgressLoading(true);
        fetchQuestProgress(questId)
            .then((data) => {
                if (!cancelled) {
                    setProgress(data);
                    progressIdRef.current = data?.id ?? null;
                    // Ответы, сделанные пока запрос был в полёте, ждут отправки —
                    // дожимаем. Строку создаст сам флаш, если игрок уже начал.
                    flushPendingNow();
                }
            })
            .catch((err) => {
                console.warn('Could not load quest progress from server:', err);
            })
            .finally(() => {
                if (!cancelled) setProgressLoading(false);
            });

        return () => { cancelled = true; };
    }, [flushPendingNow, questId, isAuthenticated]);

    const clearRetryTimer = useCallback(() => {
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    }, []);

    const scheduleRetry = useCallback(() => {
        clearRetryTimer();
        const attempt = retryAttemptRef.current;
        retryAttemptRef.current = attempt + 1;
        const delay = Math.min(PROGRESS_RETRY_BASE_MS * 2 ** attempt, PROGRESS_RETRY_MAX_MS);
        retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            void flushSyncRef.current?.();
        }, delay);
    }, [clearRetryTimer]);

    // Flush pending debounced save.
    // Отложенные данные НЕ выбрасываются до успешного ответа: раньше
    // pendingDataRef обнулялся до запроса, и при офлайне ответы игрока пропадали
    // навсегда (баг: после полного прохождения без сети на сервере оставался
    // только intro). Теперь падение запроса оставляет данные в очереди и
    // планирует ретрай с бэкоффом.
    const flushSync = useCallback(async () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        clearRetryTimer();

        const data = pendingDataRef.current;
        if (!data || !isAuthenticatedRef.current || !questId) return;
        // Нет id и игрок ещё ничего не сделал — отправлять нечего, а создавать
        // строку под пустой снапшот нельзя (#1803).
        if (!progressIdRef.current && !hasQuestProgressStarted(data)) return;

        // Параллельный флаш (дебаунс + ретрай/AppState) не должен слать дубль:
        // дожмём очередь после текущего запроса.
        if (inFlightRef.current) {
            flushQueuedRef.current = true;
            return;
        }

        inFlightRef.current = true;
        setSyncing(true);
        let saved = false;
        try {
            const updated = await pushMergedProgress(questId, data);
            saved = true;
            // Снимаем с очереди только то, что реально отправили: изменения,
            // сделанные во время запроса, остаются pending и уйдут своим флашем.
            if (pendingDataRef.current === data) pendingDataRef.current = null;
            retryAttemptRef.current = 0;
            progressIdRef.current = updated.id;
            if (mountedRef.current) setProgress(updated);
        } catch (err) {
            if (!pendingDataRef.current) pendingDataRef.current = data;
            devWarn('Could not save quest progress to server, will retry:', err);
            scheduleRetry();
        } finally {
            inFlightRef.current = false;
            if (mountedRef.current) setSyncing(false);
            const shouldFlushAgain = saved && flushQueuedRef.current && !!pendingDataRef.current;
            flushQueuedRef.current = false;
            if (shouldFlushAgain) void flushSyncRef.current?.();
        }
    }, [clearRetryTimer, questId, scheduleRetry]);
    flushSyncRef.current = flushSync;

    // Возврат в приложение и восстановление сети — сразу дожимаем отложенный
    // прогресс, не дожидаясь следующего шага бэкоффа.
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') flushPendingNow();
        });
        return () => subscription?.remove?.();
    }, [flushPendingNow]);

    const wasConnectedRef = useRef(isConnected);
    useEffect(() => {
        const wasOffline = !wasConnectedRef.current;
        wasConnectedRef.current = isConnected;
        if (isConnected && wasOffline) flushPendingNow();
    }, [flushPendingNow, isConnected]);

    // Flush pending save on unmount — иначе изменение, сделанное за <2 сек до ухода
    // со страницы, теряется (debounce-таймер просто очищался). Делаем state-free
    // запрос, чтобы не дёргать setState на размонтированном компоненте. Если он
    // упадёт (офлайн), прогресс всё равно не теряется: локальная копия в
    // AsyncStorage дольёт его на сервер при следующем открытии квеста
    // (см. useQuestWizardProgress).
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
            const data = pendingDataRef.current;
            const pendingQuestId = questIdRef.current;
            if (!data || !isAuthenticatedRef.current || !pendingQuestId) return;
            if (!progressIdRef.current && !hasQuestProgressStarted(data)) return;
            void pushMergedProgress(pendingQuestId, data).catch((err) => {
                devWarn('Could not flush quest progress on unmount:', err);
            });
        };
    }, []);

    // Сохранение прогресса на сервер (с дебаунсом 2 сек)
    const saveProgress = useCallback((data: PendingQuestProgressData) => {
        if (!isAuthenticated) return;

        // Ставим в очередь даже до получения progress id: если чтение прогресса
        // ещё в полёте, ответ игрока не должен пропасть — флаш уйдёт, как только
        // id появится (см. загрузку прогресса выше).
        pendingDataRef.current = data;
        // Пока прохождение не начато, ждём первого действия: строка на сервере
        // создаётся первым же значимым снапшотом, а не открытием экрана (#1803).
        if (!progressIdRef.current && !hasQuestProgressStarted(data)) return;

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
        clearRetryTimer();
        retryAttemptRef.current = 0;
        flushQueuedRef.current = false;
        pendingDataRef.current = null;

        if (!isAuthenticated || !progressIdRef.current) return;
        try {
            await apiDeleteProgress(progressIdRef.current);
            setProgress(null);
            progressIdRef.current = null;
        } catch (err) {
            console.warn('Could not delete quest progress from server:', err);
        }
    }, [clearRetryTimer, isAuthenticated]);

    return { progress, progressLoading, syncing, saveProgress, resetProgress };
}
