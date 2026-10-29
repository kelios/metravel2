// app/quests/map.tsx
import React, { Suspense, useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
    Platform,
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useQuestsList } from '@/hooks/useQuestsApi';
import { useThemedColors } from '@/hooks/useTheme';
import { useIsFocused } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { jsonLdScript } from '@/components/seo/jsonLdScript';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import { createMapStructuredData } from '@/utils/discoverySeo';
import { buildQuestPath } from '@/utils/routePaths';
import Map from '@/components/MapPage/Map';
import { translate as i18nT } from '@/i18n'
import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata'
import QuestPublicPageFrame from '@/components/quests/QuestPublicPageFrame';
import { QuestPageColumns } from '@/components/quests/QuestPageColumns';
import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useBreakpoints } from '@/hooks/useResponsive';
import { getQuestCatalogMapHeight } from '@/screens/tabs/QuestsStyleMetrics';


const LazyMap = React.lazy(() => import('@/components/MapPage/Map.web'));
const MAP_AFFILIATE_CONTEXT = { travelId: 'quests-map' };

/** The map keeps its own bounded viewport; the section owns navigation and advertising. */
function QuestMapWebFrame({ children }: { children: React.ReactNode }) {
    const { width } = useBreakpoints();
    const bottomPadding = useScrollBottomPadding(DESIGN_TOKENS.spacing.lg);
    return (
    <QuestPublicPageFrame viewMode="map">
            <ScrollView
                style={{ flex: 1, minHeight: 0 }}
                contentContainerStyle={{
                    padding: DESIGN_TOKENS.spacing.lg,
                    paddingBottom: asBottomDimension(bottomPadding),
                }}
                testID="quest-map-section-scroll"
            >
                <QuestPageColumns affiliateContext={MAP_AFFILIATE_CONTEXT}>
                    <View style={{ height: getQuestCatalogMapHeight(width), minHeight: 420 }} testID="quest-map-viewport">
                        {children}
                    </View>
                </QuestPageColumns>
            </ScrollView>
        </QuestPublicPageFrame>
    );
}

type Point = {
    id?: number;
    coord: string;               // "lat,lng"
    address: string;
    travelImageThumbUrl: string; // абсолютный URL картинки
    categoryName: string;
    articleUrl?: string;
    urlTravel?: string;
    questMeta?: {
        id: string;
        title: string;
        cityId: string;
        cityName?: string;
        countryName?: string;
        points?: number;
        durationMin?: number;
        difficulty?: 'easy' | 'medium' | 'hard';
        tags?: string[];
        petFriendly?: boolean;
        cover?: string;
    };
};

export default function QuestsMapScreen() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const colors = useThemedColors();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { quests, loading: questsLoading } = useQuestsList();

    const isWeb = Platform.OS === 'web';

    const travel = useMemo(() => {
        const data: Point[] = quests
            .filter(m =>
                Number.isFinite(m.lat) &&
                Number.isFinite(m.lng) &&
                (m.lat !== 0 || m.lng !== 0) &&
                !!m.cityId &&
                !!m.id,
            )
            .map((m) => {
                const coverUri = typeof m.cover === 'string' ? m.cover : '';

                return {
                    id: undefined,
                    coord: `${m.lat},${m.lng}`,
                    address: m.title,
                    travelImageThumbUrl: coverUri,
                    categoryName: i18nT('quests:app.tabs.quests.map.kvest_c79877a6'),
                    urlTravel: buildQuestPath(m.cityId, m.id) ?? undefined,
                    articleUrl: undefined,
                    questMeta: {
                        id: m.id,
                        title: m.title,
                        cityId: m.cityId,
                        cityName: m.cityName,
                        countryName: m.countryName,
                        points: m.points,
                        durationMin: m.durationMin,
                        difficulty: m.difficulty,
                        tags: m.tags,
                        petFriendly: m.petFriendly,
                        cover: coverUri || undefined,
                    },
                };
            });
        return { data };
    }, [quests]);

    const questsCenter = useMemo(() => {
        const valid = quests.filter(
            q => Number.isFinite(q.lat) && Number.isFinite(q.lng),
        );
        if (!valid.length) return { latitude: 53.9, longitude: 27.56 }; // fallback Minsk
        const lat = valid.reduce((s, q) => s + q.lat, 0) / valid.length;
        const lng = valid.reduce((s, q) => s + q.lng, 0) / valid.length;
        return { latitude: lat, longitude: lng };
    }, [quests]);

    const handleBack = () => {
        router.replace('/quests'); // всегда уходим на страницу квестов
    };
    const canonical = buildCanonicalUrl('/quests/map');
    const title = i18nT('quests:app.tabs.quests.map.karta_kvestov_i_gorodskih_marshrutov_metrave_07a69045');
    const description = i18nT('quests:app.tabs.quests.map.karta_kvestov_metravel_nahodite_gorodskie_ma_4412b76b');
    const structuredData = useMemo(
        () =>
            createMapStructuredData({
                canonical,
                title,
                description,
                entries: travel.data.map((item) => ({
                    name: item.address,
                    url: item.urlTravel,
                    lat: item.coord.split(',')[0],
                    lng: item.coord.split(',')[1],
                    categoryName: item.categoryName,
                })),
            }),
        [canonical, description, title, travel.data]
    );
    const seoTags = useMemo(
        () => jsonLdScript(structuredData, { key: 'quests-map-structured-data' }),
        [structuredData]
    );
    const seoBlock = isFocused ? (
        <InstantSEO
            headKey="quests-map"
            title={title}
            description={description}
            canonical={canonical}
            image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
            robots="noindex, nofollow"
            additionalTags={seoTags}
        />
    ) : null;

    if (!isWeb && !questsLoading && travel.data.length > 0) {
        return (
            <View style={{ flex: 1 }}>
                <Map
                    travel={travel}
                    coordinates={questsCenter}
                    mode="radius"
                    radius="2000"
                    routePoints={[]}
                    transportMode="foot"
                    onMapClick={() => {}}
                    onMarkerSelect={(point) => {
                        const url =
                            point?.urlTravel ||
                            (point?.questMeta
                                ? buildQuestPath(point.questMeta.cityId, point.questMeta.id)
                                : null);
                        if (url) router.push(url as any);
                    }}
                    setRouteDistance={() => {}}
                    setFullRouteCoords={() => {}}
                />
                <Pressable
                    onPress={handleBack}
                    style={[styles.fabBack, { top: Math.max(12, insets.top + 4) }]}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('quests:app.tabs.quests.map.nazad_855672ef')}
                >
                    <Feather name="arrow-left" size={18} color={colors.text} />
                </Pressable>
            </View>
        );
    }

    if (!isWeb) {
        return (
            <View style={styles.fallback}>
                <Text style={styles.fallbackText}>{i18nT('quests:app.tabs.quests.map.karta_dostupna_v_veb_versii_85f3b9c2')}</Text>
                <Pressable onPress={handleBack} style={styles.backBtn}>
                    <Feather name="arrow-left" size={16} color={colors.textOnPrimary} />
                    <Text style={styles.backBtnTxt}>{i18nT('quests:app.tabs.quests.map.nazad_855672ef')}</Text>
                </Pressable>
            </View>
        );
    }

    if (questsLoading) {
        return (
          <QuestMapWebFrame>
            <View style={styles.fallback}>
                {seoBlock}
                <ActivityIndicator
                    color={colors.primaryDark}
                    accessibilityLabel={i18nT('quests:app.tabs.quests.map.zagruzhaem_kartu_kvestov_6b50ed3f')}
                />
                <Text style={styles.fallbackText}>{i18nT('quests:app.tabs.quests.map.zagruzhaem_kartu_kvestov_6b50ed3f')}</Text>
            </View>
          </QuestMapWebFrame>
        );
    }

    if (travel.data.length === 0) {
        return (
          <QuestMapWebFrame>
            <View style={styles.fallback}>
                {seoBlock}
                <Feather name="map" size={48} color={colors.textMuted} />
                <Text style={styles.fallbackText}>{i18nT('quests:app.tabs.quests.map.net_kvestov_s_koordinatami_dlya_otobrazheniy_6ec1ec92')}</Text>
                <Pressable onPress={handleBack} style={styles.backBtn}>
                    <Feather name="arrow-left" size={16} color={colors.textOnPrimary} />
                    <Text style={styles.backBtnTxt}>{i18nT('quests:app.tabs.quests.map.k_spisku_kvestov_e40d397b')}</Text>
                </Pressable>
            </View>
          </QuestMapWebFrame>
        );
    }

    return (
      <QuestMapWebFrame>
        <View style={{ flex: 1 }}>
            {seoBlock}
            {Platform.OS === 'web' && (
                <Text accessibilityRole="header" aria-level={1} style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: 'hidden' as const,
                    borderWidth: 0,
                }}>{title}</Text>
            )}
            <Suspense fallback={
                <View style={styles.fallback}>
                    <ActivityIndicator
                        color={colors.primaryDark}
                        accessibilityLabel={i18nT('quests:app.tabs.quests.map.zagruzhaem_kartu_kvestov_6b50ed3f')}
                    />
                </View>
            }>
                <LazyMap
                    travel={travel}
                    coordinates={questsCenter}
                    mode="radius"
                    radius="2000"
                    routePoints={[]}
                    transportMode="foot"
                    onMapClick={() => {}}
                    setRouteDistance={() => {}}
                    setFullRouteCoords={() => {}}
                />
            </Suspense>

            {/* Плавающая кнопка Назад поверх карты */}
            <Pressable
                onPress={handleBack}
                style={[styles.fabBack, { top: Math.max(12, insets.top + 4) }]}
                accessibilityRole="button"
                accessibilityLabel={i18nT('quests:app.tabs.quests.map.nazad_855672ef')}
            >
                <Feather name="arrow-left" size={18} color={colors.text} />
            </Pressable>
        </View>
      </QuestMapWebFrame>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    fabBack: {
        position: 'absolute',
        top: 12,
        left: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        ...Platform.select({
            ios: {
                ...colors.shadows.medium,
            },
            android: { elevation: colors.shadows.medium.elevation },
            web: {
                boxShadow: colors.boxShadows.light,
            } as any,
            default: {
                ...colors.shadows.medium,
            },
        }),
    },
    fallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
    },
    fallbackText: { color: colors.textMuted, fontSize: 16 },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    backBtnTxt: { color: colors.textOnPrimary, fontWeight: '700' },
});

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); значения — общая таблица
// utils/seoRoutes/staticRoutes.js, та же, что у SSG-генератора.
export function generateMetadata() {
  return staticRouteMetadata('/quests/map')
}
