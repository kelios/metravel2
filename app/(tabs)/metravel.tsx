// app/metravel/index.tsx
import { Suspense, lazy, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useIsFocused } from '@react-navigation/native';
import { useThemedColors } from '@/hooks/useTheme';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';

const ListTravel = lazy(() => import('@/components/listTravel/ListTravelBase'));

export default function MeTravelScreen() {
    const isFocused = useIsFocused();
    // стабильный canonical и стабильный ключ для head
    const canonical = buildCanonicalUrl('/metravel');
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
                image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
                ogType="website"
                robots="noindex, nofollow"
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
