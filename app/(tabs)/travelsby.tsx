import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useIsFocused } from 'expo-router';
import { useThemedColors } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import ListTravel from '@/components/listTravel/ListTravelRoute';
import BelarusTravelHub from '@/components/listTravel/BelarusTravelHub';
import { trackContentCreateCtaClicked } from '@/utils/growthFunnelAnalytics';
import { translate as i18nT } from '@/i18n'
import { useTranslation } from '@/i18n/LocaleProvider';


export default function TravelsByScreen() {
    const pathname = usePathname();
    const router = useRouter();
    const isFocused = useIsFocused();
    const colors = useThemedColors();
    const { t } = useTranslation();
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

    const title = t('seoStatic:root.travelsBy.title');
    const description = t('seoStatic:root.travelsBy.description');
    const catalogIntro = Platform.OS === 'web' ? <BelarusTravelHub /> : null;

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
                {canRenderList ? (
                    <Suspense
                        fallback={
                            <>
                                {catalogIntro}
                                <View style={styles.loading}>
                                    <Text style={styles.loadingText}>{i18nT('shared:app.tabs.travelsby.zagruzka_6e1743d2')}</Text>
                                </View>
                            </>
                        }
                    >
                        <ListTravel catalogIntro={catalogIntro} />
                    </Suspense>
                ) : (
                    <>
                        {catalogIntro}
                        <View style={styles.loadingShell} testID="travelsby-shell-placeholder" />
                    </>
                )}

                {isAuthenticated && Platform.OS !== 'web' && (
                    <FloatingActionButton
                        icon="plus"
                        label={i18nT('shared:app.tabs.travelsby.sozdat_marshrut_d02b8145')}
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
