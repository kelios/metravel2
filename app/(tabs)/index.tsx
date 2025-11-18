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
        <Suspense fallback={<ListTravelSkeleton />}>
            <LazyListTravel />
        </Suspense>
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
        backgroundColor: '#f9fafb',
    },
});

export default memo(TravelScreen);
