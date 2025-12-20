import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, View, StyleSheet, Text, ScrollView, TextInput, Platform, findNodeHandle, UIManager, LayoutChangeEvent } from 'react-native';
import { Button } from 'react-native-paper';

import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { MarkerData } from '@/src/types/types';
import MultiSelectField from '@/components/MultiSelectField';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';

const WebMapComponent = Platform.OS === 'web'
    ? React.lazy(() => import('@/components/travel/WebMapComponent'))
    : null;

interface TravelWizardStepRouteProps {
    currentStep: number;
    totalSteps: number;
    markers: MarkerData[];
    setMarkers: (data: MarkerData[]) => void;
    categoryTravelAddress: any[];
    countries: any[];
    travelId?: string | null;
    selectedCountryIds: string[];
    onCountrySelect: (countryId: string) => void;
    onCountryDeselect: (countryId: string) => void;
    onBack: () => void;
    onNext: () => void;
    isFiltersLoading?: boolean;
    stepMeta?: {
        title?: string;
        subtitle?: string;
        tipTitle?: string;
        tipBody?: string;
        nextLabel?: string;
    };
    progress?: number;
    autosaveBadge?: string;
    focusAnchorId?: string | null;
    onAnchorHandled?: () => void;
    onStepSelect?: (step: number) => void;
}

const MultiSelectFieldAny: any = MultiSelectField;

const MAP_COACHMARK_STORAGE_KEY = 'travelWizardRouteMapCoachmarkDismissed';

const TravelWizardStepRoute: React.FC<TravelWizardStepRouteProps> = ({
    currentStep,
    totalSteps,
    markers,
    setMarkers,
    categoryTravelAddress,
    countries,
    travelId,
    selectedCountryIds,
    onCountrySelect,
    onCountryDeselect,
    onBack,
    onNext,
    isFiltersLoading,
    stepMeta,
    progress = currentStep / totalSteps,
    autosaveBadge,
    focusAnchorId,
    onAnchorHandled,
    onStepSelect,
}) => {
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;

    const [footerHeight, setFooterHeight] = useState(0);

    const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        setFooterHeight(prev => (prev === next ? prev : next));
    }, []);

    const contentPaddingBottom = useMemo(() => {
        return footerHeight > 0 ? footerHeight + 16 : 180;
    }, [footerHeight]);

    const scrollRef = useRef<ScrollView | null>(null);
    const markersListAnchorRef = useRef<View | null>(null);
    const countriesAnchorRef = useRef<View | null>(null);

    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);

    const hasAtLeastOnePoint = useMemo(() => markers && markers.length > 0, [markers]);

    const [isCoachmarkVisible, setIsCoachmarkVisible] = useState(false);
    const [isManualPointVisible, setIsManualPointVisible] = useState(false);
    const [manualCoords, setManualCoords] = useState('');
    const [manualLat, setManualLat] = useState('');
    const [manualLng, setManualLng] = useState('');

    useEffect(() => {
        if (!focusAnchorId) return;
        if (focusAnchorId !== 'markers-list-root' && focusAnchorId !== 'travelwizard-route-countries') return;

        if (Platform.OS === 'web') {
            onAnchorHandled?.();
            return;
        }

        const scrollNode = scrollRef.current;
        const anchorNode = focusAnchorId === 'travelwizard-route-countries'
            ? countriesAnchorRef.current
            : markersListAnchorRef.current;
        if (!scrollNode || !anchorNode) {
            onAnchorHandled?.();
            return;
        }

        const scrollHandle = findNodeHandle(scrollNode);
        const anchorHandle = findNodeHandle(anchorNode);
        if (!scrollHandle || !anchorHandle) {
            onAnchorHandled?.();
            return;
        }

        setTimeout(() => {
            UIManager.measureLayout(
                anchorHandle,
                scrollHandle,
                () => onAnchorHandled?.(),
                (_x, y) => {
                    scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
                    onAnchorHandled?.();
                },
            );
        }, 50);
    }, [focusAnchorId, onAnchorHandled]);

    const parseCoordsPair = (raw: string): { lat: number; lng: number } | null => {
        // Accept common copy/paste formats:
        // - "49.609645, 18.845693"
        // - "49.609645 18.845693"
        // - "49.609645;18.845693"
        const normalized = String(raw || '').trim();
        if (!normalized) return null;

        const parts = normalized
            .split(/[\s,;]+/)
            .map(p => p.trim())
            .filter(Boolean);

        if (parts.length < 2) return null;

        const lat = Number(parts[0]);
        const lng = Number(parts[1]);

        const latOk = Number.isFinite(lat) && lat >= -90 && lat <= 90;
        const lngOk = Number.isFinite(lng) && lng >= -180 && lng <= 180;
        if (!latOk || !lngOk) return null;

        return { lat, lng };
    };

    useEffect(() => {
        if (hasAtLeastOnePoint) {
            setIsCoachmarkVisible(false);
            return;
        }

        if (typeof window === 'undefined') {
            setIsCoachmarkVisible(true);
            return;
        }

        try {
            const dismissed = window.localStorage.getItem(MAP_COACHMARK_STORAGE_KEY) === '1';
            setIsCoachmarkVisible(!dismissed);
        } catch {
            setIsCoachmarkVisible(true);
        }
    }, [hasAtLeastOnePoint]);

    const handleMarkersChange = (updated: MarkerData[]) => {
        setMarkers(updated);
    };

    const dismissCoachmark = () => {
        setIsCoachmarkVisible(false);
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(MAP_COACHMARK_STORAGE_KEY, '1');
        } catch {
            // ignore
        }
    };

    const reverseGeocode = async (lat: number, lng: number) => {
        // Use a CORS-friendly provider first, then fall back to Nominatim
        try {
            const primary = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
            );
            if (primary.ok) {
                return await primary.json();
            }
        } catch {
            // ignore and fall back
        }

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
            );
            if (!response.ok) return null;
            return await response.json();
        } catch {
            return null;
        }
    };

    const handleAddManualPoint = async () => {
        const parsedFromPair = parseCoordsPair(manualCoords);
        const lat = parsedFromPair?.lat ?? Number(manualLat);
        const lng = parsedFromPair?.lng ?? Number(manualLng);

        const latOk = Number.isFinite(lat) && lat >= -90 && lat <= 90;
        const lngOk = Number.isFinite(lng) && lng >= -180 && lng <= 180;
        if (!latOk || !lngOk) return;

        let address = '';
        let derivedCountryId: string | null = null;

        try {
            const data = await reverseGeocode(lat, lng);
            address = data?.display_name || data?.localityInfo?.informative?.[0]?.description || '';
            const countryName =
                data?.address?.country ||
                data?.countryName ||
                data?.localityInfo?.administrative?.find((item: any) => item?.order === 2)?.name ||
                '';
            if (countryName) {
                const foundCountry = (countries || []).find((c: any) => c?.title_ru === countryName);
                if (foundCountry?.country_id) {
                    derivedCountryId = foundCountry.country_id;
                }
            }
        } catch {
            // ignore
        }

        const newMarker: MarkerData = {
            id: null,
            lat,
            lng,
            address,
            categories: [],
            image: '',
            country: derivedCountryId ? Number(derivedCountryId) : null,
        };

        if (derivedCountryId && !selectedCountryIds.includes(derivedCountryId)) {
            onCountrySelect(derivedCountryId);
        }

        handleMarkersChange([...(markers || []), newMarker]);
        setManualCoords('');
        setManualLat('');
        setManualLng('');
        setIsManualPointVisible(false);
    };

    const handleCountriesFilterChange = (values: string[]) => {
        const prev = selectedCountryIds || [];
        const next = values || [];

        const added = next.filter(id => !prev.includes(id));
        const removed = prev.filter(id => !next.includes(id));

        added.forEach(onCountrySelect);

        if (removed.length) {
            const removedSet = new Set(removed.map(String));
            const updatedMarkers = (markers || []).filter((m: any) => {
                const markerCountry = m?.country;
                if (markerCountry == null) return true;
                return !removedSet.has(String(markerCountry));
            });

            if (updatedMarkers.length !== (markers || []).length) {
                setMarkers(updatedMarkers);
            }
        }

        removed.forEach(onCountryDeselect);
    };

    return (
        <SafeAreaView style={styles.safeContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    canGoBack={true}
                    onBack={onBack}
                    title={stepMeta?.title ?? 'Маршрут путешествия'}
                    subtitle={stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}
                    progressPercent={progressPercent}
                    autosaveBadge={autosaveBadge}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                />

                <ScrollView
                    ref={scrollRef}
                    style={styles.content}
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: contentPaddingBottom }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.contentInner}>
                        <View style={styles.card}>
                            <View style={[styles.mapHeader, isMobile && styles.mapHeaderMobile]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.mapTitle}>Ключевые точки маршрута</Text>
                                    <Text style={styles.mapHint}>
                                        Добавьте точки маршрута на карте. Для модерации потребуется минимум одна точка.
                                    </Text>
                                </View>
                                <Text style={styles.mapCount}>Точек: {markers?.length ?? 0}</Text>
                            </View>

                            {isCoachmarkVisible && !hasAtLeastOnePoint && (
                                <View style={styles.coachmark}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.coachmarkTitle}>Как добавить первую точку</Text>
                                        <Text style={styles.coachmarkBody}>
                                            Кликните по карте — точка добавится автоматически.
                                        </Text>
                                    </View>
                                    <Button mode="text" onPress={dismissCoachmark} compact>
                                        Понятно
                                    </Button>
                                </View>
                            )}

                            <View style={[styles.manualPointRow, isMobile && styles.manualPointRowMobile]}>
                                <Button
                                    mode={isManualPointVisible ? 'contained' : 'outlined'}
                                    onPress={() => setIsManualPointVisible(v => !v)}
                                    compact
                                >
                                    Добавить точку вручную
                                </Button>
                            </View>

                            {isManualPointVisible && (
                                <View style={styles.manualPointCard}>
                                    <View style={styles.manualCoordsWrapper}>
                                        <Text style={styles.manualPointLabel}>Координаты (lat, lng)</Text>
                                        <TextInput
                                            value={manualCoords}
                                            onChangeText={(value) => {
                                                setManualCoords(value);
                                                const parsed = parseCoordsPair(value);
                                                if (parsed) {
                                                    setManualLat(String(parsed.lat));
                                                    setManualLng(String(parsed.lng));
                                                }
                                            }}
                                            placeholder="49.609645, 18.845693"
                                            style={styles.manualPointInput}
                                            inputMode="text"
                                        />
                                    </View>

                                    <View style={styles.manualPointInputsRow}>
                                        <View style={styles.manualPointInputWrapper}>
                                            <Text style={styles.manualPointLabel}>Широта</Text>
                                            <TextInput
                                                value={manualLat}
                                                onChangeText={setManualLat}
                                                placeholder="например 53.90"
                                                style={styles.manualPointInput}
                                                inputMode="decimal"
                                            />
                                        </View>
                                        <View style={styles.manualPointInputWrapper}>
                                            <Text style={styles.manualPointLabel}>Долгота</Text>
                                            <TextInput
                                                value={manualLng}
                                                onChangeText={setManualLng}
                                                placeholder="например 27.56"
                                                style={styles.manualPointInput}
                                                inputMode="decimal"
                                            />
                                        </View>
                                    </View>
                                    <View style={styles.manualPointActionsRow}>
                                        <Button mode="contained" onPress={handleAddManualPoint} compact>
                                            Добавить
                                        </Button>
                                        <Button mode="text" onPress={() => setIsManualPointVisible(false)} compact>
                                            Отмена
                                        </Button>
                                    </View>
                                </View>
                            )}

                            <View style={[styles.filtersRow, isMobile && styles.filtersRowMobile]}>
                                <View ref={countriesAnchorRef} nativeID="travelwizard-route-countries" />
                                <View style={styles.filterItem}>
                                    {isFiltersLoading ? (
                                        <View style={styles.filtersSkeleton}>
                                            <View style={styles.filtersSkeletonLabel} />
                                            <View style={styles.filtersSkeletonInput} />
                                        </View>
                                    ) : (
                                        <MultiSelectFieldAny
                                            label="Страны маршрута"
                                            items={countries}
                                            value={selectedCountryIds}
                                            onChange={handleCountriesFilterChange}
                                            labelField="title_ru"
                                            valueField="country_id"
                                        />
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* карта и список точек */}
                        <View style={styles.card}>
                            <View ref={markersListAnchorRef} nativeID="markers-list-root" />
                            <View style={[styles.mapContainer, isMobile && styles.mapContainerMobile]}>
                                {Platform.OS === 'web' && WebMapComponent ? (
                                    <Suspense
                                        fallback={
                                            <View style={styles.lazyFallback}>
                                                <Text style={styles.lazyFallbackText}>Загрузка карты…</Text>
                                            </View>
                                        }
                                    >
                                        <WebMapComponent
                                            markers={markers || []}
                                            onMarkersChange={handleMarkersChange}
                                            categoryTravelAddress={categoryTravelAddress}
                                            countrylist={countries}
                                            onCountrySelect={onCountrySelect}
                                            onCountryDeselect={onCountryDeselect}
                                            travelId={travelId ?? undefined}
                                        />
                                    </Suspense>
                                ) : (
                                    <View style={styles.nativeMapPlaceholder}>
                                        <Text style={styles.nativeMapTitle}>Карта доступна в браузере</Text>
                                        <Text style={styles.nativeMapBody}>
                                            На мобильном приложении добавьте точки вручную (кнопка выше) и сохраните маршрут.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </ScrollView>

                <TravelWizardFooter
                    canGoBack={true}
                    onBack={onBack}
                    onPrimary={onNext}
                    primaryLabel="К медиа"
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onLayout={handleFooterLayout}
                    onStepSelect={onStepSelect}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: DESIGN_TOKENS.colors.background },
    keyboardAvoid: { flex: 1 },
    syncBadge: {
        marginTop: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xxs,
        borderRadius: 999,
        backgroundColor: DESIGN_TOKENS.colors.successSoft,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.successLight,
    },
    syncBadgeText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.successDark,
        fontWeight: '700',
    },
    headerActions: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    content: {
        flex: 1,
        paddingHorizontal: 8,
    },
    contentContainer: {
        paddingBottom: 0,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        maxWidth: 980,
    },
    card: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        ...(Platform.OS === 'web'
            ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any)
            : (DESIGN_TOKENS.shadowsNative.light as any)),
        overflow: 'hidden',
    },
    mapHeader: {
        paddingTop: 2,
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    mapHeaderMobile: {
        paddingTop: 10,
        paddingBottom: 8,
        alignItems: 'flex-start',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    coachmark: {
        marginBottom: 8,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: DESIGN_TOKENS.colors.infoSoft,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.infoLight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    coachmarkTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.infoDark,
        marginBottom: 2,
    },
    coachmarkBody: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.text,
    },
    manualPointRow: {
        paddingBottom: 8,
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    manualPointRowMobile: {
        paddingBottom: 10,
    },
    manualPointCard: {
        marginBottom: 8,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: DESIGN_TOKENS.colors.surfaceElevated,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
    },
    manualCoordsWrapper: {
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    manualPointInputsRow: {
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    manualPointInputWrapper: {
        flex: 1,
    },
    manualPointLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
        marginBottom: 6,
        fontWeight: '600',
    },
    manualPointInput: {
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        borderRadius: 10,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: 10,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        backgroundColor: DESIGN_TOKENS.colors.surface,
    },
    manualPointActionsRow: {
        marginTop: DESIGN_TOKENS.spacing.sm,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    mapTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: DESIGN_TOKENS.spacing.xxs,
    },
    mapHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    mapCount: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.primary,
    },
    mapContainer: {
        marginTop: 4,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingBottom: DESIGN_TOKENS.spacing.lg,
    },
    mapContainerMobile: {
        marginTop: 6,
        paddingBottom: DESIGN_TOKENS.spacing.md,
    },
    lazyFallback: {
        padding: DESIGN_TOKENS.spacing.lg,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 240,
    },
    lazyFallbackText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textMuted,
        fontWeight: '600',
    },
    nativeMapPlaceholder: {
        padding: DESIGN_TOKENS.spacing.lg,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
    },
    nativeMapTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 6,
    },
    nativeMapBody: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textMuted,
        lineHeight: 18,
    },
    filtersRow: {
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingBottom: 8,
    },
    filtersRowMobile: {
        paddingBottom: 10,
    },
    filterItem: {
        flex: 1,
    },
    filtersSkeleton: {
        marginTop: 4,
        paddingVertical: 4,
    },
    filtersSkeletonLabel: {
        width: 120,
        height: 12,
        borderRadius: 4,
        backgroundColor: DESIGN_TOKENS.colors.borderLight,
        marginBottom: 8,
    },
    filtersSkeletonInput: {
        width: '100%',
        height: 40,
        borderRadius: 8,
        backgroundColor: DESIGN_TOKENS.colors.borderLight,
    },
});

export default React.memo(TravelWizardStepRoute);
