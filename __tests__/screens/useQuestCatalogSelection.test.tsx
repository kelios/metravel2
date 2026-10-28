import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { useQuestCatalogSelection } from '@/screens/tabs/useQuestCatalogSelection';
import { useQuestCatalogHandoff } from '@/screens/tabs/useQuestCatalogHandoff';
import { ALL_QUESTS_ID, STORAGE_PENDING_CATALOG_SELECTION, STORAGE_SELECTED_CITY } from '@/utils/questCatalogSelection';

let mockParams: { theme?: string | string[] } = {};
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
const originalGetItem = (AsyncStorage.getItem as jest.Mock).getMockImplementation();
const deferred = () => {
    let resolve!: (value: string | null) => void;
    const promise = new Promise<string | null>((done) => { resolve = done; });
    return { promise, resolve };
};
beforeEach(async () => {
    mockParams = {};
    (AsyncStorage.getItem as jest.Mock).mockImplementation(originalGetItem);
    await AsyncStorage.clear();
    jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());

it('keeps the first web render neutral before committing explicit URL intent without storage restore', async () => {
    const oldPlatform = Platform.OS;
    (Platform as { OS: string }).OS = 'web';
    try {
        mockParams = { theme: 'detective' };
        const renders: Array<{ id: string | null; restored: boolean }> = [];
        const { result } = await renderHook(() => {
            const selection = useQuestCatalogSelection(true, jest.fn());
            renders.push({ id: selection.selectedCityId, restored: selection.selectionRestored });
            return selection;
        });
        expect(renders[0]).toEqual({ id: ALL_QUESTS_ID, restored: false });
        await waitFor(() => expect(result.current.selectedCityId).toBe('__theme__:detective'));
        expect(result.current.selectionRestored).toBe(true);
        expect(AsyncStorage.getItem).not.toHaveBeenCalledWith(STORAGE_SELECTED_CITY);
    } finally {
        (Platform as { OS: string }).OS = oldPlatform;
    }
});

it.each(['android', 'ios'])('keeps native %s URL selection available on the first render', async (platform) => {
    const oldPlatform = Platform.OS;
    (Platform as { OS: string }).OS = platform;
    try {
        mockParams = { theme: 'detective' };
        const renders: Array<{ id: string | null; restored: boolean }> = [];
        await renderHook(() => {
            const selection = useQuestCatalogSelection(true, jest.fn());
            renders.push({ id: selection.selectedCityId, restored: selection.selectionRestored });
        });
        expect(renders[0]).toEqual({ id: '__theme__:detective', restored: true });
        expect(AsyncStorage.getItem).not.toHaveBeenCalledWith(STORAGE_SELECTED_CITY);
    } finally {
        (Platform as { OS: string }).OS = oldPlatform;
    }
});

it('initial explicit selection outranks storage and persists before any ordinary restore', async () => {
    mockParams = { theme: ' DeTECTive ' };
    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, 'minsk');
    const { result } = await renderHook(() => useQuestCatalogSelection(true, jest.fn()));
    expect(result.current.selectedCityId).toBe('__theme__:detective');
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(STORAGE_SELECTED_CITY, '__theme__:detective'));
    expect(AsyncStorage.getItem).not.toHaveBeenCalledWith(STORAGE_SELECTED_CITY);
});
it.each(['', 'unknown', ['detective', 'legends']])('explicit invalid %s intentionally clears saved city', async (theme) => {
    mockParams = { theme };
    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, 'minsk');
    const { result } = await renderHook(() => useQuestCatalogSelection(true, jest.fn()));
    expect(result.current.selectedCityId).toBe(ALL_QUESTS_ID);
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(STORAGE_SELECTED_CITY, ALL_QUESTS_ID));
});
it('late storage cannot replace a warm URL or its later Reset; unchanged query is not reapplied', async () => {
    const read = deferred();
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation((key) => key === STORAGE_SELECTED_CITY ? read.promise : Promise.resolve(null));
    const navigation = jest.fn();
    const { result, rerender } = await renderHook(() => useQuestCatalogSelection(true, navigation));
    mockParams = { theme: 'legends' };
    await rerender({});
    await waitFor(() => expect(result.current.selectedCityId).toBe('__theme__:legends'));
    await act(async () => { await result.current.select(ALL_QUESTS_ID); read.resolve('minsk'); });
    await rerender({});
    expect(result.current.selectedCityId).toBe(ALL_QUESTS_ID);
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(STORAGE_SELECTED_CITY, ALL_QUESTS_ID);
    expect(navigation).toHaveBeenCalledTimes(1);
    mockParams = { theme: 'detective' };
    await rerender({});
    await waitFor(() => expect(result.current.selectedCityId).toBe('__theme__:detective'));
});
it('no query preserves saved out-of-season selection', async () => {
    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, '__theme__:halloween');
    const { result } = await renderHook(() => useQuestCatalogSelection(true, jest.fn()));
    await waitFor(() => expect(result.current.selectedCityId).toBe('__theme__:halloween'));
});
it('manual selection before late ordinary restore remains authoritative', async () => {
    const read = deferred();
    jest.spyOn(AsyncStorage, 'getItem').mockReturnValue(read.promise);
    const { result } = await renderHook(() => useQuestCatalogSelection(true, jest.fn()));
    await act(async () => { await result.current.select('__country__:PL'); read.resolve('minsk'); });
    expect(result.current.selectedCityId).toBe('__country__:PL');
});
it('explicit entry consumes stale profile handoff, but a later profile focus intentionally applies', async () => {
    mockParams = { theme: 'detective' };
    await AsyncStorage.setItem(STORAGE_PENDING_CATALOG_SELECTION, '__completed__');
    const { result, rerender } = await renderHook(({ focused }) => {
        const selection = useQuestCatalogSelection(focused, jest.fn());
        useQuestCatalogHandoff({ enabled: focused, onApply: selection.select, getGeneration: selection.getGeneration, canApply: selection.canApplyHandoff });
        return selection;
    }, { initialProps: { focused: true } });
    await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_PENDING_CATALOG_SELECTION));
    expect(result.current.selectedCityId).toBe('__theme__:detective');
    await rerender({ focused: false });
    await AsyncStorage.setItem(STORAGE_PENDING_CATALOG_SELECTION, '__completed__');
    await rerender({ focused: true });
    await waitFor(() => expect(result.current.selectedCityId).toBe('__completed__'));
});
it('late profile read cannot override a newer URL navigation', async () => {
    const read = deferred();
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation((key) => key === STORAGE_PENDING_CATALOG_SELECTION ? read.promise : Promise.resolve(null));
    const { result, rerender } = await renderHook(() => {
        const selection = useQuestCatalogSelection(true, jest.fn());
        useQuestCatalogHandoff({ enabled: true, onApply: selection.select, getGeneration: selection.getGeneration, canApply: selection.canApplyHandoff });
        return selection;
    });
    mockParams = { theme: 'legends' };
    await rerender({});
    await act(async () => read.resolve('__completed__'));
    expect(result.current.selectedCityId).toBe('__theme__:legends');
});


it('an identical warm native link is a new action after Reset, while ordinary refocus is not', async () => {
    const oldPlatform = Platform.OS;
    (Platform as { OS: string }).OS = 'android';
    let receive!: (event: { url: string }) => void;
    jest.spyOn(Linking, 'addEventListener').mockImplementation((_type, listener) => {
        receive = listener;
        return { remove: jest.fn() };
    });
    mockParams = { theme: 'detective' };
    const { result, rerender, unmount } = await renderHook(({ focused }) => useQuestCatalogSelection(focused, jest.fn()), { initialProps: { focused: true } });
    await act(async () => { await result.current.select(ALL_QUESTS_ID); });
    await rerender({ focused: false });
    await rerender({ focused: true });
    expect(result.current.selectedCityId).toBe(ALL_QUESTS_ID);
    await act(async () => { receive({ url: 'metravel://quests?theme=detective' }); });
    expect(result.current.selectedCityId).toBe('__theme__:detective');
    await act(async () => { await result.current.select(ALL_QUESTS_ID); receive({ url: 'metravel://quests?theme=legends' }); });
    expect(result.current.selectedCityId).toBe('__theme__:legends');
    mockParams = { theme: 'legends' };
    await rerender({ focused: true });
    expect(result.current.selectedCityId).toBe('__theme__:legends');
    await unmount();
    (Platform as { OS: string }).OS = oldPlatform;
});

// #2654: `/quests/<city>` — каталог, чей срез принадлежит URL.
it('route mode shows the URL slice from the first render and never touches saved or handed-off selection', async () => {
    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, 'minsk');
    await AsyncStorage.setItem(STORAGE_PENDING_CATALOG_SELECTION, '__kids__');
    jest.clearAllMocks();
    const onLeave = jest.fn();
    const { result } = await renderHook(() => useQuestCatalogSelection(true, jest.fn(), { selectionId: '121', onLeave }));
    expect(result.current.selectedCityId).toBe('121');
    expect(result.current.selectionRestored).toBe(true);
    expect(result.current.canApplyHandoff()).toBe(false);

    await act(async () => { await result.current.select('121'); });
    expect(onLeave).not.toHaveBeenCalled();
    await act(async () => { await result.current.select('140'); });
    expect(onLeave).toHaveBeenCalledWith('140');

    expect(result.current.selectedCityId).toBe('121');
    expect(AsyncStorage.getItem).not.toHaveBeenCalledWith(STORAGE_SELECTED_CITY);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(STORAGE_PENDING_CATALOG_SELECTION)).toBe('__kids__');
});
