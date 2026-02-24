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
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import { SearchPageSkeleton } from '@/components/listTravel/SearchPageSkeleton';
import { fetchTravels } from '@/api/travelsApi';
import { runStaleChunkRecovery } from '@/utils/recovery/runtimeRecovery';

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

        const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
        const conn = nav?.connection;
        const saveData = Boolean(conn?.saveData);
        const effectiveType = String(conn?.effectiveType || '').toLowerCase();
        const isSlowConnection =
            effectiveType === 'slow-2g' ||
            effectiveType === '2g' ||
            effectiveType === '3g';
        const lowMemoryDevice =
            typeof nav?.deviceMemory === 'number' && nav.deviceMemory <= 4;

        // Speculative prefetch is useful on fast networks, but on constrained
        // devices it can compete with critical resources and hurt LCP/TBT.
        if (saveData || isSlowConnection || lowMemoryDevice) return;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let idleId: number | null = null;

        const doPrefetch = async () => {
            if (cancelled) return;

            const [{ queryClient }, { PER_PAGE }] = await Promise.all([
                import('@/queryClient'),
                import('@/components/listTravel/utils/listTravelConstants'),
            ]);

            if (cancelled) return;

            const queryKey = ['travels', { perPage: PER_PAGE, search: '', params: JSON.stringify({ moderation: 1, publish: 1 }) }];
            const existing = queryClient.getQueryState(queryKey);
            if (existing?.data || existing?.status === 'pending') return;

            queryClient.prefetchInfiniteQuery({
                queryKey,
                queryFn: ({ pageParam = 0 }) => fetchTravels(pageParam, PER_PAGE, '', { moderation: 1, publish: 1 }),
                initialPageParam: 0,
            }).catch(() => undefined);
        };

        if ('requestIdleCallback' in window) {
            idleId = (window as any).requestIdleCallback(doPrefetch, { timeout: 6000 });
        } else {
            timer = setTimeout(doPrefetch, 1200);
        }

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            if (idleId != null && 'cancelIdleCallback' in window) {
                (window as any).cancelIdleCallback(idleId);
            }
        };
    }, [canMountContent, isFocused]);

    const title = 'Поиск маршрутов и идей путешествий по Беларуси | Metravel';
    const description = 'Ищите путешествия по странам, категориям и сложности. Фильтруйте маршруты и сохраняйте лучшие идеи в свою книгу путешествий.';

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
        srOnly: Platform.select({
            web: {
                position: 'absolute' as const,
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden' as const,
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                borderWidth: 0,
            },
            default: { display: 'none' as const },
        }) as any,
    }), [colors]);

    return (
        <>
            {isFocused && Platform.OS === 'web' && (
                <InstantSEO
                    headKey="travel-search"
                    title={title}
                    description={description}
                    canonical={buildCanonicalUrl(pathname || '/search')}
                    image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
                    ogType="website"
                />
            )}
            <View style={styles.container} testID="search-container">
                {Platform.OS === 'web' && (
                    <h1 style={styles.srOnly as any}>{title}</h1>
                )}
                <ErrorBoundary
                    fallback={
                        <View style={styles.errorContainer}>
                            <ErrorDisplay
                                message="Не удалось загрузить поиск путешествий"
                                onRetry={() => {
                                    if (Platform.OS === 'web') {
                                        runStaleChunkRecovery({ purgeAllCaches: true });
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
