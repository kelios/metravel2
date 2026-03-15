/**
 * HomeScreen - Optimized for instant perceived performance
 * 
 * Pattern: YouTube-style skeleton → content transition
 * - Skeleton renders instantly on first paint (no delays)
 * - Data loads in background while skeleton is visible
 * - Web navigation sections remain accessible during loading
 * - Smooth fade transition when content is ready
 * - No empty screens or heavy first render
 */
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, Animated } from 'react-native';
import { usePathname } from 'expo-router';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import { HomePageSkeleton } from '@/components/home/HomePageSkeleton';

/** Lazy load main content - data fetching starts immediately inside Home */
const Home = lazy(() => import('@/components/home/Home'));

/** SEO metadata */
const SEO_TITLE = 'Идеи поездок на выходные и книга путешествий | Metravel';
const SEO_DESCRIPTION = 'Подбирайте маршруты по расстоянию и формату отдыха, сохраняйте поездки с фото и заметками и собирайте личную книгу путешествий в PDF.';

/** Transition duration for skeleton → content fade */
const TRANSITION_MS = 200;

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

    // Track content ready state for smooth transition
    const [contentReady, setContentReady] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Handle sidebar section navigation (scroll to section when clicked in skeleton)
    const handleSectionPress = useCallback((sectionKey: string) => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const element = document.querySelector(`[data-section="${sectionKey}"]`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    // Animate content fade-in when ready
    useEffect(() => {
        if (contentReady) {
            if (Platform.OS === 'web') {
                // CSS handles transition on web
                return;
            }
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: TRANSITION_MS,
                useNativeDriver: true,
            }).start();
        }
    }, [contentReady, fadeAnim]);

    // Web-specific styles for CSS transitions
    const webSkeletonStyle = Platform.OS === 'web' ? {
        opacity: contentReady ? 0 : 1,
        pointerEvents: contentReady ? 'none' as const : 'auto' as const,
        transition: `opacity ${TRANSITION_MS}ms ease-out`,
    } : {};

    const webContentStyle = Platform.OS === 'web' ? {
        opacity: contentReady ? 1 : 0,
        transition: `opacity ${TRANSITION_MS}ms ease-out`,
    } : {};

    // Before hydration or when URL is not home: avoid rendering home content.
    // Keep SEO tags when shouldRenderSeo=true so crawlers still see meta tags.
    if (!isHomePath) {
        return shouldRenderSeo ? (
            <InstantSEO
                headKey="home"
                title={SEO_TITLE}
                description={SEO_DESCRIPTION}
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
                    title={SEO_TITLE}
                    description={SEO_DESCRIPTION}
                    canonical={canonical}
                    image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
                    ogType="website"
                />
            )}
            <View style={styles.container}>
                {Platform.OS === 'web' && (
                    React.createElement('h1', { style: styles.srOnly as any }, SEO_TITLE)
                )}
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
                    <View style={styles.contentWrapper}>
                        {/* Skeleton layer - visible instantly, fades out when content ready */}
                        {!contentReady && (
                            <View 
                                style={[styles.skeletonLayer, webSkeletonStyle as any]}
                                testID="home-skeleton-layer"
                            >
                                <HomePageSkeleton 
                                    showSidebarNavigation={Platform.OS === 'web'}
                                    onSectionPress={handleSectionPress}
                                />
                            </View>
                        )}

                        {/* Content layer - renders behind skeleton, fades in when ready */}
                        {canMountContent && (
                            Platform.OS === 'web' ? (
                                <View style={[styles.contentLayer, webContentStyle as any]}>
                                    <Suspense fallback={<HomePageSkeleton showSidebarNavigation={false} />}>
                                        <HomeWithReadyCallback onReady={() => setContentReady(true)} />
                                    </Suspense>
                                </View>
                            ) : (
                                <Animated.View style={[styles.contentLayer, { opacity: fadeAnim }]}>
                                    <Suspense fallback={<HomePageSkeleton />}>
                                        <HomeWithReadyCallback onReady={() => setContentReady(true)} />
                                    </Suspense>
                                </Animated.View>
                            )
                        )}
                    </View>
                </ErrorBoundary>
            </View>
        </>
    );
}

/** Wrapper that signals when Home has mounted and is ready */
const HomeWithReadyCallback = React.memo<{ onReady: () => void }>(({ onReady }) => {
    const hasSignaled = useRef(false);
    
    useEffect(() => {
        if (!hasSignaled.current) {
            hasSignaled.current = true;
            // Signal ready on next frame to ensure render is complete
            requestAnimationFrame(() => onReady());
        }
    }, [onReady]);

    return <Home />;
});

HomeWithReadyCallback.displayName = 'HomeWithReadyCallback';

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    contentWrapper: {
        flex: 1,
        position: 'relative' as const,
    },
    skeletonLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    contentLayer: {
        flex: 1,
    },
});

export default React.memo(HomeScreen);
