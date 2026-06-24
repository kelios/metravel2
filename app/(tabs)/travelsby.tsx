// app/travelsby/index.tsx
import React, { Suspense, createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useIsFocused } from 'expo-router';
import { useThemedColors } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import ListTravel from '@/components/listTravel/ListTravelRoute';
import { trackContentCreateCtaClicked } from '@/utils/growthFunnelAnalytics';

export default function TravelsByScreen() {
    const pathname = usePathname();
    const router = useRouter();
    const isFocused = useIsFocused();
    const colors = useThemedColors();
    const { isAuthenticated } = useAuth();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [canRenderList, setCanRenderList] = useState(Platform.OS !== 'web');

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        setCanRenderList(true);
    }, []);

    const handleCreateTravelPress = useCallback(() => {
        trackContentCreateCtaClicked({
            contentType: 'route',
            source: 'travelsby_fab',
            authState: 'authenticated',
            intent: 'create-travel',
            action: 'create',
        });
        router.push('/travel/new' as any);
    }, [router]);

    const title = 'Маршруты по Беларуси, идеи поездок и маршрутов | Metravel';
    const description =
        'Подборка маршрутов и мест по Беларуси: идеи для выходных и больших поездок. Фото, точки на карте и советы путешественников.';

    return (
        <>
            {isFocused && (
            <InstantSEO
                headKey="travelsby" // Упрощенный стабильный ключ
                title={title}
                description={description}
                canonical={buildCanonicalUrl(pathname || '/travelsby')}
                image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
                ogType="website"
            />
            )}
            <View style={styles.container}>
                {Platform.OS === 'web' && (
                    createElement('h1', {
                        style: {
                            position: 'absolute' as const,
                            width: 1,
                            height: 1,
                            padding: 0,
                            margin: -1,
                            overflow: 'hidden' as const,
                            clip: 'rect(0,0,0,0)',
                            whiteSpace: 'nowrap',
                            borderWidth: 0,
                        } as any,
                    }, title)
                )}
                {canRenderList ? (
                    <Suspense
                        fallback={
                            <View style={styles.loading}>
                                <Text style={styles.loadingText}>Загрузка…</Text>
                            </View>
                        }
                    >
                        <ListTravel />
                    </Suspense>
                ) : (
                    <View style={styles.loadingShell} testID="travelsby-shell-placeholder" />
                )}

                {isAuthenticated && Platform.OS !== 'web' && (
                    <FloatingActionButton
                        icon="plus"
                        label="Создать маршрут"
                        onPress={handleCreateTravelPress}
                        testID="fab-create-travel"
                    />
                )}
            </View>
        </>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loading: {
        padding: 16,
    },
    loadingText: {
        color: colors.text,
    },
    loadingShell: {
        flex: 1,
        minHeight: 900,
    },
});
