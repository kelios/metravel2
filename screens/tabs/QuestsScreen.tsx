// src/screens/tabs/QuestsScreen.tsx
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, Platform,
    Image, ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { buildCanonicalUrl } from '@/utils/seo';
import { haversineKm } from '@/utils/geo';
import { useIsFocused } from '@react-navigation/native';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useQuestsList, useQuestCities } from '@/hooks/useQuestsApi';

import { QuestsFilterContent, QuestsFilterDrawer } from '@/screens/tabs/QuestsFilterPanel';

// ---- типы данных ----
type City = { id: string; name: string; country?: string; lat?: number; lng?: number };
type NearbyCity = City & { isNearby: true };
type QuestMeta = {
    id: string;
    title: string;
    points: number;
    durationMin?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    cover?: any;
    lat: number; lng: number;
    cityId?: string;
};

const STORAGE_SELECTED_CITY = 'quests_selected_city';
const STORAGE_NEARBY_RADIUS = 'quests_nearby_radius_km';
const DEFAULT_NEARBY_RADIUS_KM = 15;
const NEARBY_ID = '__nearby__';

const { spacing, radii, typography } = DESIGN_TOKENS;
const SIDE_PANEL_WIDTH = 300;

const DIFFICULTY_LABELS: Record<string, string> = {
    easy: 'Лёгкий',
    medium: 'Средний',
    hard: 'Сложный',
};

const sx = (...args: Array<object | false | null | undefined>) =>
    StyleSheet.flatten(args.filter(Boolean));

// ───────────── Styles ─────────────

function getStyles(colors: ThemedColors, screenWidth: number) {
    const isSmall = screenWidth < 380;
    return StyleSheet.create({
        page: { flex: 1, backgroundColor: colors.background },

        /* ---- Hero (full-width top bar) ---- */
        heroWrap: { width: '100%', maxWidth: 1400, alignSelf: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
        heroWrapMobile: { paddingHorizontal: spacing.xs, paddingTop: spacing.xs },
        hero: {
            flexDirection: 'row', alignItems: 'center', gap: spacing.md,
            backgroundColor: colors.primarySoft, borderRadius: radii.lg, padding: spacing.lg,
            borderWidth: 1, borderColor: colors.primaryLight,
            ...Platform.select({ web: { boxShadow: (colors.boxShadows as any)?.light } as any }),
        },
        heroMobile: {
            flexDirection: 'column', alignItems: 'stretch',
            padding: spacing.sm, gap: spacing.sm, borderRadius: radii.md,
        },
        heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        heroIconWrap: {
            width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.surface,
            alignItems: 'center', justifyContent: 'center',
            ...Platform.select({ web: { boxShadow: (colors.boxShadows as any)?.light } as any }),
        },
        heroIconWrapMobile: { width: 36, height: 36, borderRadius: 8 },
        title: { color: colors.text, fontSize: typography.sizes.xl, fontWeight: '700', letterSpacing: -0.3 },
        titleMobile: { fontSize: isSmall ? typography.sizes.md : typography.sizes.lg },
        subtitle: { color: colors.textMuted, fontSize: typography.sizes.sm, marginTop: 2, lineHeight: 20 },
        subtitleMobile: { fontSize: typography.sizes.xs, marginTop: 1 },
        heroStats: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
        heroStatsMobile: { marginTop: spacing.xs, gap: spacing.xxs },
        heroStatCard: {
            minWidth: 92,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.primaryLight,
            backgroundColor: colors.surface,
        },
        heroStatLabel: {
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '600',
            marginBottom: 1,
        },
        heroStatValue: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        heroBtns: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
        heroBtnsMobile: { alignSelf: 'stretch' },
        actionBtn: {
            flexDirection: 'row', gap: spacing.xs, backgroundColor: colors.primary,
            paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
            borderRadius: radii.sm, minHeight: DESIGN_TOKENS.touchTarget.minHeight,
            alignItems: 'center', justifyContent: 'center',
        },
        actionBtnMobile: {
            flex: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
            minHeight: 40,
        },
        actionBtnSecondary: {
            backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
        },
        actionBtnTxt: { color: colors.textOnPrimary, fontWeight: '700', fontSize: typography.sizes.sm },
        actionBtnTxtSecondary: { color: colors.text },

        contentWrap: {
            width: '100%',
            maxWidth: 1400,
            alignSelf: 'center',
            paddingHorizontal: spacing.md,
            flex: 1,
        },
        contentWrapMobile: { paddingHorizontal: spacing.xs },

        /* ---- Layout: sidebar + main ---- */
        contentRow: { flex: 1, flexDirection: 'row' },
        contentRowMobile: { flexDirection: 'column' },

        sidePanel: {
            width: SIDE_PANEL_WIDTH, borderRightWidth: 1, borderRightColor: colors.border,
            paddingHorizontal: spacing.md, backgroundColor: colors.surface,
        },

        mainContent: { flex: 1 },
        mainScroll: { flex: 1 },
        mainScrollContent: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xxxl },
        mainScrollContentMobile: { padding: spacing.xs, paddingBottom: spacing.xxxl + spacing.lg },

        /* ---- Section headers ---- */
        sectionHeader: {
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: spacing.sm, paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            backgroundColor: colors.surface,
        },
        sectionTitle: { color: colors.text, fontSize: typography.sizes.md, fontWeight: '700', flexShrink: 1 },
        sectionTitleMobile: { fontSize: typography.sizes.sm },
        sectionMeta: { color: colors.textMuted, fontSize: typography.sizes.xs, fontWeight: '600', flexShrink: 0 },

        /* ---- Quests grid ---- */
        questsContainer: { gap: spacing.md },
        questsRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'nowrap', alignItems: 'stretch' },
        questsRowMobile: { gap: spacing.sm },

        /* ---- Quest card ---- */
        questCard: {
            flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0,
            borderRadius: radii.lg, overflow: 'hidden',
            borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
            ...Platform.select({
                web: { boxShadow: (colors.boxShadows as any)?.card, transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease' } as any,
                android: { elevation: 2 },
                default: {},
            }),
        },
        questCardHover: {
            borderColor: colors.primaryLight,
            ...Platform.select({ web: { boxShadow: (colors.boxShadows as any)?.hover, transform: 'translateY(-2px)' } as any }),
        },
        questCardPressed: {
            ...Platform.select({ web: { transform: 'translateY(0px)' } as any }),
        },
        questCardMobile: { minWidth: '100%', maxWidth: '100%', borderRadius: radii.md },

        coverWrap: { width: '100%', aspectRatio: 16 / 9, position: 'relative', backgroundColor: colors.surfaceMuted },
        coverWrapMobile: { aspectRatio: isSmall ? 4 / 3 : 16 / 9 },

        questCover: { width: '100%', height: '100%' },
        coverFallback: { flex: 1, backgroundColor: colors.backgroundSecondary },
        coverOverlay: {
            position: 'absolute', bottom: 0, left: 0, right: 0,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            backgroundColor: colors.overlay ?? 'rgba(0,0,0,0.45)',
        },
        coverOverlayMobile: { padding: spacing.sm },
        questTitle: { color: colors.text, fontSize: typography.sizes.md, fontWeight: '700', marginBottom: spacing.xxs, lineHeight: 22 },
        questTitleMobile: { fontSize: typography.sizes.sm, lineHeight: 20, marginBottom: 2 },
        questBody: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: spacing.xs,
            minHeight: 112,
            justifyContent: 'space-between',
        },
        questBodyMobile: { minHeight: 96, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
        questMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
        questMetaRowMobile: { gap: spacing.xs },
        metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
        metaText: { color: colors.text, fontSize: typography.sizes.xs, fontWeight: '600' },
        metaTextAlt: { color: colors.textMuted, fontSize: typography.sizes.xs, fontWeight: '600' },
        metaTextMobile: { fontSize: 11 },
        questFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTopWidth: 1,
            borderTopColor: colors.borderLight,
            paddingTop: spacing.xs,
        },
        questFooterText: { color: colors.primaryText, fontSize: typography.sizes.xs, fontWeight: '700' },

        /* ---- Difficulty badge ---- */
        difficultyBadge: {
            position: 'absolute', top: spacing.sm, left: spacing.sm,
            paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs,
            borderRadius: radii.pill, backgroundColor: 'rgba(0,0,0,0.55)',
        },
        difficultyText: { color: colors.textOnDark, fontSize: 11, fontWeight: '700' },

        /* ---- Skeleton ---- */
        skeletonQuestsRow: { gap: spacing.sm },
    });
}

type QuestStyles = ReturnType<typeof getStyles>;
type CityQuickFilter = 'all' | 'withQuests' | 'nearby';

// ───────────── Main screen ─────────────

export default function QuestsScreen() {
    const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number>(DEFAULT_NEARBY_RADIUS_KM);
    const [citySearchQuery, setCitySearchQuery] = useState('');
    const [cityQuickFilter, setCityQuickFilter] = useState<CityQuickFilter>('all');
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

    // API data
    const { quests: ALL_QUESTS, cityQuestsIndex: CITY_QUESTS, loading: questsLoading } = useQuestsList();
    const { cities: apiCities, loading: citiesLoading } = useQuestCities();
    const dataLoaded = !questsLoading && !citiesLoading;
    const CITIES = useMemo<City[]>(() => apiCities.map(c => ({
        id: c.id, name: c.name, lat: c.lat, lng: c.lng,
    })), [apiCities]);

    const isFocused = useIsFocused();
    const colors = useThemedColors();
    const { width, isPhone } = useResponsive();
    const isMobile = isPhone;
    const isDesktop = !isMobile;
    const s = useMemo(() => getStyles(colors, width), [colors, width]);

    // columns — desktop with sidebar gets 2, wide screens get 3
    const questColumns = isMobile ? 1 : width >= 1200 ? 3 : 2;

    // ── Persistent city selection ──
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_SELECTED_CITY);
                setSelectedCityId(saved || null);
            } catch { setSelectedCityId(null); }
        })();
    }, []);

    const handleSelectCity = useCallback(async (id: string) => {
        setSelectedCityId(id);
        if (isMobile) setFilterDrawerOpen(false);
        try {
            await AsyncStorage.setItem(STORAGE_SELECTED_CITY, id);
        } catch (error) {
            const { devError } = await import('@/utils/logger');
            devError('Error saving selected city:', error);
        }
    }, [isMobile]);

    const handleSetRadius = useCallback(async (km: number) => {
        setNearbyRadiusKm(km);
        try {
            await AsyncStorage.setItem(STORAGE_NEARBY_RADIUS, String(km));
        } catch (error) {
            const { devError } = await import('@/utils/logger');
            devError('Error saving radius:', error);
        }
    }, []);

    // Auto-select first city if current is invalid
    useEffect(() => {
        if (!dataLoaded || !CITIES.length) return;
        const validIds = new Set(CITIES.map((c) => c.id));
        const isValid = selectedCityId === NEARBY_ID || (selectedCityId ? validIds.has(selectedCityId) : false);
        if (isValid) return;
        void handleSelectCity(CITIES[0]?.id ?? '');
    }, [CITIES, dataLoaded, handleSelectCity, selectedCityId]);

    // Nearby radius persistence
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_NEARBY_RADIUS);
                if (saved) setNearbyRadiusKm(Number(saved));
            } catch (error) { console.warn('Error reading nearby radius storage', error); }
        })();
    }, []);

    // Geolocation only when Nearby is selected
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
            } catch (error) { console.warn('Error requesting nearby location', error); }
        })();
        return () => { cancelled = true; };
    }, [selectedCityId]);

    // ── Derived data ──
    const citiesWithNearby: (City | NearbyCity)[] = useMemo(
        () => [{ id: NEARBY_ID, name: 'Рядом', country: 'BY', isNearby: true } as NearbyCity, ...CITIES],
        [CITIES],
    );

    const filteredCities = useMemo(() => {
        const q = citySearchQuery.trim().toLowerCase();
        if (!q) return citiesWithNearby;
        return citiesWithNearby.filter((c) => {
            const t = c.id === NEARBY_ID ? 'рядом' : c.name;
            return t.toLowerCase().includes(q);
        });
    }, [citySearchQuery, citiesWithNearby]);

    const nearbyCount = useMemo(() => {
        if (!userLoc || !ALL_QUESTS.length) return 0;
        return ALL_QUESTS.reduce((acc, q) => {
            const d = haversineKm(userLoc.lat, userLoc.lng, q.lat, q.lng);
            return acc + (d <= nearbyRadiusKm ? 1 : 0);
        }, 0);
    }, [userLoc, nearbyRadiusKm, ALL_QUESTS]);

    const cityQuestCountById = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const city of citiesWithNearby) {
            counts[city.id] = city.id === NEARBY_ID ? nearbyCount : (CITY_QUESTS[city.id]?.length || 0);
        }
        return counts;
    }, [citiesWithNearby, nearbyCount, CITY_QUESTS]);

    const visibleCities = useMemo(() => {
        if (cityQuickFilter === 'nearby') return filteredCities.filter((c) => c.id === NEARBY_ID);
        if (cityQuickFilter === 'withQuests') return filteredCities.filter((c) => cityQuestCountById[c.id] > 0);
        return filteredCities;
    }, [cityQuickFilter, filteredCities, cityQuestCountById]);

    const prioritizedCities = useMemo(() => {
        if (!selectedCityId) return visibleCities;
        const idx = visibleCities.findIndex((c) => c.id === selectedCityId);
        if (idx <= 0) return visibleCities;
        const sel = visibleCities[idx];
        return [sel, ...visibleCities.slice(0, idx), ...visibleCities.slice(idx + 1)];
    }, [visibleCities, selectedCityId]);

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

    const chunkArray = <T,>(arr: T[], cols: number): T[][] => {
        const res: T[][] = [];
        for (let i = 0; i < arr.length; i += cols) res.push(arr.slice(i, i + cols));
        return res;
    };
    const chunkedQuests = useMemo(() => chunkArray(questsAll, questColumns), [questsAll, questColumns]);

    // ── SEO ──
    const selectedCityName =
        selectedCityId === NEARBY_ID ? 'Рядом' : CITIES.find((c) => c.id === selectedCityId)?.name ?? null;
    const citiesWithQuestsCount = useMemo(
        () => CITIES.reduce((acc, city) => acc + ((CITY_QUESTS[city.id]?.length || 0) > 0 ? 1 : 0), 0),
        [CITIES, CITY_QUESTS],
    );

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
        if (selectedCityId === NEARBY_ID) return 'Офлайн-квесты рядом с вами. Выбирайте радиус и исследуйте парки и улицы поблизости.';
        if (selectedCityName) return `Офлайн-квесты в городе ${selectedCityName}. Прогулки по точкам, задания и маршруты.`;
        return 'Исследуйте города и парки с офлайн-квестами — приключения на карте рядом с вами.';
    }, [selectedCityId, selectedCityName]);

    // ── Shared filter props ──
    const filterProps = useMemo(() => ({
        selectedCityId,
        onSelectCity: handleSelectCity,
        citySearchQuery,
        onCitySearchChange: setCitySearchQuery,
        cityQuickFilter,
        onCityQuickFilterChange: setCityQuickFilter,
        nearbyRadiusKm,
        onRadiusChange: handleSetRadius,
        prioritizedCities,
        cityQuestCountById,
        citiesWithNearbyCount: citiesWithNearby.length,
        userLoc,
        dataLoaded,
        isMobile,
    }), [
        selectedCityId, handleSelectCity, citySearchQuery, cityQuickFilter,
        nearbyRadiusKm, handleSetRadius, prioritizedCities, cityQuestCountById,
        citiesWithNearby.length, userLoc, dataLoaded, isMobile,
    ]);

    // ── Render ──
    return (
        <View style={s.page}>
            {isFocused && (
                <InstantSEO headKey="quests-index" title={titleText} description={descText} canonical={buildCanonicalUrl('/quests')} ogType="website" />
            )}

            {/* Hidden h1 for SEO */}
            {Platform.OS === 'web' && (
                <h1 style={{
                    position: 'absolute' as const, width: 1, height: 1, padding: 0, margin: -1,
                    overflow: 'hidden' as const, clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0,
                } as any}>{titleText}</h1>
            )}

            {/* ── Hero (full width) ── */}
            <View style={sx(s.heroWrap, isMobile && s.heroWrapMobile)}>
                <View style={sx(s.hero, isMobile && s.heroMobile)}>
                    {isMobile ? (
                        <>
                            {/* Mobile: two rows */}
                            <View style={s.heroTopRow}>
                                <View style={sx(s.heroIconWrap, s.heroIconWrapMobile)}>
                                    <Feather name="compass" size={18} color={colors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={sx(s.title, s.titleMobile)}>Квесты</Text>
                                    <Text style={sx(s.subtitle, s.subtitleMobile)}>
                                        {dataLoaded
                                            ? `${ALL_QUESTS.length} квестов в ${CITIES.length} городах`
                                            : 'Приключения в городах'}
                                    </Text>
                                    {dataLoaded && (
                                        <View style={sx(s.heroStats, s.heroStatsMobile)}>
                                            <View style={s.heroStatCard}>
                                                <Text style={s.heroStatLabel}>Квестов</Text>
                                                <Text style={s.heroStatValue}>{ALL_QUESTS.length}</Text>
                                            </View>
                                            <View style={s.heroStatCard}>
                                                <Text style={s.heroStatLabel}>Городов</Text>
                                                <Text style={s.heroStatValue}>{citiesWithQuestsCount}</Text>
                                            </View>
                                            <View style={s.heroStatCard}>
                                                <Text style={s.heroStatLabel}>Выбор</Text>
                                                <Text style={s.heroStatValue}>{selectedCityName || 'Не выбран'}</Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <View style={sx(s.heroBtns, s.heroBtnsMobile)}>
                                <Pressable
                                    onPress={() => setFilterDrawerOpen(true)}
                                    style={sx(s.actionBtn, s.actionBtnSecondary, s.actionBtnMobile)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Открыть фильтры"
                                >
                                    <Feather name="sliders" size={16} color={colors.text} />
                                    <Text style={sx(s.actionBtnTxt, s.actionBtnTxtSecondary)}>Фильтры</Text>
                                </Pressable>
                                <Link href="/quests/map" asChild>
                                    <Pressable style={sx(s.actionBtn, s.actionBtnMobile)}>
                                        <Feather name="map" size={16} color={colors.textOnPrimary} />
                                        <Text style={s.actionBtnTxt}>Карта</Text>
                                    </Pressable>
                                </Link>
                            </View>
                        </>
                    ) : (
                        <>
                            {/* Desktop: single row */}
                            <View style={s.heroIconWrap}>
                                <Feather name="compass" size={24} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.title}>Квесты</Text>
                                <Text style={s.subtitle}>
                                    {dataLoaded
                                        ? `${ALL_QUESTS.length} квестов в ${CITIES.length} городах`
                                        : 'Находи приключения в городах и парках'}
                                </Text>
                                {dataLoaded && (
                                    <View style={s.heroStats}>
                                        <View style={s.heroStatCard}>
                                            <Text style={s.heroStatLabel}>Городов с квестами</Text>
                                            <Text style={s.heroStatValue}>{citiesWithQuestsCount}</Text>
                                        </View>
                                        <View style={s.heroStatCard}>
                                            <Text style={s.heroStatLabel}>Сейчас в подборке</Text>
                                            <Text style={s.heroStatValue}>{questsAll.length}</Text>
                                        </View>
                                        <View style={s.heroStatCard}>
                                            <Text style={s.heroStatLabel}>Локация</Text>
                                            <Text style={s.heroStatValue}>{selectedCityName || 'Не выбрана'}</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                            <View style={s.heroBtns}>
                                <Link href="/quests/map" asChild>
                                    <Pressable style={s.actionBtn}>
                                        <Feather name="map" size={14} color={colors.textOnPrimary} />
                                        <Text style={s.actionBtnTxt}>Карта</Text>
                                    </Pressable>
                                </Link>
                            </View>
                        </>
                    )}
                </View>
            </View>

            {/* ── Body: sidebar + main ── */}
            <View style={sx(s.contentWrap, isMobile && s.contentWrapMobile)}>
                <View style={sx(s.contentRow, isMobile && s.contentRowMobile)}>
                    {/* Desktop sidebar */}
                    {isDesktop && (
                        <View style={s.sidePanel}>
                            <QuestsFilterContent {...filterProps} />
                        </View>
                    )}

                    {/* Main content area — quests grid */}
                    <View style={s.mainContent}>
                        <ScrollView
                            style={s.mainScroll}
                            contentContainerStyle={sx(s.mainScrollContent, isMobile && s.mainScrollContentMobile)}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Quest section header */}
                            {selectedCityId && dataLoaded && selectedCityName && (
                                <View style={s.sectionHeader}>
                                    <Text style={sx(s.sectionTitle, isMobile && s.sectionTitleMobile)} numberOfLines={1}>
                                        {selectedCityId === NEARBY_ID ? 'Квесты поблизости' : `Квесты: ${selectedCityName}`}
                                    </Text>
                                    <Text style={s.sectionMeta}>{questsAll.length} шт.</Text>
                                </View>
                            )}

                            {/* Nearby empty state */}
                            {selectedCityId === NEARBY_ID && userLoc && questsAll.length === 0 && dataLoaded ? (
                                <EmptyState
                                    icon="map-pin"
                                    title="Рядом ничего не найдено"
                                    description="Попробуйте увеличить радиус поиска."
                                    variant="empty"
                                    iconSize={48}
                                />
                            ) : null}

                            {/* No city selected */}
                            {!selectedCityId && dataLoaded ? (
                                <EmptyState
                                    icon="compass"
                                    title="Выберите локацию"
                                    description={isMobile
                                        ? 'Нажмите «Фильтры», чтобы выбрать город.'
                                        : 'Выберите город в панели слева, чтобы увидеть доступные квесты.'}
                                    variant="empty"
                                    iconSize={48}
                                />
                            ) : null}

                            {/* Skeleton loading */}
                            {!dataLoaded ? (
                                <View style={s.skeletonQuestsRow}>
                                    {Array.from({ length: isMobile ? 2 : 4 }).map((_, i) => (
                                        <SkeletonLoader key={i} width="100%" height={isMobile ? 180 : 220} borderRadius={radii.lg} />
                                    ))}
                                </View>
                            ) : (
                                /* Quest cards grid */
                                <View style={s.questsContainer}>
                                    {chunkedQuests.map((row, rowIndex) => (
                                        <View key={`quest-row-${rowIndex}`} style={sx(s.questsRow, isMobile && s.questsRowMobile)}>
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
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </View>

            {/* Mobile filter drawer */}
            {isMobile && (
                <QuestsFilterDrawer
                    visible={filterDrawerOpen}
                    onClose={() => setFilterDrawerOpen(false)}
                    {...filterProps}
                />
            )}
        </View>
    );
}

// ───────────── Quest card ─────────────

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
    const diffLabel = quest.difficulty ? DIFFICULTY_LABELS[quest.difficulty] : null;
    const iconColor = quest.cover ? colors.textOnDark : colors.textMuted;

    const metaRow = (
        <View style={sx(s.questMetaRow, isMobile && s.questMetaRowMobile)}>
            <View style={s.metaItem}>
                <Feather name="navigation" size={12} color={iconColor} />
                <Text style={sx(quest.cover ? s.metaText : s.metaTextAlt, isMobile && s.metaTextMobile)}>
                    {quest.points} точек
                </Text>
            </View>
            <View style={s.metaItem}>
                <Feather name="clock" size={12} color={iconColor} />
                <Text style={sx(quest.cover ? s.metaText : s.metaTextAlt, isMobile && s.metaTextMobile)}>{durationText}</Text>
            </View>
            {nearby && typeof quest._distanceKm === 'number' && (
                <View style={s.metaItem}>
                    <Feather name="map-pin" size={12} color={iconColor} />
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
            <Pressable
                style={({ hovered, pressed }) => sx(
                    s.questCard,
                    isMobile && s.questCardMobile,
                    hovered && s.questCardHover,
                    pressed && s.questCardPressed,
                )}
            >
                <View style={sx(s.coverWrap, isMobile && s.coverWrapMobile)}>
                    {quest.cover ? (
                        <Image
                            source={typeof quest.cover === 'string' ? { uri: quest.cover } : quest.cover}
                            style={s.questCover}
                            resizeMode="cover"
                        />
                    ) : <View style={s.coverFallback} />}

                    {diffLabel ? (
                        <View style={s.difficultyBadge}>
                            <Text style={s.difficultyText}>{diffLabel}</Text>
                        </View>
                    ) : null}
                    {quest.cover ? (
                        <View style={sx(s.coverOverlay, isMobile && s.coverOverlayMobile)}>
                            {metaRow}
                        </View>
                    ) : null}
                </View>

                <View style={sx(s.questBody, isMobile && s.questBodyMobile)}>
                    <Text style={sx(s.questTitle, isMobile && s.questTitleMobile)} numberOfLines={2}>
                        {quest.title}
                    </Text>
                    {!quest.cover ? metaRow : null}
                    <View style={s.questFooter}>
                        <Text style={s.questFooterText}>Открыть квест</Text>
                        <Feather name="arrow-right" size={14} color={colors.primaryText} />
                    </View>
                </View>
            </Pressable>
        </Link>
    );
}
