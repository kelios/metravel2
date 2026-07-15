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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useQuestsList } from '@/hooks/useQuestsApi';
import { useThemedColors } from '@/hooks/useTheme';
import { useIsFocused } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import { createMapStructuredData } from '@/utils/discoverySeo';
import Map from '@/components/MapPage/Map';
import { translate as i18nT } from '@/i18n'


const LazyMap = React.lazy(() => import('@/components/MapPage/Map.web'));

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
                    urlTravel: `/quests/${m.cityId}/${m.id}`,
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
        () => (
            <script
                key="quests-map-structured-data"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />
        ),
        [structuredData]
    );

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
                                ? `/quests/${point.questMeta.cityId}/${point.questMeta.id}`
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
            <View style={styles.fallback}>
                <ActivityIndicator
                    color={colors.primaryDark}
                    accessibilityLabel={i18nT('quests:app.tabs.quests.map.zagruzhaem_kartu_kvestov_6b50ed3f')}
                />
                <Text style={styles.fallbackText}>{i18nT('quests:app.tabs.quests.map.zagruzhaem_kartu_kvestov_6b50ed3f')}</Text>
            </View>
        );
    }

    if (travel.data.length === 0) {
        return (
            <View style={styles.fallback}>
                <Feather name="map" size={48} color={colors.textMuted} />
                <Text style={styles.fallbackText}>{i18nT('quests:app.tabs.quests.map.net_kvestov_s_koordinatami_dlya_otobrazheniy_6ec1ec92')}</Text>
                <Pressable onPress={handleBack} style={styles.backBtn}>
                    <Feather name="arrow-left" size={16} color={colors.textOnPrimary} />
                    <Text style={styles.backBtnTxt}>{i18nT('quests:app.tabs.quests.map.k_spisku_kvestov_e40d397b')}</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            {isFocused && (
                <InstantSEO
                    headKey="quests-map"
                    title={title}
                    description={description}
                    canonical={canonical}
                    image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
                    additionalTags={seoTags}
                />
            )}
            {Platform.OS === 'web' && (
                <h1 style={{
                    position: 'absolute' as const,
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: 'hidden' as const,
                    clip: 'rect(0,0,0,0)',
                    whiteSpace: 'nowrap',
                    borderWidth: 0,
                } as any}>{title}</h1>
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
