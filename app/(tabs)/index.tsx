import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { buildCanonicalUrl, buildOgImageUrl } from '@/utils/seo';
import { HomePageSkeleton } from '@/components/home/HomePageSkeleton';

const Home = lazy(() => import('@/components/home/Home'));

function HomeScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();
    const colors = useThemedColors();
    const { isHydrated: isResponsiveHydrated = true } = useResponsive();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
    useEffect(() => { if (Platform.OS === 'web') setHydrated(true); }, []);
    const canMountContent = hydrated && isResponsiveHydrated;

    const effectivePathname = useMemo(() => {
        if (Platform.OS !== 'web') return pathname;
        if (typeof window === 'undefined') return pathname;
        const p = String(window.location?.pathname ?? '').trim();
        return p !== '' ? p : pathname;
    }, [pathname]);

    const canonical = useMemo(() => {
        const raw = String(effectivePathname ?? '').trim();
        const normalized = raw === '' || raw === '/' ? '/' : raw.startsWith('/') ? raw : `/${raw}`;
        return buildCanonicalUrl(normalized);
    }, [effectivePathname]);

    const shouldRenderSeo = useMemo(() => {
        if (Platform.OS !== 'web') return false;
        if (!isFocused) return false;
        const p = String(effectivePathname ?? '').trim();
        return p === '' || p === '/' || p === '/index';
    }, [effectivePathname, isFocused]);

    const shouldRenderHomeContent = useMemo(() => {
        if (Platform.OS !== 'web') return true;
        // When the screen is focused, always render — this avoids blank page
        // after navigating back from travel details (window.location.pathname
        // can be stale during SPA transitions).
        if (isFocused) return true;
        // When NOT focused, use pathname to avoid flash of home content
        // when directly navigating to /travels/* etc.
        const p = String(effectivePathname ?? '').trim();
        return p === '' || p === '/' || p === '/index';
    }, [effectivePathname, isFocused]);

    const title = 'Твоя книга путешествий | Metravel';
    const description = 'Добавляй поездки, фото и заметки — и собирай красивую книгу в PDF для печати.';

    if (!shouldRenderHomeContent) {
        return <View style={styles.container} />;
    }

    return (
        <>
            {shouldRenderSeo && (
                <InstantSEO
                    headKey="home"
                    title={title}
                    description={description}
                    canonical={canonical}
                    image={buildOgImageUrl('/og-preview.jpg')}
                    ogType="website"
                />
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
});

export default React.memo(HomeScreen);
