import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import {
    ALL_QUESTS_ID, STORAGE_SELECTED_CITY,
    resolveQuestThemeQuery, resolveStoredQuestCatalogSelection, getQuestThemeQueryFromNavigationUrl,
} from '@/utils/questCatalogSelection';

/** One selection owner for URL entry, saved restore, manual controls and profile handoff. */
export function useQuestCatalogSelection(isFocused: boolean, onNavigation: () => void) {
    const { theme } = useLocalSearchParams<{ theme?: string | string[] }>();
    const queryKey = JSON.stringify(theme) ?? 'absent';
    const initial = useRef(resolveQuestThemeQuery(theme));
    // The static web catalog has no query selection. Commit URL intent in the
    // first effect before storage, keeping the hydration render identical.
    const [selectedCityId, setSelectedCityId] = useState<string | null>(
        Platform.OS === 'web' ? ALL_QUESTS_ID : initial.current ?? ALL_QUESTS_ID,
    );
    const [selectionRestored, setSelectionRestored] = useState(Platform.OS !== 'web' && initial.current !== null);
    const generation = useRef(0);
    const lastQuery = useRef(queryKey);
    const wasFocused = useRef(isFocused);
    const hasFocused = useRef(isFocused);
    const blockHandoff = useRef(initial.current !== null);
    const pendingLinkQuery = useRef<string | null>(null);
    const explicitNextFocus = useRef(false);
    const navigationCallback = useRef(onNavigation);
    navigationCallback.current = onNavigation;

    const select = useCallback(async (id: string, persistedId = id) => {
        generation.current++;
        setSelectedCityId(id);
        setSelectionRestored(true);
        try {
            await AsyncStorage.setItem(STORAGE_SELECTED_CITY, persistedId);
        } catch (error) {
            const { devError } = await import('@/utils/logger');
            devError('Error saving selected city:', error);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const epoch = generation.current;
        if (initial.current !== null) {
            void select(initial.current);
            return undefined;
        }
        void (async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_SELECTED_CITY);
                if (cancelled || generation.current !== epoch) return;
                const restored = resolveStoredQuestCatalogSelection(saved);
                setSelectedCityId(restored);
                if (saved !== restored) await AsyncStorage.setItem(STORAGE_SELECTED_CITY, restored);
            } catch {
                if (!cancelled && generation.current === epoch) setSelectedCityId(ALL_QUESTS_ID);
            } finally {
                if (!cancelled) setSelectionRestored(true);
            }
        })();
        return () => { cancelled = true; };
    }, [select]);

    useEffect(() => {
        if (!isFocused) { wasFocused.current = false; return; }
        if (pendingLinkQuery.current !== null) {
            if (pendingLinkQuery.current !== queryKey) return;
            pendingLinkQuery.current = null;
        }
        // A later profile visit is intentional even if the old URL is still present.
        if (!explicitNextFocus.current && hasFocused.current && !wasFocused.current && lastQuery.current === queryKey) blockHandoff.current = false;
        explicitNextFocus.current = false;
        wasFocused.current = true;
        hasFocused.current = true;
        if (lastQuery.current === queryKey) return;
        lastQuery.current = queryKey;
        const selection = resolveQuestThemeQuery(theme);
        blockHandoff.current = selection !== null;
        if (selection === null) return;
        navigationCallback.current();
        void select(selection);
    }, [isFocused, queryKey, select, theme]);

    useEffect(() => {
        if (Platform.OS === 'web') return undefined;
        const subscription = Linking.addEventListener('url', ({ url }) => {
            const linkedTheme = getQuestThemeQueryFromNavigationUrl(url);
            const selection = resolveQuestThemeQuery(linkedTheme);
            if (selection === null) return;
            // A genuinely new identical native link is intentional; a simple refocus is not.
            lastQuery.current = JSON.stringify(linkedTheme) ?? 'absent';
            pendingLinkQuery.current = lastQuery.current;
            explicitNextFocus.current = !isFocused;
            blockHandoff.current = true;
            navigationCallback.current();
            void select(selection);
        });
        return () => subscription.remove();
    }, [isFocused, select]);

    const getGeneration = useCallback(() => generation.current, []);
    const canApplyHandoff = useCallback(() => !blockHandoff.current, []);
    return { selectedCityId, setSelectedCityId, select, selectionRestored, getGeneration, canApplyHandoff };
}
