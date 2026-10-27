// Explicit cleanup avoids auto-cleanup's setImmediate polyfill waiting on fake timeout 0.
import { act, cleanupAsync, renderHook } from '@testing-library/react-native/pure';
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
const advance = (ms = 900) => act(() => { jest.advanceTimersByTime(ms); });

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'web';
});
afterEach(async () => {
    try {
        await cleanupAsync();
    } finally {
        jest.useRealTimers();
        (Platform as { OS: string }).OS = originalPlatform;
    }
});

it('keeps input immediate and records only after normalized matching and the analytics pause', () => {
    const { result } = renderHook(() => {
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

    act(() => result.current.setSearchQuery(' Минск '));
    expect(result.current.searchQuery).toBe(' Минск ');
    expect(result.current.searchTerm).toBe('');
    advance(200);
    expect(result.current.searchTerm).toBe('минск');
    advance(899);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    advance(1);
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('quest_search', {
        source: 'quest_catalog', search_term: 'минск', results_count: 17,
    });
});

it('records the settled normalized query and its full result count once', () => {
    const { rerender } = renderHook(useQuestCatalogSearchAnalytics, { initialProps: initial });
    advance(899);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    advance(1);
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('quest_search', {
        source: 'quest_catalog', search_term: 'минск', results_count: 17,
    });
    rerender({ ...initial, resultsCount: 18 });
    advance(2000);
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1);
});

it('cancels unfinished typing and waits for the new query results', () => {
    const { rerender } = renderHook(useQuestCatalogSearchAnalytics, {
        initialProps: { ...initial, query: 'ми', appliedSearchTerm: 'ми' },
    });
    advance(600);
    rerender({ ...initial, query: 'минск', appliedSearchTerm: 'ми' });
    advance(2000);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    rerender({ ...initial, query: 'минск', resultsCount: 7 });
    advance();
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(sendAnalyticsEvent).toHaveBeenLastCalledWith('quest_search', {
        source: 'quest_catalog', search_term: 'минск', results_count: 7,
    });
});

it('records zero results and permits a new search after clearing', () => {
    const props = { ...initial, query: 'Atlantis', appliedSearchTerm: 'atlantis', resultsCount: 0 };
    const { rerender } = renderHook(useQuestCatalogSearchAnalytics, { initialProps: props });
    advance();
    expect(sendAnalyticsEvent).toHaveBeenLastCalledWith('quest_search', {
        source: 'quest_catalog', search_term: 'atlantis', results_count: 0,
    });
    rerender({ ...props, query: '' });
    advance();
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1);
    rerender(props);
    advance();
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(2);
});

it('waits for ready data and cancels pending work on lost readiness or focus', () => {
    const { rerender } = renderHook(useQuestCatalogSearchAnalytics, {
        initialProps: { ...initial, ready: false },
    });
    advance(2000);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    rerender(initial);
    advance(500);
    rerender({ ...initial, focused: false });
    advance(2000);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    rerender(initial);
    advance(500);
    rerender({ ...initial, ready: false });
    advance(2000);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    rerender(initial);
    advance();
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1);
});

it('cancels the timer when unmounted', () => {
    const { unmount } = renderHook(useQuestCatalogSearchAnalytics, { initialProps: initial });
    advance(500);
    unmount();
    advance();
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
});

it.each(['', ' ', 'м', 'a'.repeat(101), 'julia@example.com', 'https://example.com', 'www.example.com', '+48 (123) 456-789'])(
    'does not record non-search input %s', (query) => {
        renderHook(useQuestCatalogSearchAnalytics, {
            initialProps: { ...initial, query, appliedSearchTerm: query.trim().toLowerCase() },
        });
        advance(2000);
        expect(sendAnalyticsEvent).not.toHaveBeenCalled();
    },
);

it.each(['Кракаў', 'Київ', 'Łódź', 'London', 'Минск 1941-1945'])(
    'preserves search language and ordinary history titles: %s', (query) => {
        renderHook(useQuestCatalogSearchAnalytics, {
            initialProps: { ...initial, query, appliedSearchTerm: query.toLowerCase() },
        });
        advance();
        expect(sendAnalyticsEvent).toHaveBeenCalledWith('quest_search', expect.objectContaining({
            search_term: query.toLowerCase(),
        }));
    },
);

it.each(['android', 'ios'])('keeps %s provider analytics disabled', (platform) => {
    (Platform as { OS: string }).OS = platform;
    renderHook(useQuestCatalogSearchAnalytics, { initialProps: initial });
    advance(2000);
    expect(sendAnalyticsEvent).not.toHaveBeenCalled();
});
