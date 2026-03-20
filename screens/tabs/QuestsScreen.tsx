// src/screens/tabs/QuestsScreen.tsx
// Redesigned: Two-column layout like search page
import React, { Suspense, useMemo, useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Pressable, Platform,
    ScrollView, ActivityIndicator,
    ViewStyle, TextStyle,
} from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import EmptyState from '@/components/ui/EmptyState';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
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
    cityName?: string;
    countryName?: string;
    countryCode?: string;
};

const STORAGE_SELECTED_CITY = 'quests_selected_city';
const STORAGE_NEARBY_RADIUS = 'quests_nearby_radius_km';
const DEFAULT_NEARBY_RADIUS_KM = 15;
const NEARBY_ID = '__nearby__';

const { spacing, radii, typography } = DESIGN_TOKENS;

/** Склонение слова "квест" */
const pluralizeQuest = (n: number): string => {
    const abs = Math.abs(n) % 100;
    const lastDigit = abs % 10;
    if (abs > 10 && abs < 20) return `${n} квестов`;
    if (lastDigit === 1) return `${n} квест`;
    if (lastDigit >= 2 && lastDigit <= 4) return `${n} квеста`;
    return `${n} квестов`;
};

const LazyQuestMap = React.lazy(() => import('@/components/MapPage/Map.web'));

type MapPoint = {
    id?: string | number;
    coord: string;
    address: string;
    travelImageThumbUrl: string;
    categoryName: string;
    articleUrl?: string;
    urlTravel?: string;
};

// ───────────── Styles (Two-column layout) ─────────────

function getStyles(colors: ThemedColors, screenWidth: number) {
    const isMobileW = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;
    const SIDEBAR_WIDTH = isTablet ? 300 : 340;
    const headerPadding = isMobileW ? spacing.md : spacing.lg;
    const headerTopPadding = isMobileW ? spacing.lg : spacing.xl;
    const sectionPaddingX = isMobileW ? spacing.sm : spacing.md;
    const sectionPaddingY = isMobileW ? spacing.xxs : spacing.xs;
    const countryGapTop = isMobileW ? spacing.xs : spacing.sm;
    const cityItemVertical = isMobileW ? spacing.xxs : spacing.xs;
    const cityIconSize = isMobileW ? 28 : 32;
    
    return StyleSheet.create({
        /* ---- Root Layout (Two-column, Premium) ---- */
        root: {
            flex: 1,
            backgroundColor: colors.background,
            flexDirection: isMobileW ? 'column' : 'row',
            ...Platform.select({
                web: { minHeight: '100vh' } as any,
            }),
        },

        /* ---- Left Sidebar (Premium, atmospheric) ---- */
        sidebar: {
            width: isMobileW ? '100%' : SIDEBAR_WIDTH,
            flexShrink: 0,
            flexDirection: 'column',
            borderRightWidth: 0,
            backgroundColor: colors.surface,
            ...Platform.select({
                web: {
                    overflowY: 'auto',
                    maxHeight: isMobileW ? 'auto' : '100vh',
                    position: isMobileW ? 'relative' : 'sticky',
                    top: 0,
                    boxShadow: '1px 0 0 0 rgba(0,0,0,0.04)',
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${colors.borderLight} transparent`,
                } as any,
            }),
        },
        sidebarScroll: {
            flex: 1,
            minHeight: 0,
        },
        sidebarHeader: {
            padding: headerPadding,
            paddingTop: headerTopPadding,
            paddingBottom: isMobileW ? spacing.md : spacing.lg,
            borderBottomWidth: 0,
            borderBottomColor: colors.borderLight,
            ...Platform.select({
                web: {
                    backgroundImage: `linear-gradient(180deg, ${colors.surface} 0%, rgba(255,255,255,0.98) 100%)`,
                } as any,
            }),
        },
        sidebarTitle: {
            color: colors.text,
            fontSize: isMobileW ? 20 : 26,
            fontWeight: '800',
            marginBottom: spacing.xxs,
            letterSpacing: -0.6,
            lineHeight: isMobileW ? 26 : 32,
        },
        sidebarSubtitle: {
            color: colors.textMuted,
            fontSize: isMobileW ? typography.sizes.xs : typography.sizes.sm,
            lineHeight: isMobileW ? 18 : 20,
            letterSpacing: -0.1,
            maxWidth: 280,
            fontWeight: '400',
        },
        sidebarActions: {
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: isMobileW ? spacing.sm : spacing.md,
        },
        actionBtn: {
            flexDirection: 'row',
            gap: spacing.xs,
            backgroundColor: colors.brand,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.full,
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            ...Platform.select({
                web: { 
                    cursor: 'pointer', 
                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: '0 4px 16px rgba(255, 146, 43, 0.3)',
                } as any,
            }),
        },
        actionBtnSecondary: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 0,
            ...Platform.select({
                web: { boxShadow: 'none' } as any,
            }),
        },
        actionBtnText: {
            color: colors.textOnPrimary,
            fontWeight: '600',
            fontSize: typography.sizes.sm,
        },
        actionBtnTextSecondary: {
            color: colors.text,
        },

        /* ---- City List (Premium, spacious) ---- */
        cityListSection: {
            paddingHorizontal: sectionPaddingX,
            paddingVertical: sectionPaddingY,
        },
        cityListLabel: {
            color: colors.textMuted,
            fontSize: 9,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 1.0,
            marginBottom: spacing.xs,
            paddingHorizontal: spacing.xs,
            opacity: 0.8,
        },
        countryLabel: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            letterSpacing: -0.2,
        },
        countryHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: countryGapTop,
            marginBottom: spacing.xxs,
            paddingHorizontal: spacing.xs,
            paddingVertical: spacing.xxs,
            borderRadius: radii.md,
            ...Platform.select({
                web: {
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                } as any,
            }),
        },
        countryHeaderActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
        },
        countryCount: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        countryToolsSection: {
            paddingHorizontal: sectionPaddingX,
            paddingTop: spacing.xs,
            paddingBottom: spacing.xs,
        },
        collapseAllBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: spacing.xxs,
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radii.full,
            ...Platform.select({
                web: {
                    cursor: 'pointer',
                    transition: 'opacity 0.2s ease',
                } as any,
            }),
        },
        collapseAllBtnText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            letterSpacing: 0.2,
        },
        cityItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: cityItemVertical,
            paddingHorizontal: isMobileW ? spacing.xs : spacing.sm,
            borderRadius: radii.md,
            marginBottom: 2,
            ...Platform.select({
                web: { 
                    cursor: 'pointer', 
                    transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                } as any,
            }),
        },
        cityItemActive: {
            backgroundColor: colors.brandSoft,
            ...Platform.select({
                web: {
                    boxShadow: `0 4px 16px ${colors.brandAlpha30}`,
                    transform: 'translateX(4px)',
                } as any,
            }),
        },
        cityItemLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            flex: 1,
        },
        cityItemIcon: {
            width: cityIconSize,
            height: cityIconSize,
            borderRadius: radii.md,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center',
            justifyContent: 'center',
            ...Platform.select({
                web: { transition: 'all 0.2s ease' } as any,
            }),
        },
        cityItemIconActive: {
            backgroundColor: colors.brand,
            ...Platform.select({
                web: {
                    boxShadow: '0 2px 8px rgba(255, 146, 43, 0.3)',
                } as any,
            }),
        },
        cityItemText: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '500',
            letterSpacing: -0.2,
        },
        cityItemTextActive: {
            color: colors.brandDark,
            fontWeight: '600',
        },
        cityItemCount: {
            backgroundColor: colors.backgroundTertiary,
            paddingHorizontal: spacing.xs,
            paddingVertical: 2,
            borderRadius: radii.full,
            minWidth: 24,
            alignItems: 'center',
        },
        cityItemCountActive: {
            backgroundColor: colors.brand,
            ...Platform.select({
                web: {
                    boxShadow: '0 1px 4px rgba(255, 146, 43, 0.3)',
                } as any,
            }),
        },
        cityItemCountText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        cityItemCountTextActive: {
            color: colors.textOnPrimary,
        },

        /* ---- Radius selector (Modern pill chips) ---- */
        radiusSection: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: spacing.xs,
            paddingHorizontal: sectionPaddingX,
            paddingBottom: spacing.sm,
            paddingTop: spacing.xs,
        },
        radiusLabel: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            fontWeight: '500',
            marginRight: spacing.xs,
        },
        radiusChip: {
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radii.full,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 0,
            minWidth: 48,
            minHeight: 30,
            alignItems: 'center',
            justifyContent: 'center',
            ...Platform.select({
                web: { 
                    cursor: 'pointer', 
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                } as any,
            }),
        },
        radiusChipActive: {
            backgroundColor: colors.brand,
            ...Platform.select({
                web: {
                    boxShadow: '0 2px 8px rgba(255, 146, 43, 0.3)',
                    transform: 'scale(1.02)',
                } as any,
            }),
        },
        radiusChipText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        radiusChipTextActive: {
            color: colors.textOnPrimary,
        },

        /* ---- Right Content (Premium, atmospheric) ---- */
        content: {
            flex: 1,
            backgroundColor: colors.background,
            ...Platform.select({
                web: { 
                    overflowY: 'auto',
                    scrollBehavior: 'smooth',
                } as any,
            }),
        },
        contentHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingHorizontal: headerPadding,
            paddingTop: isMobileW ? spacing.lg : spacing.xl,
            paddingBottom: isMobileW ? spacing.sm : spacing.md,
            borderBottomWidth: 0,
            borderBottomColor: colors.borderLight,
            backgroundColor: colors.background,
            ...Platform.select({
                web: { 
                    position: 'sticky', 
                    top: 0, 
                    zIndex: 10,
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    backgroundColor: 'rgba(253, 252, 251, 0.92)',
                } as any,
            }),
        },
        contentTitle: {
            color: colors.text,
            fontSize: isMobileW ? 20 : 28,
            fontWeight: '800',
            letterSpacing: -0.6,
            lineHeight: isMobileW ? 26 : 34,
        },
        contentCount: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            marginTop: 2,
            fontWeight: '500',
        },
        contentBody: {
            padding: isMobileW ? spacing.md : spacing.lg,
            paddingTop: isMobileW ? spacing.sm : spacing.md,
        },
        mapSection: {
            width: '100%',
        },
        mapContainer: {
            width: '100%',
            height: isMobileW ? 420 : 620,
            borderRadius: radii.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.borderLight,
            backgroundColor: colors.backgroundSecondary,
        },
        mapLoading: {
            width: '100%',
            height: isMobileW ? 420 : 620,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.borderLight,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
        },

        /* ---- Quests Grid (Modern responsive grid) ---- */
        questsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.lg,
            ...Platform.select({
                web: {
                    display: 'grid',
                    gridTemplateColumns: isMobileW
                        ? '1fr'
                        : 'repeat(auto-fit, minmax(min(100%, 760px), 1fr))',
                    justifyItems: 'start',
                    gap: spacing.xl,
                } as any,
            }),
        },

        /* ---- Skeleton ---- */
        skeletonGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.lg,
        },
        skeletonCard: {
            width: '100%',
            maxWidth: 600,
        },

        /* ---- Mobile filter toggle (Modern pill) ---- */
        mobileFilterBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.full,
            borderWidth: 0,
            ...Platform.select({
                web: { 
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                } as any,
            }),
        },
        mobileFilterBtnText: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '600',
        },

        /* ---- Mobile sidebar overlay (Smooth backdrop) ---- */
        sidebarOverlay: {
            ...Platform.select({
                web: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    zIndex: 999,
                    animationKeyframes: 'fadeIn',
                    animationDuration: '0.2s',
                    animationTimingFunction: 'ease',
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
                    width: 340,
                    maxWidth: '88vw',
                    zIndex: 1000,
                    boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
                    animationKeyframes: 'slideInLeft',
                    animationDuration: '0.25s',
                    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                } as any,
            }),
        },

        /* ---- Quest Card Styles (Modern, Atmospheric) ---- */
        questCard: {
            borderRadius: radii.xl,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            position: 'relative',
            ...Platform.select({
                web: {
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    cursor: 'pointer',
                    willChange: 'transform, box-shadow',
                } as any,
            }),
        },
        questCardHover: {
            ...Platform.select({
                web: {
                    transform: 'translateY(-6px)',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.12), 0 8px 20px rgba(255, 146, 43, 0.08)',
                } as any,
            }),
        },
        questCardImage: {
            width: '100%',
            height: isMobileW ? 220 : 260,
            position: 'relative',
            overflow: 'hidden',
        },
        questCardGradient: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '70%',
            ...Platform.select({
                web: {
                    backgroundImage: 'linear-gradient(to top, rgba(15,15,20,0.95) 0%, rgba(15,15,20,0.7) 35%, rgba(15,15,20,0.3) 60%, transparent 100%)',
                } as any,
            }),
        },
        questCardMagicGlow: {
            position: 'absolute',
            left: -50,
            right: -50,
            bottom: -20,
            height: 120,
            ...Platform.select({
                web: {
                    backgroundImage: 'radial-gradient(ellipse at center bottom, rgba(255, 146, 43, 0.12) 0%, transparent 60%)',
                    pointerEvents: 'none',
                } as any,
            }),
        },
        questCardVignette: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            ...Platform.select({
                web: {
                    boxShadow: 'inset 0 0 40px rgba(0,0,0,0.15)',
                    pointerEvents: 'none',
                } as any,
            }),
        },
        questCardContent: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: spacing.xl,
            paddingBottom: spacing.xl + spacing.xs,
        },
        questCardCategory: {
            color: 'rgba(255, 200, 140, 0.9)',
            fontSize: 10,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom: spacing.xs,
            ...Platform.select({
                web: {
                    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                } as any,
            }),
        },
        questCardTitle: {
            color: '#ffffff',
            fontSize: isMobileW ? 18 : 20,
            fontWeight: '700',
            letterSpacing: -0.3,
            lineHeight: isMobileW ? 24 : 28,
            marginBottom: spacing.md,
            ...Platform.select({
                web: {
                    textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                } as any,
            }),
        },
        questCardMeta: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            flexWrap: 'wrap',
        },
        questCardMetaItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(255,255,255,0.12)',
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.full,
            ...Platform.select({
                web: {
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                } as any,
            }),
        },
        questCardMetaText: {
            color: 'rgba(255,255,255,0.95)',
            fontSize: 12,
            fontWeight: '500',
        },
        questCardMetaDivider: {
            width: 3,
            height: 3,
            borderRadius: 1.5,
            backgroundColor: 'rgba(255,255,255,0.35)',
        },
        questCardBadge: {
            position: 'absolute',
            top: spacing.sm,
            left: spacing.sm,
            backgroundColor: 'rgba(255, 146, 43, 0.92)',
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.full,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            ...Platform.select({
                web: {
                    backdropFilter: 'blur(6px)',
                    boxShadow: '0 2px 8px rgba(255, 146, 43, 0.35)',
                } as any,
            }),
        },
        questCardBadgeText: {
            color: '#ffffff',
            fontSize: 11,
            fontWeight: '600',
        },
        questCardDifficultyBadge: {
            position: 'absolute',
            top: spacing.sm,
            right: spacing.sm,
            backgroundColor: 'rgba(0,0,0,0.45)',
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.full,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xxs,
            ...Platform.select({
                web: {
                    backdropFilter: 'blur(6px)',
                } as any,
            }),
        },
        questCardDifficultyText: {
            color: 'rgba(255,255,255,0.88)',
            fontSize: 11,
            fontWeight: '500',
        },
        questCardPlayIcon: {
            position: 'absolute',
            top: '42%',
            left: '50%',
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: 'rgba(255, 146, 43, 0.95)',
            alignItems: 'center',
            justifyContent: 'center',
            ...Platform.select({
                web: {
                    transform: 'translate(-50%, -50%) scale(0.85)',
                    boxShadow: '0 8px 24px rgba(255, 146, 43, 0.45), 0 0 0 6px rgba(255, 146, 43, 0.12)',
                    opacity: 0,
                    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                } as any,
            }),
        },
        questCardPlayIconVisible: {
            ...Platform.select({
                web: {
                    opacity: 1,
                    transform: 'translate(-50%, -50%) scale(1)',
                } as any,
            }),
        },
    });
}

// ───────────── Main screen (Redesigned) ─────────────

export default function QuestsScreen() {
    const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number>(DEFAULT_NEARBY_RADIUS_KM);
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [collapsedCountryCodes, setCollapsedCountryCodes] = useState<Record<string, boolean>>({});

    // API data
    const { quests: ALL_QUESTS, cityQuestsIndex: CITY_QUESTS, loading: questsLoading } = useQuestsList();
    const { cities: apiCities, loading: citiesLoading } = useQuestCities();
    const dataLoaded = !questsLoading && !citiesLoading;
    const cityCountryMetaById = useMemo(() => {
        const meta: Record<string, { countryCode?: string }> = {};
        for (const quest of ALL_QUESTS) {
            if (!quest.cityId || meta[quest.cityId]?.countryCode) continue;
            meta[quest.cityId] = {
                countryCode: quest.countryCode,
            };
        }
        return meta;
    }, [ALL_QUESTS]);

    const CITIES = useMemo<City[]>(() => apiCities.map(c => ({
        id: c.id,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
        countryCode: cityCountryMetaById[c.id]?.countryCode || c.countryCode,
    })), [apiCities, cityCountryMetaById]);

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
            if (selectedCityId !== NEARBY_ID && viewMode !== 'map') return;
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
    }, [selectedCityId, viewMode]);

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
            cities: groups[code].slice().sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        }));
    }, [visibleCities]);

    useEffect(() => {
        setCollapsedCountryCodes((prev) => {
            const next: Record<string, boolean> = {};
            for (const group of citiesByCountry) {
                next[group.code] = prev[group.code] ?? false;
            }
            return next;
        });
    }, [citiesByCountry]);

    const handleToggleCountryGroup = useCallback((code: string) => {
        setCollapsedCountryCodes((prev) => ({
            ...prev,
            [code]: !prev[code],
        }));
    }, []);

    const areAllCountryGroupsCollapsed = useMemo(
        () => citiesByCountry.length > 0 && citiesByCountry.every((group) => collapsedCountryCodes[group.code]),
        [citiesByCountry, collapsedCountryCodes],
    );

    const handleToggleAllCountryGroups = useCallback(() => {
        const nextValue = !areAllCountryGroupsCollapsed;
        setCollapsedCountryCodes(() => {
            const next: Record<string, boolean> = {};
            for (const group of citiesByCountry) {
                next[group.code] = nextValue;
            }
            return next;
        });
    }, [areAllCountryGroupsCollapsed, citiesByCountry]);

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

    const questCardWidth = useMemo(() => {
        if (isMobile) {
            return Math.max(280, width - spacing.lg * 2);
        }
        const estimatedContentWidth = Math.max(320, width - 340 - spacing.xl * 2);
        if (questsAll.length >= 2) {
            const twoColumnWidth = Math.floor((estimatedContentWidth - spacing.lg) / 2);
            return Math.max(280, Math.min(420, twoColumnWidth));
        }
        return Math.min(760, estimatedContentWidth);
    }, [isMobile, questsAll.length, width]);

    const mapPoints = useMemo<MapPoint[]>(() => {
        if (!dataLoaded || !selectedCityId) return [];
        const source = selectedCityId === NEARBY_ID
            ? (userLoc ? questsAll : ALL_QUESTS)
            : questsAll;

        return source
            .filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng))
            .map((q) => {
                const citySegmentRaw = selectedCityId === NEARBY_ID ? (q.cityId || '') : selectedCityId;
                const citySegment = encodeURIComponent(String(citySegmentRaw || 'city'));
                const questSegment = encodeURIComponent(String(q.id));
                const questUrl = buildCanonicalUrl(`/quests/${citySegment}/${questSegment}`);

                return {
                    id: q.id,
                    coord: `${q.lat},${q.lng}`,
                    address: q.title,
                    travelImageThumbUrl: typeof q.cover === 'string' ? q.cover : '',
                    categoryName: 'Квест',
                    articleUrl: questUrl,
                    urlTravel: questUrl,
                };
            });
    }, [dataLoaded, selectedCityId, userLoc, questsAll, ALL_QUESTS]);

    const mapCenter = useMemo(() => {
        if (userLoc && Number.isFinite(userLoc.lat) && Number.isFinite(userLoc.lng)) {
            return { latitude: userLoc.lat, longitude: userLoc.lng };
        }

        const selectedCity = CITIES.find((c) => c.id === selectedCityId);
        if (selectedCity && Number.isFinite(selectedCity.lat) && Number.isFinite(selectedCity.lng)) {
            return { latitude: Number(selectedCity.lat), longitude: Number(selectedCity.lng) };
        }

        if (mapPoints.length > 0) {
            const sum = mapPoints.reduce(
                (acc, p) => {
                    const [latStr, lngStr] = p.coord.split(',').map((v) => v.trim());
                    const lat = Number(latStr);
                    const lng = Number(lngStr);
                    return {
                        lat: acc.lat + (Number.isFinite(lat) ? lat : 0),
                        lng: acc.lng + (Number.isFinite(lng) ? lng : 0),
                    };
                },
                { lat: 0, lng: 0 },
            );
            return {
                latitude: sum.lat / mapPoints.length,
                longitude: sum.lng / mapPoints.length,
            };
        }

        return { latitude: 53.9, longitude: 27.56 };
    }, [CITIES, mapPoints, selectedCityId, userLoc]);

    const handleMapUserLocationChange = useCallback((loc: { latitude: number; longitude: number } | null) => {
        if (!loc) return;
        if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return;
        setUserLoc((prev) => {
            if (prev && Math.abs(prev.lat - loc.latitude) < 0.00001 && Math.abs(prev.lng - loc.longitude) < 0.00001) {
                return prev;
            }
            return { lat: loc.latitude, lng: loc.longitude };
        });
    }, []);

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
            {/* Header with adventure theme */}
            <View style={s.sidebarHeader as ViewStyle}>
                <Text style={s.sidebarTitle as TextStyle}>Приключения</Text>
                <Text style={s.sidebarSubtitle as TextStyle}>
                    Раскрой тайны городов через загадки и легенды
                </Text>
                <View style={s.sidebarActions as ViewStyle}>
                    <Pressable
                        style={[
                            s.actionBtn as ViewStyle,
                            viewMode === 'map' && (s.actionBtnSecondary as ViewStyle),
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={viewMode === 'map' ? 'Показать квесты списком' : 'Показать квесты на карте'}
                        onPress={() => setViewMode((prev) => (prev === 'map' ? 'list' : 'map'))}
                    >
                        <Feather name={viewMode === 'map' ? 'list' : 'map'} size={16} color={viewMode === 'map' ? colors.text : colors.textOnPrimary} />
                        <Text style={[s.actionBtnText as TextStyle, viewMode === 'map' && (s.actionBtnTextSecondary as TextStyle)]}>
                            {viewMode === 'map' ? 'Показать списком' : 'Показать на карте'}
                        </Text>
                    </Pressable>
                </View>
            </View>

            <ScrollView
                style={s.sidebarScroll as ViewStyle}
                contentContainerStyle={{ paddingBottom: spacing.md }}
                showsVerticalScrollIndicator
            >
                {/* Nearby option - adventure themed */}
                <View style={s.cityListSection as ViewStyle}>
                    <Text style={s.cityListLabel as TextStyle}>Выбор местоположения</Text>
                    <Pressable
                        onPress={() => handleSelectCity(NEARBY_ID)}
                        style={[s.cityItem as ViewStyle, selectedCityId === NEARBY_ID && (s.cityItemActive as ViewStyle)]}
                        accessibilityRole="button"
                        accessibilityLabel={`Рядом, ${pluralizeQuest(cityQuestCountById[NEARBY_ID] || 0)}`}
                        accessibilityState={{ selected: selectedCityId === NEARBY_ID }}
                    >
                        <View style={s.cityItemLeft as ViewStyle}>
                            <View style={[s.cityItemIcon as ViewStyle, selectedCityId === NEARBY_ID && (s.cityItemIconActive as ViewStyle)]}>
                                <Feather name="navigation" size={18} color={selectedCityId === NEARBY_ID ? colors.textOnPrimary : colors.textMuted} />
                            </View>
                            <Text style={[s.cityItemText as TextStyle, selectedCityId === NEARBY_ID && (s.cityItemTextActive as TextStyle)]}>
                                Рядом со мной
                            </Text>
                        </View>
                    </Pressable>
                </View>

                {citiesByCountry.length > 0 && (
                    <View style={s.countryToolsSection as ViewStyle}>
                        <Pressable
                            onPress={handleToggleAllCountryGroups}
                            style={s.collapseAllBtn as ViewStyle}
                            accessibilityRole="button"
                            accessibilityLabel={areAllCountryGroupsCollapsed ? 'Развернуть все страны' : 'Свернуть все страны'}
                        >
                            <Feather
                                name={areAllCountryGroupsCollapsed ? 'chevrons-down' : 'chevrons-up'}
                                size={14}
                                color={colors.textMuted}
                            />
                            <Text style={s.collapseAllBtnText as TextStyle}>
                                {areAllCountryGroupsCollapsed ? 'Развернуть все' : 'Свернуть все'}
                            </Text>
                        </Pressable>
                    </View>
                )}

                {/* Cities grouped by country - adventure themed */}
                {citiesByCountry.map((group) => {
                    const isCollapsed = collapsedCountryCodes[group.code] ?? false;
                    const countryQuestCount = group.cities.reduce((acc, city) => acc + (cityQuestCountById[city.id] || 0), 0);
                    return (
                        <View key={group.code} style={s.cityListSection as ViewStyle}>
                            <Pressable
                                onPress={() => handleToggleCountryGroup(group.code)}
                                style={s.countryHeader as ViewStyle}
                                accessibilityRole="button"
                                accessibilityLabel={`${isCollapsed ? 'Развернуть' : 'Свернуть'} группу ${group.name || group.code}, ${pluralizeQuest(countryQuestCount)}`}
                                accessibilityState={{ expanded: !isCollapsed }}
                            >
                                <Text style={s.countryLabel as TextStyle}>{group.name}</Text>
                                <View style={s.countryHeaderActions as ViewStyle}>
                                    <Text style={s.countryCount as TextStyle}>{pluralizeQuest(countryQuestCount)}</Text>
                                    <Feather
                                        name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                                        size={16}
                                        color={colors.textMuted}
                                    />
                                </View>
                            </Pressable>
                            {!isCollapsed && group.cities.map((city) => {
                                const isActive = selectedCityId === city.id;
                                const count = cityQuestCountById[city.id] || 0;
                                return (
                                    <Pressable
                                        key={city.id}
                                        onPress={() => handleSelectCity(city.id)}
                                        style={[s.cityItem as ViewStyle, isActive && (s.cityItemActive as ViewStyle)]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${city.name}, ${pluralizeQuest(count)}`}
                                        accessibilityState={{ selected: isActive }}
                                    >
                                        <View style={s.cityItemLeft as ViewStyle}>
                                            <View style={[s.cityItemIcon as ViewStyle, isActive && (s.cityItemIconActive as ViewStyle)]}>
                                                <Feather name={isActive ? 'compass' : 'map-pin'} size={18} color={isActive ? colors.textOnPrimary : colors.textMuted} />
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
                    );
                })}

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
            </ScrollView>
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
                        {dataLoaded && <Text style={s.contentCount as TextStyle}>{pluralizeQuest(questsAll.length)}</Text>}
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
                    {viewMode === 'map' ? (
                        <View style={s.mapSection as ViewStyle}>
                            {!dataLoaded && (
                                <View style={s.mapLoading as ViewStyle}>
                                    <ActivityIndicator color={colors.primary} />
                                </View>
                            )}

                            {dataLoaded && Platform.OS !== 'web' && (
                                <EmptyState
                                    icon="map"
                                    title="Карта доступна в веб-версии"
                                    description="Откройте страницу квестов в браузере, чтобы увидеть карту"
                                    variant="empty"
                                    iconSize={48}
                                />
                            )}

                            {dataLoaded && Platform.OS === 'web' && mapPoints.length === 0 && (
                                <EmptyState
                                    icon="map-pin"
                                    title="Нет квестов для отображения на карте"
                                    description="Измените город или радиус, чтобы увидеть точки на карте"
                                    variant="empty"
                                    iconSize={48}
                                />
                            )}

                            {dataLoaded && Platform.OS === 'web' && mapPoints.length > 0 && (
                                <View style={s.mapContainer as ViewStyle}>
                                    <Suspense fallback={<View style={s.mapLoading as ViewStyle}><ActivityIndicator color={colors.primary} /></View>}>
                                        <LazyQuestMap
                                            travel={{ data: mapPoints as any }}
                                            coordinates={mapCenter}
                                            mode="radius"
                                            radius={selectedCityId === NEARBY_ID ? String(Math.max(nearbyRadiusKm, 5)) : '50000'}
                                            routePoints={[]}
                                            transportMode="foot"
                                            onMapClick={() => {}}
                                            setRouteDistance={() => {}}
                                            setFullRouteCoords={() => {}}
                                            onUserLocationChange={handleMapUserLocationChange}
                                        />
                                    </Suspense>
                                </View>
                            )}
                        </View>
                    ) : (
                        <>
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
                                    {questsAll.map((quest, index) => (
                                        <QuestCard
                                            key={`${quest.id}-${index}`}
                                            cityId={selectedCityId === NEARBY_ID ? (quest.cityId || '') : (selectedCityId || '')}
                                            quest={quest}
                                            nearby={selectedCityId === NEARBY_ID}
                                            cardWidth={questCardWidth}
                                        />
                                    ))}
                                </View>
                            )}
                        </>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

// ───────────────── Quest card (Magical, Adventurous design) ─────────────────

const loadedQuestImageCache = new Set<string>();

// Adventure category labels for emotional storytelling
const QUEST_CATEGORIES = [
    'Городская легенда',
    'Тайны истории',
    'Мистическое приключение',
    'Загадки прошлого',
    'Секреты города',
];

// Get difficulty label and color
const getDifficultyInfo = (difficulty?: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
        case 'easy': return { label: 'Легко', color: 'rgba(129, 199, 132, 0.9)' };
        case 'hard': return { label: 'Сложно', color: 'rgba(239, 154, 154, 0.9)' };
        default: return { label: 'Средне', color: 'rgba(255, 213, 79, 0.9)' };
    }
};

function QuestCard({
    cityId, quest, nearby, cardWidth,
}: {
    cityId: string;
    quest: QuestMeta & { _distanceKm?: number };
    nearby?: boolean;
    cardWidth: number;
}) {
    const colors = useThemedColors();
    const { width: screenWidth, isPhone } = useResponsive();
    const s = useMemo(() => getStyles(colors, screenWidth), [colors, screenWidth]);
    const [isHovered, setIsHovered] = useState(false);
    
    const durationText = quest.durationMin ? `${Math.round((quest.durationMin ?? 60) / 5) * 5} мин` : '1–2 ч';
    const pointsText = quest.points === 1 ? '1 точка' : quest.points < 5 ? `${quest.points} точки` : `${quest.points} точек`;
    
    // Emotional category label (deterministic based on quest id)
    const categoryIndex = quest.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % QUEST_CATEGORIES.length;
    const categoryLabel = QUEST_CATEGORIES[categoryIndex];
    
    // Difficulty info
    const difficultyInfo = getDifficultyInfo(quest.difficulty);
    
    // Distance text for nearby mode
    const distanceText = nearby && typeof quest._distanceKm === 'number'
        ? quest._distanceKm < 1
            ? `${Math.round(quest._distanceKm * 1000)} м`
            : `${quest._distanceKm.toFixed(1)} км`
        : null;

    const imageUrl = typeof quest.cover === 'string' ? quest.cover : null;
    const cacheKey = imageUrl ? String(imageUrl).trim() : '';
    const [imageLoaded, setImageLoaded] = useState(() => !!cacheKey && loadedQuestImageCache.has(cacheKey));
    
    const handleImageLoad = useCallback(() => {
        if (cacheKey) loadedQuestImageCache.add(cacheKey);
        setImageLoaded(true);
    }, [cacheKey]);

    const handlePress = useCallback(() => {
        router.push(`/quests/${cityId}/${quest.id}`);
    }, [cityId, quest.id]);

    const cardHeight = isPhone ? 220 : Math.round((cardWidth / 380) * 260);

    return (
        <View
            style={[
                s.questCard as ViewStyle,
                { width: cardWidth, maxWidth: '100%' },
                isHovered && (s.questCardHover as ViewStyle),
            ]}
            {...Platform.select({
                web: {
                    onClick: handlePress,
                    onMouseEnter: () => setIsHovered(true),
                    onMouseLeave: () => setIsHovered(false),
                    role: 'link',
                    tabIndex: 0,
                    'aria-label': `Начать приключение: ${quest.title}`,
                    onKeyDown: (e: any) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handlePress();
                        }
                    },
                } as any,
                default: {},
            })}
            testID={`quest-card-${quest.id}`}
        >
            {Platform.OS !== 'web' && (
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={handlePress}
                    accessibilityRole="button"
                    accessibilityLabel={`Начать приключение: ${quest.title}`}
                />
            )}
            
            {/* Image container with magical overlays */}
            <View style={[s.questCardImage as ViewStyle, { height: cardHeight }]}>
                {/* Shimmer placeholder */}
                {!imageLoaded && imageUrl && (
                    <ShimmerOverlay style={StyleSheet.absoluteFill} />
                )}
                
                {/* Quest cover image */}
                {imageUrl ? (
                    <ImageCardMedia
                        src={imageUrl}
                        alt={quest.title}
                        fit="cover"
                        blurBackground
                        style={StyleSheet.absoluteFill}
                        loading="lazy"
                        priority="normal"
                        onLoad={handleImageLoad}
                        showImmediately={imageLoaded}
                    />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }]}>
                        <Feather name="compass" size={40} color="rgba(255, 146, 43, 0.3)" />
                    </View>
                )}
                
                {/* Vignette effect for cinematic feel */}
                <View style={s.questCardVignette as ViewStyle} />
                
                {/* Gradient overlay for text readability */}
                <View style={[s.questCardGradient as ViewStyle, { pointerEvents: 'none' }]} />
                
                {/* Magical glow at bottom */}
                <View style={s.questCardMagicGlow as ViewStyle} />
                
                {/* Distance badge (for nearby mode) */}
                {distanceText && (
                    <View style={s.questCardBadge as ViewStyle}>
                        <Feather name="navigation" size={12} color="#ffffff" />
                        <Text style={s.questCardBadgeText as TextStyle}>{distanceText}</Text>
                    </View>
                )}
                
                {/* Difficulty badge */}
                <View style={s.questCardDifficultyBadge as ViewStyle}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: difficultyInfo.color }} />
                    <Text style={s.questCardDifficultyText as TextStyle}>{difficultyInfo.label}</Text>
                </View>
                
                {/* Play icon on hover */}
                <View 
                    style={[
                        s.questCardPlayIcon as ViewStyle, 
                        isHovered && (s.questCardPlayIconVisible as ViewStyle),
                        { pointerEvents: 'none' },
                    ]} 
                >
                    <Feather name="play" size={18} color="#ffffff" style={{ marginLeft: 2 } as any} />
                </View>
                
                {/* Content overlay */}
                <View style={[s.questCardContent as ViewStyle, { pointerEvents: 'none' }]}>
                    {/* Adventure category */}
                    <Text style={s.questCardCategory as TextStyle}>{categoryLabel}</Text>
                    
                    {/* Quest title */}
                    <Text style={s.questCardTitle as TextStyle} numberOfLines={2}>
                        {quest.title}
                    </Text>
                    
                    {/* Meta info pills */}
                    <View style={s.questCardMeta as ViewStyle}>
                        <View style={s.questCardMetaItem as ViewStyle}>
                            <Feather name="map-pin" size={13} color="rgba(255,255,255,0.9)" />
                            <Text style={s.questCardMetaText as TextStyle}>{pointsText}</Text>
                        </View>
                        <View style={s.questCardMetaItem as ViewStyle}>
                            <Feather name="clock" size={13} color="rgba(255,255,255,0.9)" />
                            <Text style={s.questCardMetaText as TextStyle}>{durationText}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}
