// app/travelsby/index.tsx
import { Suspense, lazy, useMemo } from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { usePathname } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useIsFocused } from '@react-navigation/native';
import { useThemedColors } from '@/hooks/useTheme';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';

const ListTravel = lazy(() => import('@/components/listTravel/ListTravelBase'));

export default function TravelsByScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const title = 'Маршруты по Беларуси и идеи поездок | Metravel';
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
                    React.createElement('h1', {
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
