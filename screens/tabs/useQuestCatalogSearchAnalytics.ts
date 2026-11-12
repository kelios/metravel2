import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { isAnalyticsSearchTerm } from '@/utils/analyticsSearchTerm';

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
