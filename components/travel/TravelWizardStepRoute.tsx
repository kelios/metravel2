import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, StyleSheet, Text, ScrollView, Dimensions } from 'react-native';
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
}

const windowWidth = Dimensions.get('window').width;
const isMobileDefault = windowWidth <= 768;
const MultiSelectFieldAny: any = MultiSelectField;

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
}) => {
    const isMobile = isMobileDefault;

    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);

    const hasAtLeastOnePoint = useMemo(() => markers && markers.length > 0, [markers]);

    const handleMarkersChange = (updated: MarkerData[]) => {
        setMarkers(updated);
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
        if (!hasAtLeastOnePoint) {
            // Локальная простая защита: не даём уйти дальше без точки.
            // Детализированное сообщение пользователю обеспечивается на уровне
            // карты/подсказок по ТЗ.
            return;
        }
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

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.mapHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.mapTitle}>Ключевые точки маршрута</Text>
                        <Text style={styles.mapHint}>
                            Добавьте хотя бы одну точку маршрута на карте — без этого нельзя перейти к медиа.
                        </Text>
                    </View>
                    <Text style={styles.mapCount}>Точек: {markers?.length ?? 0}</Text>
                </View>

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
                primaryDisabled={!hasAtLeastOnePoint}
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
