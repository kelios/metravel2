import { useCallback, useMemo } from 'react';

import { sortQuestsByPopularity } from '@/utils/questPopularity';
import { sortQuestsByRating } from '@/utils/questRatingOrder';
import { trackQuestCatalogCardClick } from '@/utils/questCatalogAnalytics';
import {
    readDeviceTimeZone,
    resolveQuestVisitorOrigin,
    sortQuestsByVisitorOrigin,
    type QuestCatalogOrderKind,
} from '@/utils/questVisitorOrder';
import type { QuestMeta, QuestSortOrder } from './questsShared';

type Options<T extends QuestMeta> = {
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
}: Options<T>) {
    const origin = useMemo(
        () => (ready ? resolveQuestVisitorOrigin(userLoc, readDeviceTimeZone()) : null),
        [ready, userLoc],
    );
    const visitorOrigin = distanceOrdered || searchApproximate || placeSelected ? null : origin;

    const order: QuestCatalogOrderKind = sortOrder === 'popular' || sortOrder === 'rating'
        ? sortOrder
        : distanceOrdered
            ? 'distance'
            : searchApproximate
                ? 'search_similarity'
                : visitorOrigin
                    ? visitorOrigin.source === 'location' ? 'visitor_location' : 'visitor_timezone'
                    : 'default';

    const visibleQuests = useMemo(() => {
        if (sortOrder === 'popular') return sortQuestsByPopularity(quests);
        if (sortOrder === 'rating') return sortQuestsByRating(quests);
        if (visitorOrigin) return sortQuestsByVisitorOrigin(quests, visitorOrigin);
        return quests;
    }, [quests, sortOrder, visitorOrigin]);

    const handleQuestOpen = useCallback((questId: string, position: number) => {
        trackQuestCatalogCardClick({ questId, position, order });
    }, [order]);

    return { visibleQuests, order, handleQuestOpen };
}
