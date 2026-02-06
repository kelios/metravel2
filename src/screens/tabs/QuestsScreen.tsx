// src/screens/tabs/QuestsScreen.tsx
import React, { useMemo, useState, useEffect, useCallback, Suspense } from 'react';
import {
    View, Text, StyleSheet, Pressable, Platform,
    Image, ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
// ⚡️ ленивые иконки — не попадают в entry
const Ion = React.lazy(() =>
    import('@expo/vector-icons/Ionicons').then((m: any) => ({ default: m.Ionicons || m.default }))
);

import InstantSEO from '@/components/seo/LazyInstantSEO';
import { haversineKm } from '@/utils/geo';
import { useIsFocused } from '@react-navigation/native';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

import { useQuestsList, useQuestCities } from '@/hooks/useQuestsApi';

// ---- типы данных ----
type City = { id: string; name: string; country?: string; lat?: number; lng?: number };
type NearbyCity = City & { isNearby: true };
type QuestMeta = {
    id: string;
    title: string;
    points: number;
    durationMin?: number;
    cover?: any;
    lat: number; lng: number;
    cityId?: string;
};

const STORAGE_SELECTED_CITY = 'quests_selected_city';
const STORAGE_NEARBY_RADIUS = 'quests_nearby_radius_km';
const DEFAULT_NEARBY_RADIUS_KM = 15;
const NEARBY_ID = '__nearby__';

const sx = (...args: Array<object | false | null | undefined>) =>
    StyleSheet.flatten(args.filter(Boolean));

type UiTheme = {
    primary: string;
    primaryDark: string;
    bg: string;
    surface: string;
    cardAlt: string;
    text: string;
    textLight: string;
    textMuted: string;
    border: string;
    divider: string;
    shadow: string;
};

function getStyles(colors: ThemedColors, ui: UiTheme) {
    return StyleSheet.create({
        page: { flex: 1, backgroundColor: colors.background },
        scrollContent: { flexGrow: 1, paddingBottom: 60 },

        wrap: { width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 16 },
        wrapMobile: { padding: 12 },

        hero: {
            flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: colors.surface, borderRadius: 12, padding: 16,
            borderWidth: 1, borderColor: colors.border, marginBottom: 16,
            ...Platform.select({ web: { boxShadow: ui.shadow } as any }),
        },
        heroMobile: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 12 },
        heroIconWrap: {
            width: 36, height: 36, borderRadius: 10, backgroundColor: ui.cardAlt,
            alignItems: 'center', justifyContent: 'center',
        },
        title: { color: colors.text, fontSize: 22, fontWeight: '800' },
        titleMobile: { fontSize: 18 },
        subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
        subtitleMobile: { fontSize: 12 },
        mapBtn: { flexDirection: 'row', gap: 6, backgroundColor: ui.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
        mapBtnMobile: { paddingHorizontal: 10, paddingVertical: 6 },
        mapBtnTxt: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 14 },

        citiesContainer: { gap: 8 },
        citiesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' },
        cityCard: { flex: 1, minWidth: 100, maxWidth: '50%', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
        cityCardMobile: { minWidth: 80, padding: 10, borderRadius: 10 },
        cityCardActive: { borderColor: ui.primary, backgroundColor: ui.cardAlt },
        cityName: { color: colors.text, fontSize: 15, fontWeight: '800' },
        cityNameMobile: { fontSize: 13 },
        cityCountry: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
        cityCountryMobile: { fontSize: 11, marginBottom: 6 },
        questsCount: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
        questsCountMobile: { fontSize: 11 },

        divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 16 },

        filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
        filtersRowMobile: { gap: 4, marginBottom: 6 },
        filtersLabel: { color: colors.textMuted, fontSize: 13 },
        filtersLabelMobile: { fontSize: 12 },
        chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
        chipMobile: { paddingHorizontal: 6, paddingVertical: 3 },
        chipActive: { borderColor: ui.primary, backgroundColor: ui.cardAlt },
        chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
        chipTextMobile: { fontSize: 11 },
        chipTextActive: { color: colors.text },

        questsContainer: { gap: 12 },
        questsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-start' },

        emptyState: {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.surface,
            borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
        },
        emptyText: { color: colors.textMuted, fontSize: 12 },

        questCard: {
            flex: 1, minWidth: 280, borderRadius: 16, overflow: 'hidden',
            borderWidth: 1, borderColor: colors.border,
            ...Platform.select({
                web: { boxShadow: ui.shadow } as any,
                android: { elevation: 2 },
                default: {},
            }),
        },
        questCardMobile: { minWidth: '100%', borderRadius: 14 },

        coverWrap: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
        coverWrapMobile: { aspectRatio: 16 / 9 },

        questCover: { width: '100%', height: '100%' },
        coverOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: colors.overlay ?? 'rgba(0,0,0,0.45)' },
        coverOverlayMobile: { padding: 10 },
        questTitle: { color: colors.textOnDark, fontSize: 16, fontWeight: '800', marginBottom: 4 },
        questTitleMobile: { fontSize: 14, marginBottom: 3 },
        questMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        questMetaRowMobile: { gap: 8 },
        metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
        metaText: { color: colors.textOnDark, fontSize: 12, fontWeight: '600' },
        metaTextAlt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
        metaTextMobile: { fontSize: 11 },

        noCoverBody: { padding: 16, backgroundColor: colors.surface, gap: 8 },
        noCoverBodyMobile: { padding: 12 },
        noCoverTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
        noCoverTitleMobile: { fontSize: 14 },
    });
}

type QuestStyles = ReturnType<typeof getStyles>;

export default function QuestsScreen() {
    const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number>(DEFAULT_NEARBY_RADIUS_KM);
    // Данные из API
    const { quests: ALL_QUESTS, cityQuestsIndex: CITY_QUESTS, loading: questsLoading } = useQuestsList();
    const { cities: apiCities, loading: citiesLoading } = useQuestCities();
    const dataLoaded = !questsLoading && !citiesLoading;
    const CITIES = useMemo<City[]>(() => apiCities.map(c => ({
        id: c.id,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
    })), [apiCities]);

    const isFocused = useIsFocused();
    const colors = useThemedColors();
    const { width, isPhone } = useResponsive();
    const isMobile = isPhone;
    const ui = useMemo<UiTheme>(
        () => ({
            primary: colors.warning ?? colors.accent,
            primaryDark: colors.warningDark ?? colors.accentDark ?? colors.primaryDark,
            bg: colors.background,
            surface: colors.surface,
            cardAlt: colors.surfaceMuted ?? colors.backgroundSecondary,
            text: colors.text,
            textLight: colors.textMuted,
            textMuted: colors.textMuted,
            border: colors.border,
            divider: colors.borderLight,
            shadow: (colors.boxShadows as any)?.small ?? '0 2px 8px rgba(0,0,0,0.06)',
        }),
        [colors],
    );
    const s = useMemo(() => getStyles(colors, ui), [colors, ui]);

    // колонки
    const cityColumns = isMobile ? 2 : width >= 1200 ? 5 : width >= 900 ? 4 : 3;
    const questColumns = isMobile ? 1 : width >= 1100 ? 3 : 2;

    // выбранный город
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_SELECTED_CITY);
                setSelectedCityId(saved || 'krakow');
            } catch {
                setSelectedCityId('krakow');
            }
        })();
    }, []);

    // радиус «Рядом»
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_NEARBY_RADIUS);
                if (saved) setNearbyRadiusKm(Number(saved));
            } catch (error) {
                console.warn('Error reading nearby radius storage', error);
            }
        })();
    }, []);

    // ⚡️ геолокацию просим ТОЛЬКО если выбран «Рядом»
    useEffect(() => {
        let cancelled = false;
            (async () => {
                if (selectedCityId !== NEARBY_ID) return;
                try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted' || cancelled) return;
                    const pos = await Location.getCurrentPositionAsync({
                        accuracy: Location.LocationAccuracy.Balanced,
                    });
                    if (!cancelled) setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                } catch (error) {
                    console.warn('Error requesting nearby location', error);
                }
            })();
        return () => { cancelled = true; };
    }, [selectedCityId]);

    const handleSelectCity = useCallback(async (id: string) => {
        setSelectedCityId(id);
        try { 
            await AsyncStorage.setItem(STORAGE_SELECTED_CITY, id); 
        } catch (error) {
            // ✅ FIX-009: Логируем ошибки вместо пустого catch
            const { devError } = await import('@/src/utils/logger');
            devError('Error saving selected city:', error);
        }
    }, []);

    const handleSetRadius = useCallback(async (km: number) => {
        setNearbyRadiusKm(km);
        try { 
            await AsyncStorage.setItem(STORAGE_NEARBY_RADIUS, String(km)); 
        } catch (error) {
            // ✅ FIX-009: Логируем ошибки вместо пустого catch
            const { devError } = await import('@/src/utils/logger');
            devError('Error saving radius:', error);
        }
    }, []);

    const citiesWithNearby: (City | NearbyCity)[] = useMemo(
        () => [{ id: NEARBY_ID, name: 'Рядом', country: 'BY', isNearby: true } as NearbyCity, ...CITIES],
        [CITIES]
    );

    const nearbyCount = useMemo(() => {
        if (!userLoc || !ALL_QUESTS.length) return 0;
        return ALL_QUESTS.reduce((acc, q) => {
            const d = haversineKm(userLoc.lat, userLoc.lng, q.lat, q.lng);
            return acc + (d <= nearbyRadiusKm ? 1 : 0);
        }, 0);
    }, [userLoc, nearbyRadiusKm, ALL_QUESTS]);

    const questsAll: (QuestMeta & { _distanceKm?: number })[] = useMemo(() => {
        if (!selectedCityId || !dataLoaded) return [];

        if (selectedCityId === NEARBY_ID) {
            if (!userLoc) return [];
            return ALL_QUESTS
                .map((q) => ({ ...q, _distanceKm: haversineKm(userLoc.lat, userLoc.lng, q.lat, q.lng) }))
                .filter((q) => (q._distanceKm ?? Infinity) <= nearbyRadiusKm)
                .sort((a, b) => a._distanceKm! - b._distanceKm!);
        }
        return (CITY_QUESTS[selectedCityId] || []).map((q) => ({ ...q }));
    }, [selectedCityId, userLoc, nearbyRadiusKm, ALL_QUESTS, CITY_QUESTS, dataLoaded]);

    const chunkArray = <T,>(array: T[], columns: number): T[][] => {
        const result: T[][] = [];
        for (let i = 0; i < array.length; i += columns) result.push(array.slice(i, i + columns));
        return result;
    };

    const chunkedCities = useMemo(() => chunkArray(citiesWithNearby, cityColumns), [citiesWithNearby, cityColumns]);
    const chunkedQuests = useMemo(() => chunkArray(questsAll, questColumns), [questsAll, questColumns]);

    // ---------- SEO ----------
    const selectedCityName =
        selectedCityId === NEARBY_ID ? 'Рядом' : CITIES.find((c) => c.id === selectedCityId)?.name ?? null;

    const titleText = useMemo(() => {
        if (!selectedCityId) return 'Квесты | MeTravel';
        if (selectedCityId === NEARBY_ID) {
            const suffix = userLoc
                ? nearbyCount > 0 ? ` — ${nearbyCount} поблизости • радиус ${nearbyRadiusKm} км` : ' — рядом ничего не найдено'
                : ' — геолокация отключена';
            return `Квесты: Рядом${suffix} | MeTravel`;
        }
        return `Квесты: ${selectedCityName || 'Город'} | MeTravel`;
    }, [selectedCityId, selectedCityName, nearbyCount, nearbyRadiusKm, userLoc]);

    const descText = useMemo(() => {
        if (selectedCityId === NEARBY_ID) {
            return 'Офлайн-квесты рядом с вами. Выбирайте радиус и исследуйте парки и улицы поблизости.';
        }
        if (selectedCityName) {
            return `Офлайн-квесты в городе ${selectedCityName}. Прогулки по точкам, задания и маршруты.`;
        }
        return 'Исследуйте города и парки с офлайн-квестами — приключения на карте рядом с вами.';
    }, [selectedCityId, selectedCityName]);

    return (
        <>
            {isFocused && (
                <InstantSEO headKey="quests-index" title={titleText} description={descText} ogType="website" />
            )}
            <ScrollView style={s.page} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={sx(s.wrap, isMobile && s.wrapMobile)}>
                    {/* Hero */}
                    <View style={sx(s.hero, isMobile && s.heroMobile)}>
                        <View style={s.heroIconWrap}>
                            <Suspense fallback={null}>
                                {/* @ts-ignore */}
                                <Ion name="compass" size={isMobile ? 20 : 26} color={ui.primary} />
                            </Suspense>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={sx(s.title, isMobile && s.titleMobile)}>Квесты</Text>
                            <Text style={sx(s.subtitle, isMobile && s.subtitleMobile)}>
                                Находи приключения в городах и парках
                            </Text>
                        </View>

                        <Link href="/quests/map" asChild>
                            <Pressable style={sx(s.mapBtn, isMobile && s.mapBtnMobile)}>
                                <Suspense fallback={null}>
                                    {/* @ts-ignore */}
                                    <Ion name="map" size={14} color={colors.textOnPrimary} />
                                </Suspense>
                                <Text style={s.mapBtnTxt}>Карта</Text>
                            </Pressable>
                        </Link>
                    </View>

                    {/* Города */}
                    <View style={s.citiesContainer}>
                        {!dataLoaded ? (
                            <Text style={{ color: colors.textMuted, padding: 8 }}>Загрузка городов…</Text>
                        ) : (
                            chunkedCities.map((row, rowIndex) => (
                                <View key={`row-${rowIndex}`} style={s.citiesRow}>
                                    {row.map((item: any) => {
                                        const active = selectedCityId === item.id;
                                        const questsCount =
                                            item.id === NEARBY_ID
                                                ? userLoc ? nearbyCount : 0
                                                : (CITY_QUESTS[item.id]?.length || 0);

                                        return (
                                            <Pressable
                                                key={item.id}
                                                onPress={() => handleSelectCity(item.id)}
                                                style={sx(s.cityCard, active && s.cityCardActive, isMobile && s.cityCardMobile)}
                                            >
                                                <Text style={sx(s.cityName, isMobile && s.cityNameMobile)}>
                                                    {item.id === NEARBY_ID ? 'Рядом' : item.name}
                                                </Text>
                                                <Text style={sx(s.cityCountry, isMobile && s.cityCountryMobile)}>
                                                    {item.id === NEARBY_ID
                                                        ? userLoc ? 'по геолокации' : 'гео отключена'
                                                        : item.name}
                                                </Text>
                                                <Text style={sx(s.questsCount, isMobile && s.questsCountMobile)}>
                                                    {questsCount} кв.
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            ))
                        )}
                    </View>

                    {selectedCityId && <View style={s.divider} />}

                    {/* Радиус для «Рядом» */}
                    {selectedCityId === NEARBY_ID && (
                        <View style={sx(s.filtersRow, isMobile && s.filtersRowMobile)}>
                            <Text style={sx(s.filtersLabel, isMobile && s.filtersLabelMobile)}>Радиус:</Text>
                            {[2, 5, 10, 15, 20].map((km) => (
                                <Pressable
                                    key={km}
                                    onPress={() => handleSetRadius(km)}
                                    style={sx(s.chip, nearbyRadiusKm === km && s.chipActive, isMobile && s.chipMobile)}
                                >
                                    <Text
                                        style={sx(
                                            s.chipText,
                                            nearbyRadiusKm === km && s.chipTextActive,
                                            isMobile && s.chipTextMobile
                                        )}
                                    >
                                        {km} км
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {/* Квесты */}
                    {selectedCityId && (
                        <View style={s.questsContainer}>
                            {selectedCityId === NEARBY_ID && userLoc && questsAll.length === 0 ? (
                                <View style={s.emptyState}>
                                    <Suspense fallback={null}>
                                        {/* @ts-ignore */}
                                        <Ion name="alert-circle" size={16} color={colors.textMuted} />
                                    </Suspense>
                                    <Text style={s.emptyText}>Рядом ничего не найдено. Попробуйте увеличить радиус.</Text>
                                </View>
                            ) : null}

                            {!dataLoaded ? (
                                <Text style={{ color: colors.textMuted, padding: 8 }}>Загрузка квестов…</Text>
                            ) : (
                                                        chunkedQuests.map((row, rowIndex) => (
                                    <View key={`quest-row-${rowIndex}`} style={s.questsRow}>
                                        {row.map((quest) => (
                                            <QuestCardLink
                                                key={quest.id}
                                                cityId={selectedCityId === NEARBY_ID ? (quest.cityId as string) : (selectedCityId as string)}
                                                quest={quest}
                                                nearby={selectedCityId === NEARBY_ID}
                                                isMobile={isMobile}
                                                s={s}
                                                colors={colors}
                                            />
                                        ))}
                                    </View>
                                ))
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>
        </>
    );
}

function QuestCardLink({
                           cityId, quest, nearby, isMobile, s, colors,
                       }: {
    cityId: string;
    quest: QuestMeta & { _distanceKm?: number };
    nearby?: boolean;
    isMobile?: boolean;
    s: QuestStyles;
    colors: ThemedColors;
}) {
    const durationText = quest.durationMin ? `${Math.round((quest.durationMin ?? 60) / 5) * 5} мин` : '1–2 часа';

    const metaRow = (
        <View style={sx(s.questMetaRow, isMobile && s.questMetaRowMobile)}>
            <View style={s.metaItem}>
                <Suspense fallback={null}>
                    {/* @ts-ignore */}
                    <Ion name="navigate" size={12} color={quest.cover ? colors.textOnDark : colors.textMuted} />
                </Suspense>
                <Text style={sx(quest.cover ? s.metaText : s.metaTextAlt, isMobile && s.metaTextMobile)}>{quest.points}</Text>
            </View>
            <View style={s.metaItem}>
                <Suspense fallback={null}>
                    {/* @ts-ignore */}
                    <Ion name="time" size={12} color={quest.cover ? colors.textOnDark : colors.textMuted} />
                </Suspense>
                <Text style={sx(quest.cover ? s.metaText : s.metaTextAlt, isMobile && s.metaTextMobile)}>{durationText}</Text>
            </View>
            {nearby && typeof quest._distanceKm === 'number' && (
                <View style={s.metaItem}>
                    <Suspense fallback={null}>
                        {/* @ts-ignore */}
                        <Ion name="walk" size={12} color={quest.cover ? colors.textOnDark : colors.textMuted} />
                    </Suspense>
                    <Text style={sx(quest.cover ? s.metaText : s.metaTextAlt, isMobile && s.metaTextMobile)}>
                        {quest._distanceKm < 1
                            ? `${Math.round(quest._distanceKm * 1000)} м`
                            : `${quest._distanceKm.toFixed(1)} км`}
                    </Text>
                </View>
            )}
        </View>
    );

    return (
        <Link href={`/quests/${cityId}/${quest.id}`} asChild>
            <Pressable style={sx(s.questCard, isMobile && s.questCardMobile)}>
                {quest.cover ? (
                    <View style={sx(s.coverWrap, isMobile && s.coverWrapMobile)}>
                        <Image source={typeof quest.cover === 'string' ? { uri: quest.cover } : quest.cover} style={s.questCover} resizeMode="cover" />
                        <View style={sx(s.coverOverlay, isMobile && s.coverOverlayMobile)}>
                            <Text style={sx(s.questTitle, isMobile && s.questTitleMobile)} numberOfLines={2}>
                                {quest.title}
                            </Text>
                            {metaRow}
                        </View>
                    </View>
                ) : (
                    <View style={sx(s.noCoverBody, isMobile && s.noCoverBodyMobile)}>
                        <Text style={sx(s.noCoverTitle, isMobile && s.noCoverTitleMobile)} numberOfLines={2}>
                            {quest.title}
                        </Text>
                        {metaRow}
                    </View>
                )}
            </Pressable>
        </Link>
    );
}
