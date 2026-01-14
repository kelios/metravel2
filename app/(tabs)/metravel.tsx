// app/metravel/index.tsx
import React, { Suspense, lazy, useMemo } from 'react';
import { Platform, View, Text, StyleSheet, SafeAreaView } from 'react-native';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import {useIsFocused} from "@react-navigation/native";
import { useThemedColors } from '@/hooks/useTheme';

const isWeb = Platform.OS === 'web';
const isClient = typeof window !== 'undefined';
const ListTravel = isWeb && isClient
  ? lazy(() => import('@/components/listTravel/ListTravelBase'))
  : require('@/components/listTravel/ListTravelBase').default;

export default function MeTravelScreen() {
    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
    const isFocused = useIsFocused();
    // стабильный canonical и стабильный ключ для head
    const canonical = useMemo(() => `${SITE}/metravel`, [SITE]);
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <>
            {isFocused && (
            <InstantSEO
                headKey="metravel" // фиксированный ключ для этой страницы
                title="Мои путешествия | Metravel"
                description="Список ваших опубликованных и черновых путешествий на платформе Metravel."
                canonical={canonical}
                image={`${SITE}/og-preview.jpg`}
                ogType="website"
            />
            )}
            <SafeAreaView style={styles.container}>
                <Suspense
                    fallback={
                        <View style={styles.loading}>
                            <Text style={styles.loadingText}>Загрузка…</Text>
                        </View>
                    }
                >
                    <ListTravel />
                </Suspense>
            </SafeAreaView>
        </>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.mutedBackground,
    },
    loading: {
        padding: 16,
    },
    loadingText: {
        color: colors.text,
    },
});
