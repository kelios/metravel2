// app/metravel/index.tsx
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useIsFocused } from 'expo-router';
import { useThemedColors } from '@/hooks/useTheme';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { translate as i18nT } from '@/i18n'
import ListTravel from '@/components/listTravel/ListTravelBase';


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
                title={i18nT('shared:app.tabs.metravel.moi_puteshestviya_metravel_6c9c863f')}
                description={i18nT('shared:app.tabs.metravel.spisok_vashih_opublikovannyh_i_chernovyh_put_f707068f')}
                canonical={canonical}
                image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
                ogType="website"
                robots="noindex, nofollow"
            />
            )}
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
                <ListTravel />
            </SafeAreaView>
        </>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.mutedBackground,
    },
});
