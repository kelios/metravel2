// s39-B: движки поиска (#3239) и порядка (#3228) каталога живут за async-границей
// (`utils/questCatalogRuntime`), чтобы `__shared:quests-catalog` оставался в бюджете.
// Первый кадр рисуется синхронным act до прихода чанка — так проверяется окно,
// в котором движка ещё нет, и повтор загрузки после сбоя.
import fs from 'fs';
import path from 'path';

import type { QuestMeta } from '@/utils/questAdapters';

jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn().mockResolvedValue(undefined) }));

const RealDateTimeFormat = Intl.DateTimeFormat;
// setup.ts восстанавливает шпионов после каждого теста — ставим заново.
const mockDeviceTimeZone = () => jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(((...args: ConstructorParameters<typeof Intl.DateTimeFormat>) => {
    const real = new RealDateTimeFormat(...args);
    return Object.assign(Object.create(real), {
        resolvedOptions: () => ({ ...real.resolvedOptions(), timeZone: 'Europe/Minsk' }),
    });
}) as unknown as typeof Intl.DateTimeFormat);

type Engines = typeof import('@/screens/tabs/useQuestCatalogEngines');

const quest = (id: string, countryCode: string, lat: number, lng: number, title = id) =>
    ({ id, numericId: 1, title, cityId: id, cityName: title, countryCode, lat, lng, tags: [] }) as unknown as QuestMeta;
const quests = [quest('krakow', 'PL', 50.06, 19.94, 'Kraków'), quest('minsk', 'BY', 53.9, 27.56, 'Минск')];
const ids = (list: QuestMeta[] | undefined) => (list ?? []).map((item) => item.id);
const orderProps = {
    quests,
    sortOrder: 'default' as const,
    distanceOrdered: false,
    searchApproximate: false,
    placeSelected: false,
    userLoc: null,
    ready: true,
};

/**
 * Свежий модуль хуков: его загрузка движка ещё не разрешилась. `failures` —
 * сколько первых загрузок чанка движков падает.
 */
function mountFresh<R>(useProbe: (engines: Engines) => R, failures = 0) {
    jest.resetModules();
    let attempts = 0;
    jest.doMock('@/utils/questCatalogRuntime', () => {
        attempts += 1;
        if (attempts <= failures) throw new Error('chunk load failed');
        return jest.requireActual('@/utils/questCatalogRuntime');
    });
    const React = require('react') as typeof import('react');
    const { createRoot } = require('react-dom/client') as typeof import('react-dom/client');
    const analytics = require('@/utils/analytics') as { sendAnalyticsEvent: jest.Mock };
    const engines = require('@/screens/tabs/useQuestCatalogEngines') as Engines;
    const seen: R[] = [];
    function Probe() {
        seen.push(useProbe(engines));
        return null;
    }
    const root = createRoot(document.createElement('div'));
    React.act(() => root.render(React.createElement(Probe)));
    const settle = async (ms = 0) => {
        await React.act(async () => {
            await jest.advanceTimersByTimeAsync(ms);
        });
    };
    return {
        seen,
        last: () => seen[seen.length - 1],
        settle,
        attempts: () => attempts,
        rerender: () => React.act(() => root.render(React.createElement(Probe))),
        sendAnalyticsEvent: analytics.sendAnalyticsEvent,
        unmount: () => React.act(() => root.unmount()),
    };
}

beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
    // Поддельные таймеры подменяют и `Intl` — пояс подставляем после них.
    jest.useFakeTimers();
    mockDeviceTimeZone();
});
afterEach(() => {
    jest.useRealTimers();
});

describe('порядок каталога (#3228)', () => {
    it('движок, пришедший после гидратации, ставит страну посетителя первой', async () => {
        const probe = mountFresh((engines) => engines.useQuestCatalogOrder(orderProps));
        // Движка ещё нет: выдача и признак честно в порядке каталога.
        expect(ids(probe.seen[0].visibleQuests)).toEqual(['krakow', 'minsk']);
        expect(probe.seen[0].order).toBe('default');

        await probe.settle();
        expect(ids(probe.last().visibleQuests)).toEqual(['minsk', 'krakow']);
        expect(probe.last().order).toBe('visitor_timezone');

        probe.last().handleQuestOpen('minsk', 0);
        expect(probe.sendAnalyticsEvent).toHaveBeenCalledTimes(1);
        expect(probe.sendAnalyticsEvent).toHaveBeenCalledWith('quest_catalog_card_click', {
            quest_id: 'minsk', position: 0, catalog_order: 'visitor_timezone',
        });
        probe.unmount();
    });

    it('сбой загрузки движка повторяется, а не оставляет порядок каталога навсегда', async () => {
        const probe = mountFresh((engines) => engines.useQuestCatalogOrder(orderProps), 2);
        await probe.settle();
        expect(probe.last().order).toBe('default');

        await probe.settle(1000);
        await probe.settle(2000);
        expect(probe.attempts()).toBe(3);
        expect(ids(probe.last().visibleQuests)).toEqual(['minsk', 'krakow']);
        expect(probe.last().order).toBe('visitor_timezone');
        probe.unmount();
    });

    it('до гидратации пояс не применяется', async () => {
        const probe = mountFresh((engines) => engines.useQuestCatalogOrder({ ...orderProps, ready: false }));
        await probe.settle();
        expect(ids(probe.last().visibleQuests)).toEqual(['krakow', 'minsk']);
        expect(probe.last().order).toBe('default');
        probe.unmount();
    });
});

describe('поиск каталога (#3239)', () => {
    it('пока движок грузится — выдача в ожидании, а не «ничего не найдено»', async () => {
        const probe = mountFresh((engines) => engines.useQuestCatalogSearchResult(quests, {}, 'краков', true));
        expect(probe.seen[0]).toEqual({ quests: [], approximate: false, pending: true });

        await probe.settle();
        expect(probe.last()?.pending).toBe(false);
        expect(ids(probe.last()?.quests)).toEqual(['krakow']);
        probe.unmount();
    });

    it('после сбоя загрузки ожидание снимает повтор', async () => {
        const probe = mountFresh((engines) => engines.useQuestCatalogSearchResult(quests, {}, 'краков', true), 1);
        await probe.settle();
        expect(probe.last()?.pending).toBe(true);

        await probe.settle(1000);
        expect(probe.last()?.pending).toBe(false);
        expect(ids(probe.last()?.quests)).toEqual(['krakow']);
        probe.unmount();
    });

    it('исчерпанный ряд повторов начинается заново со следующим запросом', async () => {
        let term = 'краков';
        const probe = mountFresh((engines) => engines.useQuestCatalogSearchResult(quests, {}, term, true), 4);
        await probe.settle(1000);
        await probe.settle(2000);
        await probe.settle(4000);
        expect(probe.attempts()).toBe(4);
        expect(probe.last()?.pending).toBe(true);

        term = 'минск';
        probe.rerender();
        await probe.settle();
        expect(probe.attempts()).toBe(5);
        expect(ids(probe.last()?.quests)).toEqual(['minsk']);
        probe.unmount();
    });

    it('без запроса поиск не активен', () => {
        const probe = mountFresh((engines) => engines.useQuestCatalogSearchResult(quests, {}, '', true));
        expect(probe.seen[0]).toBeNull();
        probe.unmount();
    });
});

describe('async-границы стартового чанка каталога', () => {
    const root = path.resolve(__dirname, '..', '..');
    const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
    const valueImports = (source: string) =>
        [...source.matchAll(/^import\s+(?!type\s)[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((match) => match[1]);

    it.each([
        'screens/tabs/QuestsScreen.tsx',
        'screens/tabs/useQuestCatalogEngines.ts',
        'screens/tabs/useQuestCatalogSearchQuery.ts',
        'screens/tabs/QuestsContentPanel.tsx',
    ])('%s не импортирует движки поиска и порядка синхронно', (file) => {
        expect(valueImports(read(file)).filter((spec) => /questCatalogSearch|questVisitorOrder|questCatalogRuntime/.test(spec)))
            .toEqual([]);
    });

    // Статический импорт границы делал catch-all её владельцем, и слияние чанков
    // переносило FAQ каталога в `__shared:quests-catalog` (+14 КБ).
    it('catch-all хаба не импортирует границу загрузчика каталога синхронно', () => {
        expect(valueImports(read('app/[...missing].web.tsx')).filter((spec) => /QuestDiscoveryLoaderBoundary/.test(spec)))
            .toEqual([]);
    });
});
