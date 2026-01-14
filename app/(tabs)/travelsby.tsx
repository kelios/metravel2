// app/travelsby/index.tsx
import React, { Suspense, lazy, useMemo } from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { usePathname } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import {useIsFocused} from "@react-navigation/native";
import { useThemedColors } from '@/hooks/useTheme';

const isWeb = Platform.OS === 'web';
const isClient = typeof window !== 'undefined';
const ListTravel = isWeb && isClient
  ? lazy(() => import('@/components/listTravel/ListTravelBase'))
  : require('@/components/listTravel/ListTravelBase').default;

export default function TravelsByScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();
    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const canonical = useMemo(
        () => `${SITE}${pathname || '/travelsby'}`,
        [SITE, pathname]
    );

    const title = 'Путешествия по Беларуси | Metravel';
    const description =
        'Подборка маршрутов и мест по Беларуси: идеи для выходных и больших поездок. Фото, точки на карте и советы путешественников.';

    return (
        <>
            {isFocused && (
            <InstantSEO
                headKey="travelsby" // Упрощенный стабильный ключ
                title={title}
                description={description}
                canonical={canonical}
                image={`${SITE}/og-preview.jpg`}
                ogType="website"
            />
            )}
            <View style={styles.container}>
                <Suspense
                    fallback={
                        <View style={styles.loading}>
                            <Text style={styles.loadingText}>Загрузка…</Text>
                        </View>
                    }
                >
                    <ListTravel />
                </Suspense>
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
});
