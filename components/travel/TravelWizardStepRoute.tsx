import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, StyleSheet, Text, ScrollView, Dimensions, TextInput, Platform, findNodeHandle, UIManager } from 'react-native';
import { Button } from 'react-native-paper';

import WebMapComponent from '@/components/travel/WebMapComponent';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { MarkerData } from '@/src/types/types';
import MultiSelectField from '@/components/MultiSelectField';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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
    onManualSave?: () => void;
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
}

const windowWidth = Dimensions.get('window').width;
const isMobileDefault = windowWidth <= 768;
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
    onManualSave,
    stepMeta,
    progress = currentStep / totalSteps,
    autosaveBadge,
    focusAnchorId,
    onAnchorHandled,
}) => {
    const isMobile = isMobileDefault;

    const scrollRef = useRef<ScrollView | null>(null);
    const markersListAnchorRef = useRef<View | null>(null);

    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);

    const hasAtLeastOnePoint = useMemo(() => markers && markers.length > 0, [markers]);

    const [isCoachmarkVisible, setIsCoachmarkVisible] = useState(false);
    const [isManualPointVisible, setIsManualPointVisible] = useState(false);
    const [manualCoords, setManualCoords] = useState('');
    const [manualLat, setManualLat] = useState('');
    const [manualLng, setManualLng] = useState('');
    const [countriesSyncedVisible, setCountriesSyncedVisible] = useState(false);

    useEffect(() => {
        if (!focusAnchorId) return;
        if (focusAnchorId !== 'markers-list-root') return;

        if (Platform.OS === 'web') {
            onAnchorHandled?.();
            return;
        }

        const scrollNode = scrollRef.current;
        const anchorNode = markersListAnchorRef.current;
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
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
        );
        return await response.json();
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
            address = data?.display_name || '';
            const countryName = data?.address?.country || '';
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
            setCountriesSyncedVisible(true);
            setTimeout(() => setCountriesSyncedVisible(false), 3000);
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
        removed.forEach(onCountryDeselect);
    };

    const handleNext = () => {
        onNext();
    };

    const handleScrollToMarkers = () => {
        if (typeof document === 'undefined') return;
        const el = document.getElementById('markers-list-root');
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <SafeAreaView style={styles.safeContainer}>
            <View style={styles.headerWrapper}>
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{stepMeta?.title ?? 'Маршрут путешествия'}</Text>
                        <Text style={styles.headerSubtitle}>{stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}</Text>
                    </View>
                    {autosaveBadge && (
                        <View style={styles.autosaveBadge}>
                            <Text style={styles.autosaveBadgeText}>{autosaveBadge}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
                <Text style={styles.progressLabel}>Готово на {progressPercent}%</Text>
                {countriesSyncedVisible && (
                    <View style={styles.syncBadge}>
                        <Text style={styles.syncBadgeText}>Страны синхронизированы</Text>
                    </View>
                )}
                {markers.length > 0 && (
                    <View style={styles.headerActions}>
                        <Button mode="outlined" onPress={handleScrollToMarkers} compact>
                            Показать точки
                        </Button>
                    </View>
                )}
            </View>

            {stepMeta?.tipBody && (
                <View style={styles.tipCard}>
                    <Text style={styles.tipTitle}>{stepMeta.tipTitle ?? 'Подсказка'}</Text>
                    <Text style={styles.tipBody}>{stepMeta.tipBody}</Text>
                </View>
            )}

            <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.mapHeader}>
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
                            <Text style={styles.coachmarkBody}>Кликните по карте — точка добавится автоматически.</Text>
                        </View>
                        <Button mode="text" onPress={dismissCoachmark} compact>
                            Понятно
                        </Button>
                    </View>
                )}

                <View style={styles.manualPointRow}>
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

                <View style={styles.filtersRow}>
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

                <View style={styles.mapContainer}>
                    <View ref={markersListAnchorRef} nativeID="markers-list-root" />
                    <WebMapComponent
                        markers={markers || []}
                        onMarkersChange={handleMarkersChange}
                        categoryTravelAddress={categoryTravelAddress}
                        countrylist={countries}
                        onCountrySelect={onCountrySelect}
                        onCountryDeselect={onCountryDeselect}
                        travelId={travelId ?? undefined}
                    />
                </View>
            </ScrollView>

            <TravelWizardFooter
                canGoBack={true}
                onBack={onBack}
                onPrimary={handleNext}
                primaryLabel="К медиа"
                onSave={onManualSave}
                saveLabel="Сохранить маршрут"
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: '#f9f9f9' },
    headerWrapper: {
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#f9f9f9',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    headerTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.lg,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#6b7280',
    },
    autosaveBadge: {
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xxs,
        borderRadius: 999,
        backgroundColor: '#eef2ff',
    },
    autosaveBadgeText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#4338ca',
        fontWeight: '600',
    },
    progressBarTrack: {
        marginTop: 8,
        width: '100%',
        height: 6,
        borderRadius: 999,
        backgroundColor: '#e5e7eb',
    },
    progressBarFill: {
        height: 6,
        borderRadius: 999,
        backgroundColor: '#2563eb',
    },
    progressLabel: {
        marginTop: 6,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#6b7280',
    },
    syncBadge: {
        marginTop: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xxs,
        borderRadius: 999,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
    },
    syncBadgeText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#065f46',
        fontWeight: '600',
    },
    headerActions: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    tipCard: {
        marginHorizontal: DESIGN_TOKENS.spacing.lg,
        marginTop: 8,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: 12,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
    },
    tipTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: '#047857',
        marginBottom: 4,
    },
    tipBody: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#065f46',
    },
    content: {
        flex: 1,
        paddingHorizontal: 8,
    },
    contentContainer: {
        paddingBottom: 80,
    },
    mapHeader: {
        paddingHorizontal: 8,
        paddingTop: 12,
        paddingBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    coachmark: {
        marginHorizontal: 8,
        marginBottom: 8,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: 12,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    coachmarkTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        color: '#1e3a8a',
        marginBottom: 2,
    },
    coachmarkBody: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#1e40af',
    },
    manualPointRow: {
        paddingHorizontal: 8,
        paddingBottom: 8,
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    manualPointCard: {
        marginHorizontal: 8,
        marginBottom: 8,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
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
        color: '#6b7280',
        marginBottom: 6,
        fontWeight: '600',
    },
    manualPointInput: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 10,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: 10,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        backgroundColor: '#fff',
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
        color: '#111827',
        marginBottom: DESIGN_TOKENS.spacing.xxs,
    },
    mapHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#6b7280',
    },
    mapCount: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '600',
        color: '#2563eb',
    },
    mapContainer: {
        marginTop: 4,
        paddingHorizontal: 8,
        paddingBottom: DESIGN_TOKENS.spacing.lg,
    },
    filtersRow: {
        paddingHorizontal: 8,
        paddingBottom: 8,
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
        backgroundColor: '#e5e7eb',
        marginBottom: 8,
    },
    filtersSkeletonInput: {
        width: '100%',
        height: 40,
        borderRadius: 8,
        backgroundColor: '#e5e7eb',
    },
});

export default React.memo(TravelWizardStepRoute);
