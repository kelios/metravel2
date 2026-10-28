// Explicit cleanup avoids auto-cleanup's setImmediate polyfill waiting on fake timeout 0.
import { act, cleanup, renderHook } from '@testing-library/react-native/pure';
import { Platform } from 'react-native';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { useQuestCatalogSearchAnalytics } from '@/screens/tabs/useQuestCatalogSearchAnalytics';
import { useQuestCatalogSearchQuery } from '@/screens/tabs/useQuestCatalogSearchQuery';

jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn().mockResolvedValue(undefined) }));

const originalPlatform = Platform.OS;
const initial = {
    query: ' Минск ',
    appliedSearchTerm: 'минск',
    resultsCount: 17,
    ready: true,
    focused: true,
};
const advance = async (ms = 900) => act(() => { jest.advanceTimersByTime(ms); });

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'web';
});
afterEach(async () => {
    try {
        await cleanup();
    } finally {
        jest.useRealTimers();
        (Platform as { OS: string }).OS = originalPlatform;
    }
});

it('keeps input immediate and records only after normalized matching and the analytics pause', async () => {
    const { result } = await renderHook(() => {
        const search = useQuestCatalogSearchQuery();
        useQuestCatalogSearchAnalytics({
            query: search.searchQuery,
            appliedSearchTerm: search.searchTerm,
            resultsCount: search.searchTerm === 'минск' ? 17 : 0,
            ready: true,
            focused: true,
        });
        return search;
    });

    await act(() => result.current.setSearchQuery(' Минск '));
    expect(result.current.searchQuery).toBe(' Минск ');
    expect(result.current.searchTerm).toBe('');
    await advance(200);
    expect(result.current.searchTerm).toBe('минск');
    await advance(899);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    await advance(1);
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('quest_search', {
        source: 'quest_catalog', search_term: 'минск', results_count: 17,
    });
});

it('records the settled normalized query and its full result count once', async () => {
    const { rerender } = await renderHook(useQuestCatalogSearchAnalytics, { initialProps: initial });
    await advance(899);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    await advance(1);
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('quest_search', {
        source: 'quest_catalog', search_term: 'минск', results_count: 17,
    });
    await rerender({ ...initial, resultsCount: 18 });
    await advance(2000);
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1);
});

it('cancels unfinished typing and waits for the new query results', async () => {
    const { rerender } = await renderHook(useQuestCatalogSearchAnalytics, {
        initialProps: { ...initial, query: 'ми', appliedSearchTerm: 'ми' },
    });
    await advance(600);
    await rerender({ ...initial, query: 'минск', appliedSearchTerm: 'ми' });
    await advance(2000);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    await rerender({ ...initial, query: 'минск', resultsCount: 7 });
    await advance();
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(sendAnalyticsEvent).toHaveBeenLastCalledWith('quest_search', {
        source: 'quest_catalog', search_term: 'минск', results_count: 7,
    });
});

it('records zero results and permits a new search after clearing', async () => {
    const props = { ...initial, query: 'Atlantis', appliedSearchTerm: 'atlantis', resultsCount: 0 };
    const { rerender } = await renderHook(useQuestCatalogSearchAnalytics, { initialProps: props });
    await advance();
    expect(sendAnalyticsEvent).toHaveBeenLastCalledWith('quest_search', {
        source: 'quest_catalog', search_term: 'atlantis', results_count: 0,
    });
    await rerender({ ...props, query: '' });
    await advance();
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1);
    await rerender(props);
    await advance();
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(2);
});

it('waits for ready data and cancels pending work on lost readiness or focus', async () => {
    const { rerender } = await renderHook(useQuestCatalogSearchAnalytics, {
        initialProps: { ...initial, ready: false },
    });
    await advance(2000);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    await rerender(initial);
    await advance(500);
    await rerender({ ...initial, focused: false });
    await advance(2000);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    await rerender(initial);
    await advance(500);
    await rerender({ ...initial, ready: false });
    await advance(2000);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    await rerender(initial);
    await advance();
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1);
});

it('cancels the timer when unmounted', async () => {
    const { unmount } = await renderHook(useQuestCatalogSearchAnalytics, { initialProps: initial });
    await advance(500);
    await unmount();
    await advance();
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
});

it.each(['', ' ', 'м', 'a'.repeat(101), 'julia@example.com', 'https://example.com', 'www.example.com', '+48 (123) 456-789'])(
    'does not record non-search input %s', async (query) => {
        await renderHook(useQuestCatalogSearchAnalytics, {
            initialProps: { ...initial, query, appliedSearchTerm: query.trim().toLowerCase() },
        });
        await advance(2000);
        expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    },
);

it.each(['Кракаў', 'Київ', 'Łódź', 'London', 'Минск 1941-1945'])(
    'preserves search language and ordinary history titles: %s', async (query) => {
        await renderHook(useQuestCatalogSearchAnalytics, {
            initialProps: { ...initial, query, appliedSearchTerm: query.toLowerCase() },
        });
        await advance();
        expect(sendAnalyticsEvent).toHaveBeenCalledWith('quest_search', expect.objectContaining({
            search_term: query.toLowerCase(),
        }));
    },
);

it.each(['android', 'ios'])('keeps %s provider analytics disabled', async (platform) => {
    (Platform as { OS: string }).OS = platform;
    await renderHook(useQuestCatalogSearchAnalytics, { initialProps: initial });
    await advance(2000);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
});
