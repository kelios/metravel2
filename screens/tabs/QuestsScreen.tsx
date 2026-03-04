// src/screens/tabs/QuestsScreen.tsx
// Redesigned: Modern minimalist UI with horizontal city filters
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Pressable, Platform,
    Image, ScrollView, TextInput,
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

const DIFFICULTY_LABELS: Record<string, string> = {
    easy: 'Лёгкий',
    medium: 'Средний',
    hard: 'Сложный',
};

// ───────────── Styles (Redesigned) ─────────────

function getStyles(colors: ThemedColors, screenWidth: number) {
    const isMobileW = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;
    
    return StyleSheet.create({
        page: { 
            flex: 1, 
            backgroundColor: colors.background,
        },

        /* ---- Hero (Minimalist) ---- */
        heroSection: {
            width: '100%',
            paddingTop: isMobileW ? spacing.lg : spacing.xl,
            paddingBottom: isMobileW ? spacing.md : spacing.lg,
            paddingHorizontal: isMobileW ? spacing.md : spacing.xl,
            backgroundColor: colors.background,
        },
        heroInner: {
            maxWidth: 1200,
            alignSelf: 'center',
            width: '100%',
        },
        heroTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
            flexWrap: 'wrap',
        },
        heroTitleBlock: {
            flex: 1,
            minWidth: 200,
        },
        title: {
            color: colors.text,
            fontSize: isMobileW ? 28 : 36,
            fontWeight: '700',
            letterSpacing: -0.5,
            lineHeight: isMobileW ? 34 : 44,
        },
        subtitle: {
            color: colors.textMuted,
            fontSize: typography.sizes.md,
            marginTop: spacing.xs,
            lineHeight: 24,
            maxWidth: 480,
        },
        heroActions: {
            flexDirection: 'row',
            gap: spacing.sm,
            alignItems: 'center',
        },
        actionBtn: {
            flexDirection: 'row',
            gap: spacing.xs,
            backgroundColor: colors.primary,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radii.lg,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            ...Platform.select({
                web: {
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                } as any,
            }),
        },
        actionBtnSecondary: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
        actionBtnText: {
            color: colors.textOnPrimary,
            fontWeight: '600',
            fontSize: typography.sizes.sm,
        },
        actionBtnTextSecondary: {
            color: colors.text,
        },

        /* ---- Filters Bar (Horizontal) ---- */
        filtersSection: {
            width: '100%',
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight,
            ...Platform.select({
                web: {
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                } as any,
            }),
        },
        filtersInner: {
            maxWidth: 1200,
            alignSelf: 'center',
            width: '100%',
            paddingHorizontal: isMobileW ? spacing.md : spacing.xl,
            paddingVertical: spacing.sm,
        },
        filtersRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        searchWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.backgroundSecondary,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.sm,
            height: 40,
            minWidth: isMobileW ? 120 : 180,
            maxWidth: isMobileW ? 160 : 220,
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
        searchInput: {
            flex: 1,
            height: '100%',
            color: colors.text,
            fontSize: typography.sizes.sm,
            marginLeft: spacing.xs,
            ...Platform.select({ web: { outlineStyle: 'none' } as any }),
        },
        cityChipsScroll: {
            flex: 1,
        },
        cityChipsContent: {
            flexDirection: 'row',
            gap: spacing.xs,
            paddingRight: spacing.md,
        },
        cityChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xxs,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...Platform.select({
                web: {
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                } as any,
            }),
        },
        cityChipActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        cityChipText: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '500',
        },
        cityChipTextActive: {
            color: colors.textOnPrimary,
        },
        cityChipCount: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        cityChipCountActive: {
            color: colors.textOnPrimary,
            opacity: 0.8,
        },

        /* ---- Main Content ---- */
        contentSection: {
            flex: 1,
            width: '100%',
        },
        contentInner: {
            maxWidth: 1200,
            alignSelf: 'center',
            width: '100%',
            paddingHorizontal: isMobileW ? spacing.md : spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxxl,
        },

        /* ---- Section Header ---- */
        sectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.lg,
        },
        sectionTitle: {
            color: colors.text,
            fontSize: typography.sizes.lg,
            fontWeight: '600',
            letterSpacing: -0.3,
        },
        sectionCount: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            fontWeight: '500',
        },

        /* ---- Quests Grid ---- */
        questsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: isMobileW ? spacing.md : spacing.lg,
        },

        /* ---- Quest Card (Clean Design) ---- */
        questCard: {
            width: isMobileW ? '100%' : isTablet ? 'calc(50% - 12px)' : 'calc(33.333% - 16px)',
            borderRadius: radii.lg,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            ...Platform.select({
                web: {
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                } as any,
                android: { elevation: 2 },
                default: {},
            }),
        },
        questCardHover: {
            ...Platform.select({
                web: {
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    transform: 'translateY(-2px)',
                } as any,
            }),
        },
        questCardPressed: {
            ...Platform.select({
                web: {
                    transform: 'scale(0.98)',
                } as any,
            }),
        },
        coverWrap: {
            width: '100%',
            aspectRatio: 16 / 10,
            position: 'relative',
            backgroundColor: colors.backgroundTertiary,
        },
        questCover: {
            width: '100%',
            height: '100%',
        },
        coverFallback: {
            flex: 1,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        coverGradient: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '60%',
            ...Platform.select({
                web: {
                    backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)',
                } as any,
                default: { backgroundColor: 'transparent' },
            }),
        },
        difficultyBadge: {
            position: 'absolute',
            top: spacing.sm,
            left: spacing.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xxs,
            borderRadius: radii.sm,
        },
        difficultyBadgeEasy: { backgroundColor: 'rgba(34,197,94,0.9)' },
        difficultyBadgeMedium: { backgroundColor: 'rgba(245,158,11,0.9)' },
        difficultyBadgeHard: { backgroundColor: 'rgba(239,68,68,0.9)' },
        difficultyBadgeDefault: { backgroundColor: 'rgba(0,0,0,0.5)' },
        difficultyText: {
            color: '#fff',
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.3,
        },
        questCardBody: {
            padding: spacing.md,
        },
        questTitle: {
            color: colors.text,
            fontSize: typography.sizes.md,
            fontWeight: '600',
            lineHeight: 22,
            marginBottom: spacing.xs,
        },
        questMeta: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
        },
        questMetaItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xxs,
        },
        questMetaText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '500',
        },

        /* ---- Skeleton ---- */
        skeletonGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: isMobileW ? spacing.md : spacing.lg,
        },
        skeletonCard: {
            width: isMobileW ? '100%' : isTablet ? 'calc(50% - 12px)' : 'calc(33.333% - 16px)',
        },

        /* ---- Radius selector ---- */
        radiusSection: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingTop: spacing.xs,
        },
        radiusChip: {
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xxs,
            borderRadius: radii.sm,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
        radiusChipActive: {
            backgroundColor: colors.primarySoft,
            borderColor: colors.primary,
        },
        radiusChipText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        radiusChipTextActive: {
            color: colors.primaryText,
        },
    });
}

type QuestStyles = ReturnType<typeof getStyles>;

// ───────────── Main screen (Redesigned) ─────────────

export default function QuestsScreen() {
    const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number>(DEFAULT_NEARBY_RADIUS_KM);
    const [citySearchQuery, setCitySearchQuery] = useState('');
    const cityChipsScrollRef = useRef<ScrollView>(null);

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
    const s = useMemo(() => getStyles(colors, width), [colors, width]);

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

    // Filter to show only cities with quests (plus Nearby always visible)
    const visibleCities = useMemo(() => {
        return filteredCities.filter((c) => c.id === NEARBY_ID || cityQuestCountById[c.id] > 0);
    }, [filteredCities, cityQuestCountById]);

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

    // ── SEO ──
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
        if (selectedCityId === NEARBY_ID) return 'Офлайн-квесты рядом с вами. Выбирайте радиус и исследуйте парки и улицы поблизости.';
        if (selectedCityName) return `Офлайн-квесты в городе ${selectedCityName}. Прогулки по точкам, задания и маршруты.`;
        return 'Исследуйте города и парки с офлайн-квестами — приключения на карте рядом с вами.';
    }, [selectedCityId, selectedCityName]);

    // ── Render (Redesigned) ──
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

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Hero (Minimalist) ── */}
                <View style={s.heroSection}>
                    <View style={s.heroInner}>
                        <View style={s.heroTitleRow}>
                            <View style={s.heroTitleBlock}>
                                <Text style={s.title}>Квесты</Text>
                                <Text style={s.subtitle}>
                                    Исследуй города, решай загадки и открывай новые места
                                </Text>
                            </View>
                            <View style={s.heroActions}>
                                <Link href="/quests/map" asChild>
                                    <Pressable style={s.actionBtn} accessibilityRole="button" accessibilityLabel="Открыть карту квестов">
                                        <Feather name="map" size={16} color={colors.textOnPrimary} />
                                        <Text style={s.actionBtnText}>Карта</Text>
                                    </Pressable>
                                </Link>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ── Filters Bar (Horizontal) ── */}
                <View style={s.filtersSection}>
                    <View style={s.filtersInner}>
                        <View style={s.filtersRow}>
                            {/* Search */}
                            <View style={s.searchWrap}>
                                <Feather name="search" size={16} color={colors.textMuted} />
                                <TextInput
                                    value={citySearchQuery}
                                    onChangeText={setCitySearchQuery}
                                    placeholder="Поиск..."
                                    placeholderTextColor={colors.textMuted}
                                    style={s.searchInput}
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* City chips */}
                            <ScrollView
                                ref={cityChipsScrollRef}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={s.cityChipsScroll}
                                contentContainerStyle={s.cityChipsContent}
                            >
                                {visibleCities.map((city) => {
                                    const isActive = selectedCityId === city.id;
                                    const count = cityQuestCountById[city.id] || 0;
                                    const isNearby = city.id === NEARBY_ID;
                                    return (
                                        <Pressable
                                            key={city.id}
                                            onPress={() => handleSelectCity(city.id)}
                                            style={[s.cityChip, isActive && s.cityChipActive]}
                                            accessibilityRole="button"
                                            accessibilityLabel={`${isNearby ? 'Рядом' : city.name}, ${count} квестов`}
                                            accessibilityState={{ selected: isActive }}
                                        >
                                            {isNearby && (
                                                <Feather
                                                    name="navigation"
                                                    size={14}
                                                    color={isActive ? colors.textOnPrimary : colors.textMuted}
                                                />
                                            )}
                                            <Text style={[s.cityChipText, isActive && s.cityChipTextActive]}>
                                                {isNearby ? 'Рядом' : city.name}
                                            </Text>
                                            {count > 0 && (
                                                <Text style={[s.cityChipCount, isActive && s.cityChipCountActive]}>
                                                    {count}
                                                </Text>
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Radius selector for Nearby */}
                        {selectedCityId === NEARBY_ID && (
                            <View style={s.radiusSection}>
                                <Text style={{ color: colors.textMuted, fontSize: 12, marginRight: spacing.xs }}>Радиус:</Text>
                                {[5, 10, 15, 20, 30].map((km) => (
                                    <Pressable
                                        key={km}
                                        onPress={() => handleSetRadius(km)}
                                        style={[s.radiusChip, nearbyRadiusKm === km && s.radiusChipActive]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Радиус ${km} км`}
                                    >
                                        <Text style={[s.radiusChipText, nearbyRadiusKm === km && s.radiusChipTextActive]}>
                                            {km} км
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </View>
                </View>

                {/* ── Main Content ── */}
                <View style={s.contentSection}>
                    <View style={s.contentInner}>
                        {/* Section header */}
                        {selectedCityId && dataLoaded && (
                            <View style={s.sectionHeader}>
                                <Text style={s.sectionTitle}>
                                    {selectedCityId === NEARBY_ID ? 'Квесты поблизости' : selectedCityName}
                                </Text>
                                <Text style={s.sectionCount}>{questsAll.length} квестов</Text>
                            </View>
                        )}

                        {/* Empty states */}
                        {selectedCityId === NEARBY_ID && userLoc && questsAll.length === 0 && dataLoaded && (
                            <EmptyState
                                icon="map-pin"
                                title="Рядом ничего не найдено"
                                description="Попробуйте увеличить радиус поиска"
                                variant="empty"
                                iconSize={48}
                            />
                        )}

                        {selectedCityId === NEARBY_ID && !userLoc && dataLoaded && (
                            <EmptyState
                                icon="navigation"
                                title="Геолокация отключена"
                                description="Разрешите доступ к геолокации для поиска квестов рядом"
                                variant="empty"
                                iconSize={48}
                            />
                        )}

                        {!selectedCityId && dataLoaded && (
                            <EmptyState
                                icon="compass"
                                title="Выберите город"
                                description="Выберите город из списка выше, чтобы увидеть доступные квесты"
                                variant="empty"
                                iconSize={48}
                            />
                        )}

                        {/* Skeleton loading */}
                        {!dataLoaded && (
                            <View style={s.skeletonGrid}>
                                {Array.from({ length: isMobile ? 2 : 6 }).map((_, i) => (
                                    <View key={i} style={s.skeletonCard}>
                                        <SkeletonLoader width="100%" height={isMobile ? 200 : 240} borderRadius={radii.lg} />
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Quest cards grid */}
                        {dataLoaded && questsAll.length > 0 && (
                            <View style={s.questsGrid}>
                                {questsAll.map((quest) => (
                                    <QuestCard
                                        key={quest.id}
                                        cityId={selectedCityId === NEARBY_ID ? (quest.cityId || '') : (selectedCityId || '')}
                                        quest={quest}
                                        nearby={selectedCityId === NEARBY_ID}
                                        s={s}
                                        colors={colors}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

// ───────────────── Quest card (Redesigned) ─────────────────

function QuestCard({
    cityId, quest, nearby, s, colors,
}: {
    cityId: string;
    quest: QuestMeta & { _distanceKm?: number };
    nearby?: boolean;
    s: QuestStyles;
    colors: ThemedColors;
}) {
    const durationText = quest.durationMin ? `${Math.round((quest.durationMin ?? 60) / 5) * 5} мин` : '1–2 ч';
    const diffLabel = quest.difficulty ? DIFFICULTY_LABELS[quest.difficulty] : null;
    const diffBadgeStyle = quest.difficulty === 'easy' ? s.difficultyBadgeEasy
        : quest.difficulty === 'medium' ? s.difficultyBadgeMedium
        : quest.difficulty === 'hard' ? s.difficultyBadgeHard
        : s.difficultyBadgeDefault;

    return (
        <Link href={`/quests/${cityId}/${quest.id}`} asChild>
            <Pressable
                style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
                    s.questCard,
                    hovered && s.questCardHover,
                    pressed && s.questCardPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Квест: ${quest.title}`}
            >
                {/* Cover */}
                <View style={s.coverWrap}>
                    {quest.cover ? (
                        <Image
                            source={typeof quest.cover === 'string' ? { uri: quest.cover } : quest.cover}
                            style={s.questCover}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={s.coverFallback}>
                            <Feather name="compass" size={32} color={colors.border} />
                        </View>
                    )}

                    {/* Gradient */}
                    {quest.cover && <View style={s.coverGradient} />}

                    {/* Difficulty badge */}
                    {diffLabel && (
                        <View style={[s.difficultyBadge, diffBadgeStyle]}>
                            <Text style={s.difficultyText}>{diffLabel}</Text>
                        </View>
                    )}
                </View>

                {/* Card body */}
                <View style={s.questCardBody}>
                    <Text style={s.questTitle} numberOfLines={2}>
                        {quest.title}
                    </Text>
                    <View style={s.questMeta}>
                        <View style={s.questMetaItem}>
                            <Feather name="navigation" size={12} color={colors.textMuted} />
                            <Text style={s.questMetaText}>{quest.points} точек</Text>
                        </View>
                        <View style={s.questMetaItem}>
                            <Feather name="clock" size={12} color={colors.textMuted} />
                            <Text style={s.questMetaText}>{durationText}</Text>
                        </View>
                        {nearby && typeof quest._distanceKm === 'number' && (
                            <View style={s.questMetaItem}>
                                <Feather name="map-pin" size={12} color={colors.textMuted} />
                                <Text style={s.questMetaText}>
                                    {quest._distanceKm < 1
                                        ? `${Math.round(quest._distanceKm * 1000)} м`
                                        : `${quest._distanceKm.toFixed(1)} км`}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Pressable>
        </Link>
    );
}
