import { Suspense, lazy, memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { buildCanonicalUrl, buildOgImageUrl } from '@/utils/seo';
import { SearchPageSkeleton } from '@/components/listTravel/SearchPageSkeleton';
import { queryClient } from '@/queryClient';
import { fetchTravels } from '@/api/travelsApi';
import { PER_PAGE } from '@/components/listTravel/utils/listTravelConstants';

const DEFAULT_QUERY_KEY = ['travels', { perPage: PER_PAGE, search: '', params: JSON.stringify({ moderation: 1, publish: 1 }) }];

const ListTravel = lazy(() => import('@/components/listTravel/ListTravelBase'));

function SearchScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();
    const colors = useThemedColors();
    const { isHydrated: isResponsiveHydrated = true } = useResponsive();
    const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
    const canMountContent = hydrated && isResponsiveHydrated;

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!isFocused) return;
        if (!canMountContent) return;
        if (typeof window === 'undefined') return;

        const existing = queryClient.getQueryState(DEFAULT_QUERY_KEY);
        if (existing?.data || existing?.status === 'pending') return;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let idleId: number | null = null;

        const doPrefetch = () => {
            if (cancelled) return;
            queryClient.prefetchInfiniteQuery({
                queryKey: DEFAULT_QUERY_KEY,
                queryFn: ({ pageParam = 0 }) => fetchTravels(pageParam, PER_PAGE, '', { moderation: 1, publish: 1 }),
                initialPageParam: 0,
            }).catch(() => undefined);
        };

        if ('requestIdleCallback' in window) {
            idleId = (window as any).requestIdleCallback(doPrefetch, { timeout: 2400 });
        } else {
            timer = setTimeout(doPrefetch, 300);
        }

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            if (idleId != null && 'cancelIdleCallback' in window) {
                (window as any).cancelIdleCallback(idleId);
            }
        };
    }, [canMountContent, isFocused]);

    const title = 'Поиск путешествий | Metravel';
    const description = 'Найдите путешествия по фильтрам и сохраните лучшие идеи в свою книгу.';

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        errorContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: DESIGN_TOKENS.spacing.lg,
        },
    }), [colors]);

    return (
        <>
            {isFocused && Platform.OS === 'web' && (
                <InstantSEO
                    headKey="travel-search"
                    title={title}
                    description={description}
                    canonical={buildCanonicalUrl(pathname || '/search')}
                    image={buildOgImageUrl('/og-preview.jpg')}
                    ogType="website"
                />
            )}
            <View style={styles.container} testID="search-container">
                <ErrorBoundary
                    fallback={
                        <View style={styles.errorContainer}>
                            <ErrorDisplay
                                message="Не удалось загрузить поиск путешествий"
                                onRetry={() => {
                                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                                        window.location.reload();
                                    }
                                }}
                                variant="error"
                            />
                        </View>
                    }
                >
                    {canMountContent ? (
                        <Suspense fallback={<SearchPageSkeleton />}>
                            <ListTravel />
                        </Suspense>
                    ) : (
                        <SearchPageSkeleton />
                    )}
                </ErrorBoundary>
            </View>
        </>
    );
}


export default memo(SearchScreen);
