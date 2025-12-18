import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { usePathname, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import InstantSEO from '@/components/seo/InstantSEO';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import UIButton from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import WeeklyHighlights from '@/components/WeeklyHighlights';
import PersonalizedRecommendations from '@/components/PersonalizedRecommendations';
import PopularTravelList from '@/components/travel/PopularTravelList';
import Slider from '@/components/travel/Slider';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { fetchMyTravels } from '@/src/api/travelsApi';
import { fetchTravelsForMap } from '@/src/api/map';
import type { TravelCoords } from '@/src/types/types';
import { sendAnalyticsEvent } from '@/src/utils/analytics';
import { Asset } from 'expo-asset';

function HomeScreen() {
    const router = useRouter();
    const pathname = usePathname();
    const isFocused = useIsFocused();
    const { isAuthenticated, userId } = useAuth();

    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
    const canonical = useMemo(() => `${SITE}${pathname || ''}`, [SITE, pathname]);

    const title = 'Твоя книга путешествий | Metravel';
    const description = 'Добавляй поездки, фото и заметки — и собирай красивую книгу в PDF для печати.';

    const { data: myTravelsPayload } = useQuery({
        queryKey: ['my-travels-count', userId],
        queryFn: () => fetchMyTravels({ user_id: userId as any }),
        enabled: Boolean(isAuthenticated && userId),
        staleTime: 60_000,
    });

    const travelsCount = useMemo(() => {
        const payload: any = myTravelsPayload;
        if (!payload) return 0;
        if (Array.isArray(payload)) return payload.length;
        if (Array.isArray(payload?.data)) return payload.data.length;
        if (Array.isArray(payload?.results)) return payload.results.length;
        if (Array.isArray(payload?.items)) return payload.items.length;
        if (typeof payload?.total === 'number') return payload.total;
        if (typeof payload?.count === 'number') return payload.count;
        return 0;
    }, [myTravelsPayload]);

    const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [geoDenied, setGeoDenied] = useState(false);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (geoCoords || geoDenied) return;

        const nav: any = typeof navigator !== 'undefined' ? navigator : null;
        if (!nav?.geolocation?.getCurrentPosition) {
            setGeoDenied(true);
            return;
        }

        nav.geolocation.getCurrentPosition(
            (pos: any) => {
                const lat = Number(pos?.coords?.latitude);
                const lng = Number(pos?.coords?.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    setGeoDenied(true);
                    return;
                }
                setGeoCoords({ lat, lng });
            },
            () => setGeoDenied(true),
            { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 }
        );
    }, [geoCoords, geoDenied]);

    const { data: nearbyPayload } = useQuery({
        queryKey: ['home-nearby', geoCoords?.lat, geoCoords?.lng],
        queryFn: () =>
            fetchTravelsForMap(0, 12, {
                lat: String(geoCoords?.lat),
                lng: String(geoCoords?.lng),
                radius: '60',
                publish: 1,
                moderation: 1,
            } as any),
        enabled: Boolean(Platform.OS === 'web' && geoCoords?.lat && geoCoords?.lng),
        staleTime: 15 * 60_000,
    });

    const nearbyCards = useMemo(() => {
        const payload: any = nearbyPayload;
        if (!payload || typeof payload !== 'object') return [] as TravelCoords[];
        const values = Object.values(payload) as any[];
        return values.slice(0, 8) as TravelCoords[];
    }, [nearbyPayload]);

    const travelsCountBucket = useMemo(() => {
        if (travelsCount <= 0) return 0;
        if (travelsCount <= 3) return '1-3';
        return '4+';
    }, [travelsCount]);

    useEffect(() => {
        if (!isFocused) return;
        sendAnalyticsEvent('HomeViewed', {
            authState: isAuthenticated ? 'auth' : 'guest',
            travelsCountBucket,
        });
    }, [isAuthenticated, isFocused, travelsCountBucket]);

    const handleOpenSearch = useCallback(
        (source?: string) => {
            sendAnalyticsEvent('HomeClick_OpenSearch', source ? { source } : undefined as any);
            router.push('/search' as any);
        },
        [router]
    );

    const handleMiniSearch = useCallback(() => {
        handleOpenSearch('mini-search');
    }, [handleOpenSearch]);

    const examplesImages = useMemo(() => {
        const cover = Asset.fromModule(require('../../assets/travel/roulette-map-bg.jpg')).uri;
        const toc = Asset.fromModule(require('../../assets/travel/roulette-compass-bg.jpg')).uri;
        const map = Asset.fromModule(require('../../assets/quests/minskDragon/cover.png')).uri;
        const gallery = Asset.fromModule(require('../../assets/quests/krakowDragon/cover.png')).uri;

        return [
            { id: 'cover', url: cover },
            { id: 'toc', url: toc },
            { id: 'map', url: map },
            { id: 'gallery', url: gallery },
        ];
    }, []);

    const handlePrimaryCta = useCallback(() => {
        if (!isAuthenticated) {
            sendAnalyticsEvent('HomeClick_CreateBook', { intent: 'create-book' });
            router.push('/login?redirect=%2Fexport&intent=create-book' as any);
            return;
        }

        if (travelsCount <= 0) {
            sendAnalyticsEvent('HomeClick_AddFirstTravel');
            router.push('/travel/new' as any);
            return;
        }

        sendAnalyticsEvent('HomeClick_BuildPdf');
        router.push('/export' as any);
    }, [isAuthenticated, router, travelsCount]);

    const primaryLabel = useMemo(() => {
        if (!isAuthenticated) return 'Создать свою книгу';
        if (travelsCount <= 0) return 'Добавить первое путешествие';
        return 'Собрать PDF‑книгу';
    }, [isAuthenticated, travelsCount]);

    const finalCtaLabel = useMemo(() => {
        if (!isAuthenticated) return 'Создать свою книгу';
        return 'Добавить путешествие';
    }, [isAuthenticated]);

    const handleFinalCta = useCallback(() => {
        if (!isAuthenticated) {
            sendAnalyticsEvent('HomeClick_CreateBook', { intent: 'final-cta' });
            router.push('/login?redirect=%2Ftravel%2Fnew&intent=add-first-travel' as any);
            return;
        }
        sendAnalyticsEvent('CreateTravelStarted', { source: 'home' });
        router.push('/travel/new' as any);
    }, [isAuthenticated, router]);

    const canExport = isAuthenticated && travelsCount > 0;
    const progressValue = canExport ? 100 : 0;

    useEffect(() => {
        if (!isFocused) return;
        if (!isAuthenticated) return;
        sendAnalyticsEvent('HomeBookProgressShown', {
            canExport,
            travelsCountBucket,
        });
    }, [canExport, isAuthenticated, isFocused, travelsCountBucket]);

    const handleProgressAddTravel = useCallback(() => {
        sendAnalyticsEvent('HomeClick_BookProgress_AddTravel');
        handleFinalCta();
    }, [handleFinalCta]);

    const handleProgressBuildPdf = useCallback(() => {
        sendAnalyticsEvent('HomeClick_BookProgress_BuildPdf');
        handlePrimaryCta();
    }, [handlePrimaryCta]);

    return (
        <>
            {isFocused && Platform.OS === 'web' && (
                <InstantSEO
                    headKey="home"
                    title={title}
                    description={description}
                    canonical={canonical}
                    image={`${SITE}/og-preview.jpg`}
                    ogType="website"
                />
            )}

            <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
                <View style={styles.hero}>
                    <Text style={styles.heroTitle}>Твоя книга путешествий</Text>
                    <Text style={styles.heroSubtitle}>
                        Добавляй поездки, фото и заметки — и собирай красивую книгу в PDF для печати.
                    </Text>

                    <View style={styles.heroActions}>
                        <UIButton label={primaryLabel} onPress={handlePrimaryCta} />
                        <UIButton label="Открыть Поиск" onPress={() => handleOpenSearch('hero')} variant="secondary" />
                    </View>

                    <Pressable
                        onPress={handleMiniSearch}
                        accessibilityRole="button"
                        accessibilityLabel="Открыть Поиск"
                        style={styles.miniSearch}
                    >
                        <Text style={styles.miniSearchPlaceholder}>Куда хотите поехать? Нажмите, чтобы открыть поиск…</Text>
                    </Pressable>

                    {isAuthenticated && travelsCount <= 0 && (
                        <Text style={styles.heroHint}>
                            Добавь первое путешествие — и сможешь собрать книгу в PDF.
                        </Text>
                    )}

                    <View style={styles.heroPreview}>
                        <View style={styles.previewCard} />
                        <View style={styles.previewCardSecondary} />
                    </View>
                </View>

                {isAuthenticated && (
                    <View style={styles.section}>
                        <View style={styles.progressHeader}>
                            <Text style={styles.sectionTitle}>Прогресс книги</Text>
                            <Text style={styles.progressCounter}>{canExport ? '1/1' : '0/1'}</Text>
                        </View>
                        <Text style={styles.progressText}>
                            {canExport
                                ? 'Можно собирать PDF‑книгу.'
                                : 'Добавьте хотя бы одно путешествие, чтобы собрать PDF‑книгу.'}
                        </Text>
                        <View style={styles.progressBarTrack}>
                            <View style={[styles.progressBarFill, { width: `${progressValue}%` }]} />
                        </View>
                        {canExport ? (
                            <UIButton label="Собрать PDF‑книгу" onPress={handleProgressBuildPdf} />
                        ) : (
                            <UIButton label="Добавить путешествие" onPress={handleProgressAddTravel} />
                        )}
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Как это работает</Text>
                    <View style={styles.steps}>
                        <View style={styles.step}>
                            <Text style={styles.stepIndex}>1</Text>
                            <Text style={styles.stepText}>Добавь путешествие</Text>
                        </View>
                        <View style={styles.step}>
                            <Text style={styles.stepIndex}>2</Text>
                            <Text style={styles.stepText}>Настрой книгу (стиль/обложка)</Text>
                        </View>
                        <View style={styles.step}>
                            <Text style={styles.stepIndex}>3</Text>
                            <Text style={styles.stepText}>Сохрани в PDF (Cmd/Ctrl+P → Save as PDF)</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Примеры оформления</Text>
                    <View style={styles.examplesSlider}>
                        <Slider
                            images={examplesImages as any}
                            showDots={true}
                            showArrows={true}
                            hideArrowsOnMobile={true}
                            aspectRatio={16 / 9}
                            autoPlay={false}
                            blurBackground={true}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Вдохновение</Text>

                    <View style={styles.subSection}>
                        <View style={styles.subSectionHeader}>
                            <Text style={styles.subSectionTitle}>Рекомендации месяца</Text>
                            <UIButton label="Смотреть в Поиске" onPress={() => handleOpenSearch('month')} variant="secondary" />
                        </View>
                        <WeeklyHighlights showHeader={false} enabled={true} />
                    </View>

                    <View style={styles.subSection}>
                        <View style={styles.subSectionHeader}>
                            <Text style={styles.subSectionTitle}>Популярные</Text>
                            <UIButton label="Смотреть в Поиске" onPress={() => handleOpenSearch('popular')} variant="secondary" />
                        </View>
                        <PopularTravelList title={null} maxColumns={3} />
                    </View>

                    <View style={styles.subSection}>
                        <View style={styles.subSectionHeader}>
                            <Text style={styles.subSectionTitle}>Рядом с тобой</Text>
                            <UIButton label="Смотреть в Поиске" onPress={() => handleOpenSearch('nearby')} variant="secondary" />
                        </View>

                        {Platform.OS === 'web' && geoDenied && (
                            <Text style={styles.geoHint}>
                                Не удалось получить геолокацию — показываем популярные маршруты.
                            </Text>
                        )}

                        {nearbyCards.length > 0 ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRow}>
                                {nearbyCards.map((item, idx) => (
                                    <View key={`${item.urlTravel || item.articleUrl || ''}-${idx}`} style={styles.nearbyCardWrap}>
                                        <TabTravelCard
                                            item={{
                                                id: item.urlTravel || item.articleUrl || `${idx}`,
                                                title: item.address || 'Маршрут рядом',
                                                imageUrl: item.travelImageThumbUrl,
                                                city: null,
                                                country: item.categoryName || null,
                                            }}
                                            onPress={() => {
                                                const url = item.articleUrl || item.urlTravel || '/search';
                                                if (Platform.OS === 'web') {
                                                    if (typeof window !== 'undefined') {
                                                        window.location.href = url;
                                                    }
                                                } else {
                                                    router.push(url as any);
                                                }
                                            }}
                                        />
                                    </View>
                                ))}
                            </ScrollView>
                        ) : (
                            <PopularTravelList title={null} maxColumns={3} />
                        )}
                    </View>

                    <View style={styles.subSection}>
                        <View style={styles.subSectionHeader}>
                            <Text style={styles.subSectionTitle}>Рекомендации для вас</Text>
                            <UIButton label="Смотреть в Поиске" onPress={() => handleOpenSearch('recommendations')} variant="secondary" />
                        </View>
                        <PersonalizedRecommendations showHeader={false} onlyRecommendations={true} />
                    </View>
                </View>

                <View style={[styles.section, styles.finalCta]}>
                    <Text style={styles.sectionTitle}>Готов(а) начать книгу?</Text>
                    <UIButton label={finalCtaLabel} onPress={handleFinalCta} />
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: DESIGN_TOKENS.colors.background,
    },
    pageContent: {
        paddingVertical: 16,
        paddingHorizontal: 16,
        gap: 16,
    },
    hero: {
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: DESIGN_TOKENS.colors.text,
        letterSpacing: -0.4,
    },
    heroSubtitle: {
        marginTop: 8,
        fontSize: 15,
        lineHeight: 22,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    heroActions: {
        marginTop: 14,
        gap: 10,
    },
    miniSearch: {
        marginTop: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(17, 24, 39, 0.10)',
        backgroundColor: 'rgba(17, 24, 39, 0.03)',
    },
    miniSearchPlaceholder: {
        fontSize: 14,
        lineHeight: 20,
        color: DESIGN_TOKENS.colors.textMuted,
        fontWeight: '600',
    },
    heroHint: {
        marginTop: 10,
        fontSize: 13,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    heroPreview: {
        marginTop: 14,
        gap: 10,
    },
    previewCard: {
        height: 120,
        borderRadius: 14,
        backgroundColor: 'rgba(74, 140, 140, 0.10)',
        borderWidth: 1,
        borderColor: 'rgba(74, 140, 140, 0.20)',
    },
    previewCardSecondary: {
        height: 72,
        borderRadius: 14,
        backgroundColor: 'rgba(17, 24, 39, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(17, 24, 39, 0.08)',
    },
    section: {
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        gap: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: DESIGN_TOKENS.colors.text,
        letterSpacing: -0.2,
    },
    progressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    progressCounter: {
        fontSize: 13,
        fontWeight: '800',
        color: DESIGN_TOKENS.colors.primary,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(74, 140, 140, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(74, 140, 140, 0.20)',
    },
    progressText: {
        fontSize: 14,
        lineHeight: 20,
        color: DESIGN_TOKENS.colors.textMuted,
        fontWeight: '600',
    },
    progressBarTrack: {
        height: 10,
        borderRadius: 6,
        backgroundColor: 'rgba(17, 24, 39, 0.08)',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 6,
        backgroundColor: DESIGN_TOKENS.colors.primary,
    },
    steps: {
        gap: 10,
    },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: 'rgba(17, 24, 39, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(17, 24, 39, 0.06)',
    },
    stepIndex: {
        width: 26,
        height: 26,
        borderRadius: 13,
        textAlign: 'center',
        textAlignVertical: 'center',
        fontSize: 13,
        fontWeight: '800',
        color: DESIGN_TOKENS.colors.primary,
        backgroundColor: 'rgba(74, 140, 140, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(74, 140, 140, 0.22)',
    },
    stepText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        color: DESIGN_TOKENS.colors.text,
        fontWeight: '600',
    },
    examplesRow: {
        paddingVertical: 4,
        gap: 12,
    },
    examplesSlider: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(17, 24, 39, 0.08)',
        backgroundColor: 'rgba(17, 24, 39, 0.02)',
    },
    exampleCard: {
        width: 220,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(17, 24, 39, 0.08)',
        backgroundColor: DESIGN_TOKENS.colors.surface,
    },
    exampleImage: {
        width: '100%',
        height: 128,
        backgroundColor: 'rgba(17, 24, 39, 0.04)',
    },
    exampleLabel: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
    },
    subSection: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(17, 24, 39, 0.08)',
        backgroundColor: 'rgba(17, 24, 39, 0.02)',
        padding: 12,
        gap: 10,
    },
    subSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    subSectionTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '800',
        color: DESIGN_TOKENS.colors.text,
        letterSpacing: -0.2,
    },
    geoHint: {
        fontSize: 13,
        lineHeight: 18,
        color: DESIGN_TOKENS.colors.textMuted,
        fontWeight: '600',
    },
    nearbyRow: {
        paddingVertical: 4,
        gap: 12,
    },
    nearbyCardWrap: {
        width: 220,
    },
    inlineCtaRow: {
        marginTop: 6,
    },
    finalCta: {
        alignItems: 'flex-start',
    },
});

export default memo(HomeScreen);
