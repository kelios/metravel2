import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import Home from '@/components/home/Home';
import { useThemedColors } from '@/hooks/useTheme';
import { buildCanonicalUrl, buildOgImageUrl } from '@/utils/seo';

function HomeScreen() {
    const pathname = usePathname();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

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
    }, [buildCanonicalUrl, effectivePathname]);

    const shouldRenderSeo = useMemo(() => {
        if (Platform.OS !== 'web') return false;
        const p = String(effectivePathname ?? '').trim();
        return p === '' || p === '/' || p === '/index';
    }, [effectivePathname]);

    const shouldRenderHomeContent = useMemo(() => {
        if (Platform.OS !== 'web') return true;
        return true;
    }, []);

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
                    <Home />
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
