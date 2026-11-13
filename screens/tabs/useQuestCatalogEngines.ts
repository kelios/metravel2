// Поиск (#3239) и порядок по месту посетителя (#3228) каталога квестов.
// Их движки (`utils/questCatalogRuntime`) живут за async-границей: оба работают
// только после гидратации, а в стартовом чанке каталога давали +7,8 КБ сверх
// бюджета `__shared:quests-catalog` (s39-B). Здесь — хуки поверх них и замер
// поиска, который читает признаки той же выдачи.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { sendAnalyticsEvent } from '@/utils/analytics';
import { isAnalyticsSearchTerm } from '@/utils/analyticsSearchTerm';
import { sortQuestsByPopularity } from '@/utils/questPopularity';
import { sortQuestsByRating } from '@/utils/questRatingOrder';
import type { QuestCatalogSearchResult } from '@/utils/questCatalogSearch';
import type { QuestCatalogOrderKind } from '@/utils/questVisitorOrder';
import type { QuestMeta, QuestSortOrder } from './questsShared';

type QuestCatalogRuntime = typeof import('@/utils/questCatalogRuntime');

// Сбой загрузки чанка повторяется сам: 1, 2, 4 с. Исчерпанный ряд начинает
// новый на следующем действии посетителя (запрос поиска, смена выдачи).
const RUNTIME_RETRY_DELAYS_MS = [1000, 2000, 4000];

let loadedRuntime: QuestCatalogRuntime | null = null;
let pendingRuntime: Promise<QuestCatalogRuntime> | null = null;

function importQuestCatalogRuntime(attempt = 0): Promise<QuestCatalogRuntime> {
    return Promise.resolve().then(() => import('@/utils/questCatalogRuntime')).catch((error: unknown) => {
        const delay = RUNTIME_RETRY_DELAYS_MS[attempt];
        if (delay === undefined) throw error;
        return new Promise<QuestCatalogRuntime>((resolve) => setTimeout(resolve, delay))
            .then(() => importQuestCatalogRuntime(attempt + 1));
    });
}

function loadQuestCatalogRuntime(): Promise<QuestCatalogRuntime> {
    pendingRuntime ??= importQuestCatalogRuntime().then(
        (runtime) => (loadedRuntime = runtime),
        (error: unknown) => {
            pendingRuntime = null;
            throw error;
        },
    );
    return pendingRuntime;
}

// Запрос стартует вместе с исполнением каталога, параллельно гидратации.
// Серверу движки не нужны — до гидратации каталог не ищет и не переупорядочивает.
if (typeof window !== 'undefined') loadQuestCatalogRuntime().catch(() => undefined);

/**
 * Движки; `null`, пока чанк не пришёл. Чанк, пришедший по чужому запросу,
 * подхватывается на ближайшем рендере; смена `retryKey` после исчерпанного
 * ряда повторов начинает новый.
 */
function useQuestCatalogRuntime(retryKey: unknown): QuestCatalogRuntime | null {
    const [runtime, setRuntime] = useState(loadedRuntime);
    useEffect(() => {
        if (runtime) return undefined;
        let active = true;
        loadQuestCatalogRuntime().then((loaded) => active && setRuntime(loaded), () => undefined);
        return () => {
            active = false;
        };
    }, [runtime, retryKey]);
    return runtime ?? loadedRuntime;
}

/** Часовой пояс устройства (IANA) — синхронно, без чанка движков; без `Intl` — `null`. */
const readDeviceTimeZone = (): string | null => globalThis.Intl?.DateTimeFormat?.().resolvedOptions().timeZone || null;

/** `pending` — движок поиска ещё грузится: выдачи нет, но и «ничего не найдено» нет. */
export type QuestCatalogSearchView<T extends QuestMeta> = QuestCatalogSearchResult<T> & { pending: boolean };

/** Поисковая выдача по всему каталогу (#3239); `null` — поиск не активен. */
export function useQuestCatalogSearchResult<T extends QuestMeta>(
    quests: T[],
    canonicalCityIdById: Record<string, string>,
    searchTerm: string,
    ready: boolean,
): QuestCatalogSearchView<T> | null {
    const runtime = useQuestCatalogRuntime(searchTerm);
    // Индекс строится один раз на каталог, а не на каждый символ запроса.
    const search = useMemo(
        () => runtime?.createQuestCatalogSearch(quests, canonicalCityIdById),
        [runtime, quests, canonicalCityIdById],
    );
    return useMemo(() => {
        if (!ready || !searchTerm) return null;
        return search ? { ...search(searchTerm), pending: false } : { quests: [], approximate: false, pending: true };
    }, [ready, searchTerm, search]);
}

type SearchAnalyticsOptions = {
    query: string;
    appliedSearchTerm: string;
    resultsCount: number;
    /** #3239: выдача — ближайшие по написанию квесты, а не точные совпадения. */
    approximate: boolean;
    ready: boolean;
    focused: boolean;
};

/** Measures a settled search against its own results, before grid pagination. */
export function useQuestCatalogSearchAnalytics({
    query,
    appliedSearchTerm,
    resultsCount,
    approximate,
    ready,
    focused,
}: SearchAnalyticsOptions) {
    const lastTrackedTerm = useRef<string | null>(null);
    const term = query.trim().toLowerCase();

    useEffect(() => {
        if (!term) lastTrackedTerm.current = null;
        if (Platform.OS !== 'web' || !ready || !focused || !isAnalyticsSearchTerm(term)
            || term !== appliedSearchTerm || term === lastTrackedTerm.current) return;

        const timer = setTimeout(() => {
            lastTrackedTerm.current = term;
            void sendAnalyticsEvent('quest_search', {
                source: 'quest_catalog',
                search_term: term,
                results_count: resultsCount,
                match_mode: approximate ? 'approximate' : 'exact',
            });
        }, 900);
        return () => clearTimeout(timer);
    }, [term, appliedSearchTerm, resultsCount, approximate, ready, focused]);
}

type OrderOptions<T extends QuestMeta> = {
    quests: T[];
    sortOrder: QuestSortOrder;
    /** «Рядом» с координатой или область карты: порядок уже задан расстоянием. */
    distanceOrdered: boolean;
    /** Выдача нечёткого поиска упорядочена по близости написания (#3239). */
    searchApproximate: boolean;
    /** Выбран один город или одна страна: страна посетителя ничего не меняет. */
    placeSelected: boolean;
    userLoc: { lat: number; lng: number } | null;
    /** До гидратации пояс сервера не должен попасть в порядок. */
    ready: boolean;
};

/**
 * Порядок выдачи каталога и его признак для аналитики (#3228). Выбранная
 * посетителем сортировка важнее места; без сигнала места порядок прежний.
 */
export function useQuestCatalogOrder<T extends QuestMeta>({
    quests,
    sortOrder,
    distanceOrdered,
    searchApproximate,
    placeSelected,
    userLoc,
    ready,
}: OrderOptions<T>) {
    // Повтор загрузки движка — при смене выдачи (город, фильтр, сортировка).
    const runtime = useQuestCatalogRuntime(quests);
    // Пояс читается синхронно; сортировка по нему — как только придёт движок.
    const timeZone = useMemo(() => (ready ? readDeviceTimeZone() : null), [ready]);
    const visitor = useMemo(
        () => (ready && runtime && sortOrder === 'default' && !distanceOrdered && !searchApproximate && !placeSelected
            ? runtime.orderQuestsByVisitor(quests, userLoc, timeZone)
            : null),
        [ready, runtime, sortOrder, distanceOrdered, searchApproximate, placeSelected, quests, userLoc, timeZone],
    );

    const order: QuestCatalogOrderKind = sortOrder === 'popular' || sortOrder === 'rating'
        ? sortOrder
        : distanceOrdered
            ? 'distance'
            : searchApproximate
                ? 'search_similarity'
                : visitor
                    ? visitor.source === 'location' ? 'visitor_location' : 'visitor_timezone'
                    : 'default';

    const visibleQuests = useMemo(() => {
        if (sortOrder === 'popular') return sortQuestsByPopularity(quests);
        if (sortOrder === 'rating') return sortQuestsByRating(quests);
        return visitor?.quests ?? quests;
    }, [quests, sortOrder, visitor]);

    // Клик по карточке (#3228): «клик / показ» по порядку выдачи. Согласие
    // проверяет сам sendAnalyticsEvent.
    const handleQuestOpen = useCallback((questId: string, position: number) => {
        void sendAnalyticsEvent('quest_catalog_card_click', { quest_id: questId, position, catalog_order: order });
    }, [order]);

    return { visibleQuests, order, handleQuestOpen };
}
