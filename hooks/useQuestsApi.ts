// hooks/useQuestsApi.ts
// Хуки для работы с квестами через бэкенд API.
// Чистые адаптеры и типы вынесены в utils/questAdapters.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiQuestMeta, ApiQuestProgress, QuestReview } from '@/api/quests';
import {
    fetchQuestsByCity,
    fetchQuestsPreview,
    fetchQuestProgress,
    fetchQuestReviews,
} from '@/api/quests';
import { queryKeys } from '@/api/queryKeys';
import { writeCachedQuestBundle } from '@/api/questBundleCache';
import { useAuthStore } from '@/stores/authStore';
import { QUESTS_LIST_GC_TIME, QUESTS_LIST_STALE_TIME } from '@/hooks/questsListCachePolicy';
import { questsListQueryOptions } from '@/hooks/questsListQuery';
import { useQuestBundleQuery } from '@/hooks/questBundleQuery';
import { useHydrationReady } from '@/hooks/useHydrationReady';
import {
    adaptMeta,
    adaptBundle,
} from '@/utils/questAdapters';
import { selectPopularQuests } from '@/utils/questPopularity';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { hasQuestProgressStarted, QuestProgressLineageMismatch } from '@/utils/questProgressMerge';
import {
    deleteOrEnqueueQuestProgress,
    dequeueDeliveredQuestProgress,
    dequeueQuestProgress,
    deliverOrEnqueueQuestProgress,
    dropEndedQuestProgressRuns,
    enqueueQuestProgress,
    pushQuestProgressSnapshot,
    settleQuestProgressDeletions,
    syncCatalogCompletion,
} from '@/utils/questProgressQueue';
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
    /** Поколение: `id` строки, с которой снапшот согласован (#2033). На сервер не уходит. */
    serverId?: number;
};

/**
 * Отложенная отправка адресная: снапшот помнит квест, из которого собран.
 * Голый снапшот в очереди уезжал в PATCH следующего квеста, и тот получал чужие
 * ответы вместе с «Пройден» (#1906).
 */
type PendingQuestProgress = {
    questId: string;
    data: PendingQuestProgressData;
};

const getErrorMessage = (error: unknown, fallback: string): string =>
    error instanceof Error && typeof error.message === 'string' ? error.message : fallback;

// Полный список нужен каталогу и промо; metadata детали читается из bundle.
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

/** Хук для загрузки полного бандла квеста по quest_id */
export function useQuestBundle(questId: string | undefined) {
    const { data, isPending, isFetching, error, refetch } = useQuestBundleQuery(questId);
    // #1562/#418: маршрут по `loading` делает ранний return LoadingState, и на
    // кадре гидратации статического HTML визард (clientOnly-раскладка) не
    // должен монтироваться. `isPending` этого не гарантирует: посадочная города
    // (`useQuestCityWalk`) прогревает тот же ключ бандла, и на тёплом кэше
    // первый кадр уже нёс бы данные. Первый web-кадр держится «загрузкой»
    // явно; после гидратации и на native тёплый кэш отдаёт бандл сразу.
    const hydrationReady = useHydrationReady();
    const cityId = data?.city?.id;
    const { data: classification, isPending: classificationPending, isError: classificationFailed } = useQuery({
        queryKey: queryKeys.questCityClassification(cityId),
        queryFn: async () => (await fetchQuestsByCity(cityId!)).map((meta) => {
            const adapted = adaptMeta(meta);
            return { questId: meta.quest_id, tags: adapted.tags ?? [], cover: adapted.cover };
        }),
        enabled: Boolean(data && cityId && (data.tags === undefined || !data.cover_url)),
        networkMode: 'always',
        staleTime: QUESTS_LIST_STALE_TIME,
        gcTime: QUESTS_LIST_GC_TIME,
        retry: false,
    });

    // City notes can prefill the same raw query without persisting it. Opening
    // the route is what adds that quest to the offline catalog.
    useEffect(() => {
        if (questId && data) void writeCachedQuestBundle(questId, data);
    }, [questId, data]);

    const bundle = useMemo(() => {
        if (!data || !questId) return null;
        const adapted = adaptBundle(data);
        const meta = classification?.find((item) => item.questId === questId);
        adapted.tags = data.tags !== undefined
            ? Object.keys(data.tags ?? {})
            : meta?.tags ?? ((!classificationPending || classificationFailed || !cityId) ? [] : undefined);
        adapted.coverUrl ||= meta?.cover;
        return adapted;
    }, [data, questId, classification, classificationPending, classificationFailed, cityId]);

    return {
        bundle,
        // `isFetching && !data` — это повтор после ошибки: у запроса в статусе
        // error `isPending` уже false, и без этого слагаемого кнопка «Повторить»
        // на ErrorState до 60 с (LONG_TIMEOUT × 2 попытки) не давала бы никакой
        // обратной связи — до рефактора её давал setLoading(true) в refetch.
        loading: Boolean(questId) && (isPending || (isFetching && !data) || !hydrationReady),
        error: error ? getErrorMessage(error, i18nT('quests:hooks.useQuestsApi.kvest_ne_nayden_af9ac6a4')) : null,
        refetch,
    };
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

/** Хук для синхронизации прогресса квеста с бэкендом (для авторизованных) */
export function useQuestProgressSync(questId: string | undefined, isAuthenticated: boolean) {
    const [progress, setProgress] = useState<ApiQuestProgress | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [progressLoading, setProgressLoading] = useState(isAuthenticated && !!questId);
    // Сервер ПОДТВЕРДИЛ, что строки прохождения нет (#2033): чтение вернуло 404,
    // удаление прошло или отправка узнала о сбросе на другом устройстве.
    // Упавшее чтение подтверждением не является: по нему визард копию не стирает.
    const [progressMissing, setProgressMissing] = useState(false);
    const progressIdRef = useRef<number | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryAttemptRef = useRef(0);
    const inFlightRef = useRef(false);
    const flushQueuedRef = useRef(false);
    const mountedRef = useRef(true);
    const pendingDataRef = useRef<PendingQuestProgress | null>(null);
    // Владелец отложенного снапшота. Берётся, пока сессия жива: к моменту ухода
    // с квеста токена может уже не быть (#1921), а очереди нужно знать, в чьё
    // прохождение отправлять — чужому аккаунту отдавать нельзя (#1456).
    const progressOwnerIdRef = useRef<string | null>(null);
    // Ref пуст, пока в этом маунте не было сохранений: экран могли открыть
    // холодным и сразу нажать «Начать заново». Тогда владельца знает стор —
    // без этого отката запись осталась бы на диске и воскресила сброшенное.
    const ownerIdForQueue = useCallback(
        () => progressOwnerIdRef.current ?? useAuthStore.getState().userId ?? null,
        [],
    );
    // Сбросы по квестам за этот маунт. Флаш, стартовавший до «Сбросить», везёт
    // стёртое прохождение: его ответ не становится состоянием экрана, а снапшот
    // не возвращается ни в отложенные, ни в очередь на диске (#2043).
    const resetCountsRef = useRef<Record<string, number>>({});
    const isAuthenticatedRef = useRef(isAuthenticated);
    isAuthenticatedRef.current = isAuthenticated;
    // Актуальный questId для асинхронных веток: ответ запроса может прийти,
    // когда игрок уже на другом квесте.
    const questIdRef = useRef(questId);
    questIdRef.current = questId;
    // flushSync и планировщик ретраев ссылаются друг на друга: держим актуальный
    // флаш в ref, чтобы таймеры и слушатели не вызывали стейл-замыкание.
    const flushSyncRef = useRef<(() => Promise<void>) | null>(null);
    const { isConnected } = useNetworkStatus();
    const isConnectedRef = useRef(isConnected);
    isConnectedRef.current = isConnected;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Смена квеста в живой сессии: серверная запись предыдущего квеста обязана
    // исчезнуть из состояния ТЕМ ЖЕ рендером. Иначе экран отдаёт визарду
    // `initialProgress` прошлого квеста, тот засевает им новый и возвращает
    // чужие ответы обратно на сервер (#1906). Ссылки и очередь чистит эффект
    // прощания ниже — ему нужны прежние значения.
    const syncedQuestIdRef = useRef(questId);
    if (syncedQuestIdRef.current !== questId) {
        syncedQuestIdRef.current = questId;
        setProgress(null);
        setProgressMissing(false);
        setProgressLoading(isAuthenticated && !!questId);
    }

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
        // Новое чтение — прежнее «строки нет» больше не подтверждено: оно могло
        // принадлежать прошлому аккаунту, и упавшее чтение его не продлевает (#2033).
        setProgressMissing(false);
        const readOwnerId = useAuthStore.getState().userId ?? null;
        const resetCountAtRead = resetCountsRef.current[questId] ?? 0;
        // «Сбросить» без сети ещё не дошло до сервера: строка там — стёртое
        // прохождение, и визард слил бы с ним новое. Пока удаление не
        // подтверждено, состояние сервера неизвестно — как при упавшем чтении (#2043).
        settleQuestProgressDeletions(questId, readOwnerId)
            .then((settled) => (settled ? fetchQuestProgress(questId) : undefined))
            .then((data) => {
                // Ответ на чтение, отправленное до «Сбросить», описывает стёртое
                // прохождение: состояние экрана уже задал сам сброс (#2043).
                const resetDuringRead = (resetCountsRef.current[questId] ?? 0) !== resetCountAtRead;
                if (!cancelled && data !== undefined && !resetDuringRead) {
                    // #1803: пустое чтение не должно затирать то, что уже создал
                    // параллельный флаш. Иначе `resetProgress` молча пропускает
                    // серверный DELETE (он выходит на пустом `progressIdRef`), и
                    // «Начать заново» на сервере не срабатывает. Прошлый квест
                    // так уцелеть не может: его id снят при уходе с квеста
                    // (#1906), сохраняется только id этого же квеста.
                    if (data) setProgress(data);
                    progressIdRef.current = data?.id ?? progressIdRef.current ?? null;
                    const missing = !progressIdRef.current;
                    setProgressMissing(missing);
                    // Сервер подтвердил, что квест не пройден, а отметка «Пройден»
                    // в кэше этого устройства могла остаться от прохождения,
                    // сброшенного на другом (#2033).
                    if (missing || data?.completed === false) syncCatalogCompletion(questId, readOwnerId, false);
                    // Визард по этому же ответу стирает копию закончившегося
                    // поколения — её запись в очереди уходит тем же шагом (#2043).
                    void dropEndedQuestProgressRuns(questId, readOwnerId, progressIdRef.current);
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

        const pending = pendingDataRef.current;
        if (!pending || !isAuthenticatedRef.current || !questId) return;
        // Очередь адресная: снапшот другого квеста сюда попасть не должен, а
        // если попал — он уходит только своему квесту, не этому (#1906).
        if (pending.questId !== questId) return;
        const data = pending.data;
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
        const resetCountAtStart = resetCountsRef.current[questId] ?? 0;
        const resetSinceStart = () => (resetCountsRef.current[questId] ?? 0) !== resetCountAtStart;
        try {
            const updated = await pushQuestProgressSnapshot(questId, data);
            saved = true;
            // Строка стёртого прохождения экрану больше не принадлежит, а очередь
            // квеста теперь — нового прохождения.
            if (resetSinceStart()) return;
            // Снапшот доехал: запись очереди, которую покрывает ответ сервера,
            // больше не нужна. Непокрытая (упавшая миграция гостя, #2048) остаётся.
            void dequeueDeliveredQuestProgress(questId, updated, ownerIdForQueue());
            // Снимаем с очереди только то, что реально отправили: изменения,
            // сделанные во время запроса, остаются pending и уйдут своим флашем.
            if (pendingDataRef.current === pending) pendingDataRef.current = null;
            retryAttemptRef.current = 0;
            // Ответ мог прийти, когда игрок уже на другом квесте: ни id строки,
            // ни её содержимое текущему квесту не принадлежат (#1906).
            if (questIdRef.current === questId) {
                progressIdRef.current = updated.id;
                if (mountedRef.current) {
                    setProgress(updated);
                    setProgressMissing(false);
                }
            }
        } catch (err) {
            if (err instanceof QuestProgressLineageMismatch) {
                // Прохождение, из которого собран снапшот, сброшено на другом
                // устройстве (#2033). Доставлять его некуда: ни ретрая, ни очереди.
                // Отложенное того же поколения — туда же; снапшот, собранный уже
                // после сброса, остаётся и уйдёт своим флашем.
                const queued = pendingDataRef.current;
                if (queued && (queued === pending || queued.data.serverId === err.lineageId)) {
                    pendingDataRef.current = null;
                }
                void dequeueQuestProgress(questId, ownerIdForQueue(), err.lineageId);
                retryAttemptRef.current = 0;
                // Экран переходит на то, что есть на сервере: визард по этому
                // состоянию стирает копию закончившегося прохождения. После
                // «Сбросить» здесь стирать уже нечего, а копию нового — нельзя.
                if (questIdRef.current === questId && !resetSinceStart()) {
                    progressIdRef.current = err.current?.id ?? null;
                    if (mountedRef.current) {
                        setProgress(err.current);
                        setProgressMissing(!err.current);
                    }
                }
                return;
            }
            // Снапшот прохождения, стёртого «Сбросить», пока запрос летел, не
            // возвращается никуда: иначе он доехал бы следом за удалением.
            if (!resetSinceStart()) {
                // Вернуть в очередь можно только на своём квесте: на чужом снапшот
                // уже не отправится, а местом в очереди перекроет актуальный.
                // Потерянным он не будет — локальная копия дольёт его при следующем
                // открытии квеста (см. useQuestWizardProgress).
                if (!pendingDataRef.current && questIdRef.current === questId) pendingDataRef.current = pending;
                // Ретрай живёт в памяти экрана и умирает вместе с приложением —
                // поэтому снапшот сразу ложится в очередь на диске (#1922). Два
                // планировщика тут намеренно: экранный дожимает, пока игрок ещё на
                // квесте, дисковый переживает выгрузку. Дубля записи это не даёт —
                // оба идут через `withQuestProgress`, и второму нечего добавить.
                void enqueueQuestProgress(questId, data, ownerIdForQueue());
            }
            devWarn('Could not save quest progress to server, will retry:', err);
            if (questIdRef.current === questId) scheduleRetry();
        } finally {
            inFlightRef.current = false;
            if (mountedRef.current) setSyncing(false);
            const shouldFlushAgain = saved && flushQueuedRef.current && !!pendingDataRef.current;
            flushQueuedRef.current = false;
            if (shouldFlushAgain) void flushSyncRef.current?.();
        }
    }, [clearRetryTimer, ownerIdForQueue, questId, scheduleRetry]);
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

    // Прощание с квестом — размонтирование ИЛИ смена questId в живой сессии.
    // Оба случая одинаковы: квест закончился, и всё, что к нему привязано (id
    // строки, очередь, таймеры), обязано умереть вместе с ним. Пока этого не
    // было, id и очередь предыдущего квеста открывали гейт «прохождение ещё не
    // начато» и уезжали в PATCH следующего (#1906).
    // Отложенное при этом не теряется: изменение, сделанное за <2 сек до ухода,
    // уходит state-free запросом СВОЕМУ квесту. Если он упадёт (офлайн),
    // локальная копия в AsyncStorage дольёт прогресс при следующем открытии
    // квеста (см. useQuestWizardProgress).
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
            retryAttemptRef.current = 0;
            flushQueuedRef.current = false;
            const pending = pendingDataRef.current;
            const startedProgressId = progressIdRef.current;
            pendingDataRef.current = null;
            progressIdRef.current = null;
            if (!pending) return;
            if (!startedProgressId && !hasQuestProgressStarted(pending.data)) return;
            // Живая сессия — стор, не только проп: экран мог передать
            // `isFocused && isAuthenticated`, и уход выглядел как выход (#1973).
            // Без логина (#1921) или без сети — только очередь (#1922).
            const sessionAlive =
                isAuthenticatedRef.current || Boolean(useAuthStore.getState().isAuthenticated);
            if (!sessionAlive || !isConnectedRef.current) {
                void enqueueQuestProgress(pending.questId, pending.data, ownerIdForQueue());
                return;
            }
            // Флаш в полёте, а строки ещё нет: дубль ушёл бы вторым параллельным
            // POST и создал ВТОРОЕ прохождение (#1905). Когда строка уже есть,
            // повторный флаш безопасен — он идёт через GET и слияние.
            if (inFlightRef.current && !startedProgressId) {
                void enqueueQuestProgress(pending.questId, pending.data, ownerIdForQueue());
                return;
            }
            // Одна попытка отправки, и очередь на диске — если она не прошла.
            void deliverOrEnqueueQuestProgress(pending.questId, pending.data, ownerIdForQueue());
        };
        // `ownerIdForQueue` стабилен (useCallback без зависимостей) и эффект
        // прощания не перезапускает: он обязан срабатывать только на смене квеста.
    }, [ownerIdForQueue, questId]);

    // Сохранение прогресса на сервер (с дебаунсом 2 сек)
    const saveProgress = useCallback((data: PendingQuestProgressData) => {
        if (!isAuthenticated || !questId) return;

        // Ставим в очередь даже до получения progress id: если чтение прогресса
        // ещё в полёте, ответ игрока не должен пропасть — флаш уйдёт, как только
        // id появится (см. загрузку прогресса выше). Вместе со снапшотом кладём
        // его квест: отправить его другому нельзя (#1906).
        pendingDataRef.current = { questId, data };
        progressOwnerIdRef.current = useAuthStore.getState().userId ?? progressOwnerIdRef.current;
        // Пока прохождение не начато, ждём первого действия: строка на сервере
        // создаётся первым же значимым снапшотом, а не открытием экрана (#1803).
        if (!progressIdRef.current && !hasQuestProgressStarted(data)) return;

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            flushSync();
        }, PROGRESS_SYNC_DEBOUNCE_MS);
    }, [isAuthenticated, flushSync, questId]);

    // Сброс прогресса. `runServerId` — поколение копии, которую стёр визард:
    // экран, открытый без сети, свою строку не прочитал и знает её только от
    // визарда. `true` — сервер удаление ещё не подтвердил, и намерение ждёт
    // сети в очереди (#2043).
    const resetProgress = useCallback(async (runServerId = 0): Promise<boolean> => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        clearRetryTimer();
        retryAttemptRef.current = 0;
        flushQueuedRef.current = false;
        pendingDataRef.current = null;
        if (questId) resetCountsRef.current[questId] = (resetCountsRef.current[questId] ?? 0) + 1;
        // Очередь на диске переживает экран, поэтому «Начать заново» обязано
        // снять запись и с неё: иначе удалённое прохождение воскресло бы при
        // следующем пробуждении очереди.
        void dequeueQuestProgress(questId ?? '', ownerIdForQueue());

        const progressId = progressIdRef.current ?? (runServerId > 0 ? runServerId : null);
        if (!isAuthenticated || !questId || !progressId) return false;
        // Строку удаляет тот, чья сессия сейчас: владелец последнего сейва этого
        // маунта мог уже выйти, и в чужой сессии намерение не ушло бы никогда.
        const ownerId = useAuthStore.getState().userId ?? null;
        // Строка сброшенного прохождения больше не прохождение игрока, дошёл
        // DELETE или нет: ни флаш, ни визард её не получают (#2043).
        progressIdRef.current = null;
        setProgress(null);
        syncCatalogCompletion(questId, ownerId, false);
        const deleted = await deleteOrEnqueueQuestProgress(questId, progressId, ownerId);
        // DELETE мог дойти, когда игрок уже на другом квесте: «строки нет»
        // о нём неправда, и визард стёр бы копию живого прохождения (#1906, #2033).
        if (deleted && questIdRef.current === questId) setProgressMissing(true);
        return !deleted;
    }, [clearRetryTimer, isAuthenticated, ownerIdForQueue, questId]);

    return { progress, progressLoading, progressMissing, syncing, saveProgress, resetProgress };
}
