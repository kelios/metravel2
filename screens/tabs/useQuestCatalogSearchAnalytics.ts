import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { sendAnalyticsEvent } from '@/utils/analytics';

type SearchAnalyticsOptions = {
    query: string;
    appliedSearchTerm: string;
    resultsCount: number;
    ready: boolean;
    focused: boolean;
};

const isSearchTerm = (query: string) => {
    if (query.length < 2 || query.length > 100 || /@|https?:\/\/|www\./i.test(query)) return false;
    return !(/^[+\d\s().-]+$/.test(query) && query.replace(/\D/g, '').length >= 7);
};

/** Measures a settled search against its own results, before grid pagination. */
export function useQuestCatalogSearchAnalytics({
    query,
    appliedSearchTerm,
    resultsCount,
    ready,
    focused,
}: SearchAnalyticsOptions) {
    const lastTrackedTerm = useRef<string | null>(null);
    const term = query.trim().toLowerCase();

    useEffect(() => {
        if (!term) lastTrackedTerm.current = null;
        if (Platform.OS !== 'web' || !ready || !focused || !isSearchTerm(term)
            || term !== appliedSearchTerm || term === lastTrackedTerm.current) return;

        const timer = setTimeout(() => {
            lastTrackedTerm.current = term;
            void sendAnalyticsEvent('quest_search', {
                source: 'quest_catalog',
                search_term: term,
                results_count: resultsCount,
            });
        }, 900);
        return () => clearTimeout(timer);
    }, [term, appliedSearchTerm, resultsCount, ready, focused]);
}
