// src/screens/tabs/QuestsScreen.tsx
// Redesigned: Two-column layout like search page
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, Platform,
    Image, ScrollView,
    ViewStyle, TextStyle,
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
type City = { id: string; name: string; countryCode?: string; lat?: number; lng?: number };
type NearbyCity = City & { isNearby: true };

const COUNTRY_NAMES: Record<string, string> = {
    BY: 'Беларусь',
    PL: 'Польша',
    AM: 'Армения',
    RU: 'Россия',
    UA: 'Украина',
    LT: 'Литва',
    LV: 'Латвия',
    EE: 'Эстония',
    GE: 'Грузия',
};
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

const { spacing, radii, typography, shadows } = DESIGN_TOKENS;

const DIFFICULTY_LABELS: Record<string, string> = {
    easy: 'Лёгкий',
    medium: 'Средний',
    hard: 'Сложный',
};

// ───────────── Styles (Two-column layout) ─────────────

function getStyles(colors: ThemedColors, screenWidth: number) {
    const isMobileW = screenWidth < 768;
    const SIDEBAR_WIDTH = 320;
    
    return StyleSheet.create({
        /* ---- Root Layout (Two-column) ---- */
        root: {
            flex: 1,
            backgroundColor: colors.background,
            flexDirection: isMobileW ? 'column' : 'row',
            ...Platform.select({
                web: { minHeight: '100vh' } as any,
            }),
        },

        /* ---- Left Sidebar ---- */
        sidebar: {
            width: isMobileW ? '100%' : SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRightWidth: isMobileW ? 0 : 1,
            borderRightColor: colors.border,
            backgroundColor: colors.surface,
            ...Platform.select({
                web: {
                    overflowY: 'auto',
                    maxHeight: isMobileW ? 'auto' : '100vh',
                    position: isMobileW ? 'relative' : 'sticky',
                    top: 0,
                } as any,
            }),
        },
        sidebarHeader: {
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight,
        },
        sidebarTitle: {
            color: colors.text,
            fontSize: typography.sizes.xl,
            fontWeight: '700',
            marginBottom: spacing.xs,
        },
        sidebarSubtitle: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            lineHeight: 20,
        },
        sidebarActions: {
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: spacing.md,
        },
        actionBtn: {
            flexDirection: 'row',
            gap: spacing.xs,
            backgroundColor: colors.primary,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.md,
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            ...Platform.select({
                web: { cursor: 'pointer', transition: 'all 0.15s ease' } as any,
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

        /* ---- City List ---- */
        cityListSection: {
            padding: spacing.md,
        },
        cityListLabel: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
            paddingHorizontal: spacing.xs,
        },
        countryLabel: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            marginBottom: spacing.sm,
            paddingHorizontal: spacing.xs,
        },
        cityItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
            borderRadius: radii.md,
            marginBottom: spacing.xxs,
            ...Platform.select({
                web: { cursor: 'pointer', transition: 'all 0.15s ease' } as any,
            }),
        },
        cityItemActive: {
            backgroundColor: colors.primarySoft,
        },
        cityItemLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            flex: 1,
        },
        cityItemIcon: {
            width: 32,
            height: 32,
            borderRadius: radii.sm,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        cityItemIconActive: {
            backgroundColor: colors.primary,
        },
        cityItemText: {
            color: colors.text,
            fontSize: typography.sizes.md,
            fontWeight: '500',
        },
        cityItemTextActive: {
            color: colors.primary,
            fontWeight: '600',
        },
        cityItemCount: {
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xxs,
            borderRadius: radii.full,
            minWidth: 28,
            alignItems: 'center',
        },
        cityItemCountActive: {
            backgroundColor: colors.primary,
        },
        cityItemCountText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        cityItemCountTextActive: {
            color: colors.textOnPrimary,
        },

        /* ---- Radius selector ---- */
        radiusSection: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
        },
        radiusLabel: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            marginRight: spacing.xs,
        },
        radiusChip: {
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xxs,
            borderRadius: radii.sm,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...Platform.select({
                web: { cursor: 'pointer' } as any,
            }),
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

        /* ---- Right Content ---- */
        content: {
            flex: 1,
            ...Platform.select({
                web: { overflowY: 'auto' } as any,
            }),
        },
        contentHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight,
            backgroundColor: colors.background,
            ...Platform.select({
                web: { position: 'sticky', top: 0, zIndex: 10 } as any,
            }),
        },
        contentTitle: {
            color: colors.text,
            fontSize: typography.sizes.xl,
            fontWeight: '600',
        },
        contentCount: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
        },
        contentBody: {
            padding: spacing.lg,
        },

        /* ---- Quests Grid ---- */
        questsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.lg,
        },

        /* ---- Quest Card ---- */
        questCard: {
            width: isMobileW ? '100%' : 'calc(50% - 12px)',
            minWidth: isMobileW ? undefined : 320,
            borderRadius: radii.lg,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            ...Platform.select({
                web: {
                    boxShadow: shadows.light,
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                } as any,
                android: { elevation: 2 },
            }),
        },
        questCardHover: {
            ...Platform.select({
                web: {
                    boxShadow: shadows.medium,
                    transform: 'translateY(-2px)',
                } as any,
            }),
        },
        questCardPressed: {
            ...Platform.select({
                web: { transform: 'scale(0.98)' } as any,
            }),
        },
        coverWrap: {
            width: '100%',
            aspectRatio: 3 / 2,
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
            height: '50%',
            ...Platform.select({
                web: {
                    backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)',
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
            flexWrap: 'wrap',
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
            gap: spacing.lg,
        },
        skeletonCard: {
            width: isMobileW ? '100%' : 'calc(50% - 12px)',
            minWidth: isMobileW ? undefined : 320,
        },

        /* ---- Mobile filter toggle ---- */
        mobileFilterBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...Platform.select({
                web: { cursor: 'pointer' } as any,
            }),
        },
        mobileFilterBtnText: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '500',
        },

        /* ---- Mobile sidebar overlay ---- */
        sidebarOverlay: {
            ...Platform.select({
                web: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    zIndex: 999,
                } as any,
            }),
        },
        sidebarMobile: {
            ...Platform.select({
                web: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: 320,
                    maxWidth: '85vw',
                    zIndex: 1000,
                } as any,
            }),
        },
    });
}

type QuestStyles = ReturnType<typeof getStyles>;

// ───────────── Main screen (Redesigned) ─────────────

export default function QuestsScreen() {
    const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number>(DEFAULT_NEARBY_RADIUS_KM);
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

    // API data
    const { quests: ALL_QUESTS, cityQuestsIndex: CITY_QUESTS, loading: questsLoading } = useQuestsList();
    const { cities: apiCities, loading: citiesLoading } = useQuestCities();
    const dataLoaded = !questsLoading && !citiesLoading;
    const CITIES = useMemo<City[]>(() => apiCities.map(c => ({
        id: c.id, name: c.name, lat: c.lat, lng: c.lng, countryCode: c.countryCode,
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

    // Auto-detect nearest city by geolocation on first load (if no saved city)
    const [geoAutoDetectDone, setGeoAutoDetectDone] = useState(false);
    useEffect(() => {
        if (!dataLoaded || !CITIES.length || geoAutoDetectDone) return;
        if (selectedCityId) {
            // User has a saved city, skip auto-detect
            setGeoAutoDetectDone(true);
            return;
        }
        
        let cancelled = false;
        (async () => {
            try {
                // Check if we already have permission (don't prompt on first load)
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status !== 'granted' || cancelled) {
                    // No permission, fall back to first city
                    if (!cancelled) {
                        setGeoAutoDetectDone(true);
                        void handleSelectCity(CITIES[0]?.id ?? '');
                    }
                    return;
                }
                
                // Get current position
                const pos = await Location.getCurrentPositionAsync({
                    accuracy: Location.LocationAccuracy.Balanced,
                });
                if (cancelled) return;
                
                const userLat = pos.coords.latitude;
                const userLng = pos.coords.longitude;
                
                // Find nearest city
                let nearestCity = CITIES[0];
                let minDist = Infinity;
                for (const city of CITIES) {
                    if (!city.lat || !city.lng) continue;
                    const dist = haversineKm(userLat, userLng, city.lat, city.lng);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestCity = city;
                    }
                }
                
                if (!cancelled && nearestCity) {
                    setGeoAutoDetectDone(true);
                    void handleSelectCity(nearestCity.id);
                }
            } catch {
                // Fallback to first city on error
                if (!cancelled) {
                    setGeoAutoDetectDone(true);
                    void handleSelectCity(CITIES[0]?.id ?? '');
                }
            }
        })();
        return () => { cancelled = true; };
    }, [CITIES, dataLoaded, geoAutoDetectDone, handleSelectCity, selectedCityId]);

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
        return citiesWithNearby;
    }, [citiesWithNearby]);

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

    // Group cities by country
    const citiesByCountry = useMemo(() => {
        const groups: Record<string, (City | NearbyCity)[]> = {};
        for (const city of visibleCities) {
            if (city.id === NEARBY_ID) continue; // Nearby handled separately
            const code = (city as City).countryCode || 'OTHER';
            (groups[code] ||= []).push(city);
        }
        // Sort countries: BY first, then alphabetically, OTHER last
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (a === 'BY') return -1;
            if (b === 'BY') return 1;
            if (a === 'OTHER') return 1;
            if (b === 'OTHER') return -1;
            return (COUNTRY_NAMES[a] || a).localeCompare(COUNTRY_NAMES[b] || b, 'ru');
        });
        return sortedKeys.map(code => ({
            code,
            name: COUNTRY_NAMES[code] || (code === 'OTHER' ? '' : code),
            cities: groups[code],
        }));
    }, [visibleCities]);

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

    // ── Sidebar content (reusable for mobile drawer) ──
    const renderSidebar = () => (
        <View style={s.sidebar as ViewStyle}>
            {/* Header */}
            <View style={s.sidebarHeader as ViewStyle}>
                <Text style={s.sidebarTitle as TextStyle}>Квесты</Text>
                <Text style={s.sidebarSubtitle as TextStyle}>
                    Исследуй города через загадки и приключения
                </Text>
                <View style={s.sidebarActions as ViewStyle}>
                    <Link href="/quests/map" asChild>
                        <Pressable style={s.actionBtn as ViewStyle} accessibilityRole="button">
                            <Feather name="map" size={16} color={colors.textOnPrimary} />
                            <Text style={s.actionBtnText as TextStyle}>На карте</Text>
                        </Pressable>
                    </Link>
                </View>
            </View>

            {/* Nearby option */}
            <View style={s.cityListSection as ViewStyle}>
                <Pressable
                    onPress={() => handleSelectCity(NEARBY_ID)}
                    style={[s.cityItem as ViewStyle, selectedCityId === NEARBY_ID && (s.cityItemActive as ViewStyle)]}
                    accessibilityRole="button"
                    accessibilityLabel={`Рядом, ${cityQuestCountById[NEARBY_ID] || 0} квестов`}
                    accessibilityState={{ selected: selectedCityId === NEARBY_ID }}
                >
                    <View style={s.cityItemLeft as ViewStyle}>
                        <View style={[s.cityItemIcon as ViewStyle, selectedCityId === NEARBY_ID && (s.cityItemIconActive as ViewStyle)]}>
                            <Feather name="navigation" size={16} color={selectedCityId === NEARBY_ID ? colors.textOnPrimary : colors.textMuted} />
                        </View>
                        <Text style={[s.cityItemText as TextStyle, selectedCityId === NEARBY_ID && (s.cityItemTextActive as TextStyle)]}>
                            Рядом
                        </Text>
                    </View>
                </Pressable>
            </View>

            {/* Cities grouped by country */}
            {citiesByCountry.map((group) => (
                <View key={group.code} style={s.cityListSection as ViewStyle}>
                    {group.name ? <Text style={s.countryLabel as TextStyle}>{group.name}</Text> : null}
                    {group.cities.map((city) => {
                        const isActive = selectedCityId === city.id;
                        const count = cityQuestCountById[city.id] || 0;
                        return (
                            <Pressable
                                key={city.id}
                                onPress={() => handleSelectCity(city.id)}
                                style={[s.cityItem as ViewStyle, isActive && (s.cityItemActive as ViewStyle)]}
                                accessibilityRole="button"
                                accessibilityLabel={`${city.name}, ${count} квестов`}
                                accessibilityState={{ selected: isActive }}
                            >
                                <View style={s.cityItemLeft as ViewStyle}>
                                    <View style={[s.cityItemIcon as ViewStyle, isActive && (s.cityItemIconActive as ViewStyle)]}>
                                        <Feather name="map-pin" size={16} color={isActive ? colors.textOnPrimary : colors.textMuted} />
                                    </View>
                                    <Text style={[s.cityItemText as TextStyle, isActive && (s.cityItemTextActive as TextStyle)]}>
                                        {city.name}
                                    </Text>
                                </View>
                                {count > 0 && (
                                    <View style={[s.cityItemCount as ViewStyle, isActive && (s.cityItemCountActive as ViewStyle)]}>
                                        <Text style={[s.cityItemCountText as TextStyle, isActive && (s.cityItemCountTextActive as TextStyle)]}>
                                            {count}
                                        </Text>
                                    </View>
                                )}
                            </Pressable>
                        );
                    })}
                </View>
            ))}

            {/* Radius selector for Nearby */}
            {selectedCityId === NEARBY_ID && (
                <View style={s.radiusSection as ViewStyle}>
                    <Text style={s.radiusLabel as TextStyle}>Радиус:</Text>
                    {[5, 10, 15, 20, 30].map((km) => (
                        <Pressable
                            key={km}
                            onPress={() => handleSetRadius(km)}
                            style={[s.radiusChip as ViewStyle, nearbyRadiusKm === km && (s.radiusChipActive as ViewStyle)]}
                            accessibilityRole="button"
                            accessibilityLabel={`Радиус ${km} км`}
                        >
                            <Text style={[s.radiusChipText as TextStyle, nearbyRadiusKm === km && (s.radiusChipTextActive as TextStyle)]}>
                                {km} км
                            </Text>
                        </Pressable>
                    ))}
                </View>
            )}
        </View>
    );

    // ── Render (Two-column layout) ──
    return (
        <View style={s.root as ViewStyle}>
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

            {/* Mobile: Filter drawer overlay */}
            {isMobile && filterDrawerOpen && (
                <>
                    <Pressable
                        style={s.sidebarOverlay as ViewStyle}
                        onPress={() => setFilterDrawerOpen(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Закрыть меню"
                    />
                    <View style={[s.sidebar as ViewStyle, s.sidebarMobile as ViewStyle]}>
                        {renderSidebar()}
                    </View>
                </>
            )}

            {/* Desktop: Sidebar always visible */}
            {!isMobile && renderSidebar()}

            {/* Right content */}
            <ScrollView
                style={s.content as ViewStyle}
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Content header */}
                <View style={s.contentHeader as ViewStyle}>
                    <View>
                        <Text style={s.contentTitle as TextStyle}>
                            {selectedCityId === NEARBY_ID ? 'Квесты поблизости' : selectedCityName || 'Все квесты'}
                        </Text>
                        {dataLoaded && <Text style={s.contentCount as TextStyle}>{questsAll.length} квестов</Text>}
                    </View>
                    {isMobile && (
                        <Pressable
                            style={s.mobileFilterBtn as ViewStyle}
                            onPress={() => setFilterDrawerOpen(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Выбрать город"
                        >
                            <Feather name="filter" size={16} color={colors.text} />
                            <Text style={s.mobileFilterBtnText as TextStyle}>Город</Text>
                        </Pressable>
                    )}
                </View>

                {/* Content body */}
                <View style={s.contentBody as ViewStyle}>
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
                            description="Разрешите доступ к геолокации в настройках браузера"
                            variant="empty"
                            iconSize={48}
                        />
                    )}

                    {!selectedCityId && dataLoaded && (
                        <EmptyState
                            icon="compass"
                            title="Выберите город"
                            description={isMobile ? 'Нажмите «Город» чтобы выбрать' : 'Выберите город из списка слева'}
                            variant="empty"
                            iconSize={48}
                        />
                    )}

                    {/* Skeleton loading */}
                    {!dataLoaded && (
                        <View style={s.skeletonGrid as ViewStyle}>
                            {Array.from({ length: isMobile ? 2 : 4 }).map((_, i) => (
                                <View key={i} style={s.skeletonCard as ViewStyle}>
                                    <SkeletonLoader width="100%" height={180} borderRadius={radii.lg} />
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Quest cards grid */}
                    {dataLoaded && questsAll.length > 0 && (
                        <View style={s.questsGrid as ViewStyle}>
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
