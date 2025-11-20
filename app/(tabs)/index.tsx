// app/travel/index.tsx
import React, {
    useMemo,
    memo,
    useState,
    useEffect,
    Suspense,
    lazy,
} from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import ListTravelSkeleton from '@/components/listTravel/ListTravelSkeleton';
import InstantSEO from '@/components/seo/InstantSEO';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import ErrorBoundary from '@/components/ErrorBoundary';
import ErrorDisplay from '@/components/ErrorDisplay';

// @ts-ignore - Dynamic imports are supported in runtime
const LazyListTravel = lazy(() => import('@/components/listTravel/ListTravel'));

function TravelScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();

    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';

    // стабильный canonical без промежуточных значений при навигации
    const canonical = useMemo(() => `${SITE}${pathname || ''}`, [SITE, pathname]);

    const title = 'Маршруты, идеи и вдохновение для путешествий | Metravel';
    const description =
        'Авторские маршруты, советы и впечатления от путешественников по всему миру. Присоединяйся к сообществу Metravel и вдохновляйся на новые открытия!';

    const [listReady, setListReady] = useState(false);

    useEffect(() => {
        if (listReady) return;

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            const idleHandle = (window as any).requestIdleCallback?.(
                () => setListReady(true),
                { timeout: 1200 },
            );
            return () => (window as any).cancelIdleCallback?.(idleHandle);
        }

        const timeout = setTimeout(() => setListReady(true), 200);
        return () => clearTimeout(timeout);
    }, [listReady]);

    const listContent = listReady ? (
        <ErrorBoundary
            fallback={
                <View style={styles.errorContainer}>
                    <ErrorDisplay
                        message="Не удалось загрузить список путешествий"
                        onRetry={() => {
                            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                                window.location.reload();
                            } else {
                                // Для React Native можно использовать router.reload()
                                setListReady(false);
                                setTimeout(() => setListReady(true), 100);
                            }
                        }}
                        variant="error"
                    />
                </View>
            }
        >
            <Suspense fallback={<ListTravelSkeleton />}>
                <LazyListTravel />
            </Suspense>
        </ErrorBoundary>
    ) : (
        <ListTravelSkeleton />
    );

    return (
        <>
            {isFocused && Platform.OS === 'web' && (
                <InstantSEO
                    headKey="travel-list"
                    title={title}
                    description={description}
                    canonical={canonical}
                    image={`${SITE}/og-preview.jpg`}
                    ogType="website"
                />
            )}
            <View style={styles.container}>
                {listContent}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1,
        backgroundColor: '#ffffff', // ✅ МИНИМАЛИСТИЧНЫЙ ДИЗАЙН: Чистый белый фон
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
});

export default memo(TravelScreen);
