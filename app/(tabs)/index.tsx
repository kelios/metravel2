import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import { HomePageSkeleton } from '@/components/home/HomePageSkeleton';

const Home = lazy(() => import('@/components/home/Home'));

function HomeScreen() {
    const pathname = usePathname();
    const colors = useThemedColors();
    const { isHydrated: isResponsiveHydrated = true } = useResponsive();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // On web, start as false so SSR and first client render both produce the
    // same neutral output (empty container). This prevents hydration mismatch
    // when the URL is /travels/* but the index tab renders during SSR with
    // pathname='/'. After useEffect fires we know window.location is available.
    const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
    useEffect(() => { if (Platform.OS === 'web') setHydrated(true); }, []);

    // On web, only check the real browser URL after hydration.
    // Do not fallback to router focus/pathname: it can briefly report "/" while
    // navigating to /travels/* and cause Home to flash over travel details.
    const isHomePath = useMemo(() => {
        if (Platform.OS !== 'web') return true;
        if (!hydrated) return false; // SSR & first client render: unknown → false

        if (typeof window !== 'undefined') {
            const loc = String(window.location?.pathname ?? '').trim();
            if (loc === '' || loc === '/' || loc === '/index') return true;
        }
        return false;
    }, [hydrated]);

    const canMountContent = hydrated && isResponsiveHydrated;

    const canonical = useMemo(() => {
        const raw = String(pathname ?? '').trim();
        const normalized = raw === '' || raw === '/' ? '/' : raw.startsWith('/') ? raw : `/${raw}`;
        return buildCanonicalUrl(normalized);
    }, [pathname]);

    const shouldRenderSeo = useMemo(() => {
        if (Platform.OS !== 'web') return false;
        if (isHomePath) return true;
        // SSR/first render fallback for home route: keep meta tags available
        // even before window.location-based URL verification is possible.
        return !hydrated && (pathname === '/' || pathname === '/index' || pathname === '');
    }, [hydrated, isHomePath, pathname]);

    const title = 'Идеи поездок на выходные и книга путешествий | Metravel';
    const description = 'Подбирайте маршруты по расстоянию и формату отдыха, сохраняйте поездки с фото и заметками и собирайте личную книгу путешествий в PDF.';

    // Before hydration or when URL is not home: avoid rendering home content.
    // Keep SEO tags when shouldRenderSeo=true so crawlers still see meta tags.
    if (!isHomePath) {
        return shouldRenderSeo ? (
            <InstantSEO
                headKey="home"
                title={title}
                description={description}
                canonical={canonical}
                image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
                ogType="website"
            />
        ) : null;
    }

    return (
        <>
            {shouldRenderSeo && (
                <InstantSEO
                    headKey="home"
                    title={title}
                    description={description}
                    canonical={canonical}
                    image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
                    ogType="website"
                />
            )}
            {Platform.OS === 'web' && (
                <h1 style={styles.visuallyHiddenHeading}>
                    Идеи поездок на выходные и книга путешествий
                </h1>
            )}
            <View style={styles.container}>
                <ErrorBoundary
                    fallback={
                        <View style={styles.errorContainer}>
                            <ErrorDisplay
                                message="Не удалось загрузить главную страницу"
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
                      <Suspense fallback={<HomePageSkeleton />}>
                          <Home />
                      </Suspense>
                    ) : (
                      <HomePageSkeleton />
                    )}
                </ErrorBoundary>
            </View>
        </>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    visuallyHiddenHeading: {
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap' as any,
        borderWidth: 0,
    } as any,
});

export default React.memo(HomeScreen);
