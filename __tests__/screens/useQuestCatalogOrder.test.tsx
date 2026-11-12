// #3228: порядок выдачи каталога и признак порядка в клике по карточке.
import { cleanup, renderHook } from '@testing-library/react-native/pure';

import { sendAnalyticsEvent } from '@/utils/analytics';
import { useQuestCatalogOrder } from '@/screens/tabs/useQuestCatalogOrder';
import type { QuestMeta } from '@/utils/questAdapters';

jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn().mockResolvedValue(undefined) }));

let mockTimeZone: string | null = 'Europe/Minsk';
jest.mock('@/utils/questVisitorOrder', () => ({
    ...jest.requireActual('@/utils/questVisitorOrder'),
    readDeviceTimeZone: () => mockTimeZone,
}));

const quest = (id: string, countryCode: string, lat: number, lng: number, completionsCount = 0) =>
    ({ id, numericId: 1, countryCode, lat, lng, completionsCount, viewsCount: 0, ratingAvg: null, ratingCount: 0 }) as unknown as QuestMeta;

const krakow = quest('krakow', 'PL', 50.06, 19.94, 9);
const minsk = quest('minsk', 'BY', 53.9, 27.56, 1);
const grodno = quest('grodno', 'BY', 53.68, 23.83, 3);
const quests = [krakow, minsk, grodno];
const base = {
    quests,
    sortOrder: 'default' as const,
    distanceOrdered: false,
    searchApproximate: false,
    placeSelected: false,
    userLoc: null,
    ready: true,
};
const ids = (list: QuestMeta[]) => list.map((item) => item.id);

beforeEach(() => {
    mockTimeZone = 'Europe/Minsk';
    jest.clearAllMocks();
});
afterEach(async () => {
    await cleanup();
});

it('белорусский гость получает свою страну первой и признак visitor_timezone в клике', async () => {
    const { result } = await renderHook(useQuestCatalogOrder, { initialProps: base });
    expect(ids(result.current.visibleQuests)).toEqual(['minsk', 'grodno', 'krakow']);
    expect(result.current.order).toBe('visitor_timezone');

    result.current.handleQuestOpen('minsk', 0);
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('quest_catalog_card_click', {
        quest_id: 'minsk', position: 0, catalog_order: 'visitor_timezone',
    });
});

it('без сигнала порядок каталога прежний', async () => {
    mockTimeZone = 'America/Bogota';
    const { result } = await renderHook(useQuestCatalogOrder, { initialProps: base });
    expect(result.current.visibleQuests).toBe(quests);
    expect(result.current.order).toBe('default');
});

it('до гидратации пояс не применяется', async () => {
    const { result } = await renderHook(useQuestCatalogOrder, { initialProps: { ...base, ready: false } });
    expect(result.current.visibleQuests).toBe(quests);
});

it('выбранная сортировка важнее места посетителя', async () => {
    const { result } = await renderHook(useQuestCatalogOrder, { initialProps: { ...base, sortOrder: 'popular' as const } });
    expect(ids(result.current.visibleQuests)).toEqual(['krakow', 'grodno', 'minsk']);
    expect(result.current.order).toBe('popular');
});

it.each([
    ['distanceOrdered', 'distance'],
    ['searchApproximate', 'search_similarity'],
    ['placeSelected', 'default'],
] as const)('%s оставляет порядок выдачи как есть (%s)', async (flag, order) => {
    const { result } = await renderHook(useQuestCatalogOrder, { initialProps: { ...base, [flag]: true } });
    expect(result.current.visibleQuests).toBe(quests);
    expect(result.current.order).toBe(order);
});

it('известная позиция посетителя даёт порядок по расстоянию', async () => {
    const { result } = await renderHook(useQuestCatalogOrder, {
        initialProps: { ...base, userLoc: { lat: 53.68, lng: 23.83 } },
    });
    expect(ids(result.current.visibleQuests)).toEqual(['grodno', 'minsk', 'krakow']);
    expect(result.current.order).toBe('visitor_location');
});
