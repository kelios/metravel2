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

import InstantSEO from '@/components/seo/InstantSEO';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import ErrorBoundary from '@/components/ErrorBoundary';
import ErrorDisplay from '@/components/ErrorDisplay';

import ListTravel from '@/components/listTravel/ListTravel';

function TravelScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();

    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';

    // стабильный canonical без промежуточных значений при навигации
    const canonical = useMemo(() => `${SITE}${pathname || ''}`, [SITE, pathname]);

    const title = 'Маршруты, идеи и вдохновение для путешествий | Metravel';
    const description =
        'Авторские маршруты, советы и впечатления от путешественников по всему миру. Присоединяйся к сообществу MeTravel.by и вдохновляйся на новые открытия!';

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
                <ErrorBoundary
                    fallback={
                        <View style={styles.errorContainer}>
                            <ErrorDisplay
                                message="Не удалось загрузить список путешествий"
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
                    <ListTravel />
                </ErrorBoundary>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1,
        backgroundColor: '#f5f5f5', // ✅ Светло-серый фон для контраста с белыми карточками
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
});

export default memo(TravelScreen);
