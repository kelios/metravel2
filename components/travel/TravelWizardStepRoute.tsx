import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, StyleSheet, Text, ScrollView, Dimensions } from 'react-native';
import { Button } from 'react-native-paper';

import WebMapComponent from '@/components/travel/WebMapComponent';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { MarkerData } from '@/src/types/types';
import MultiSelectField from '@/components/MultiSelectField';

interface TravelWizardStepRouteProps {
    currentStep: number;
    totalSteps: number;
    markers: MarkerData[];
    setMarkers: (data: MarkerData[]) => void;
    categoryTravelAddress: any[];
    countries: any[];
    selectedCountryIds: string[];
    onCountrySelect: (countryId: string) => void;
    onCountryDeselect: (countryId: string) => void;
    onBack: () => void;
    onNext: () => void;
}

const windowWidth = Dimensions.get('window').width;
const isMobileDefault = windowWidth <= 768;

const TravelWizardStepRoute: React.FC<TravelWizardStepRouteProps> = ({
    currentStep,
    totalSteps,
    markers,
    setMarkers,
    categoryTravelAddress,
    countries,
    selectedCountryIds,
    onCountrySelect,
    onCountryDeselect,
    onBack,
    onNext,
}) => {
    const isMobile = isMobileDefault;

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
                <Text style={styles.headerTitle}>Маршрут путешествия</Text>
                <Text style={styles.headerSubtitle}>
                    Шаг {currentStep} из {totalSteps} · Маршрут на карте (предыдущий: Основное · следующий: Медиа)
                </Text>
                {markers.length > 0 && (
                    <View style={styles.headerActions}>
                        <Button mode="outlined" onPress={handleScrollToMarkers} compact>
                            Показать точки
                        </Button>
                    </View>
                )}
            </View>

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
                        <MultiSelectField
                            label="Страны маршрута"
                            items={countries}
                            value={selectedCountryIds}
                            onChange={handleCountriesFilterChange}
                            labelField="title_ru"
                            valueField="country_id"
                        />
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
                    />
                </View>
            </ScrollView>

            <TravelWizardFooter
                canGoBack={true}
                onBack={onBack}
                onPrimary={handleNext}
                primaryLabel="К медиа"
                primaryDisabled={!hasAtLeastOnePoint}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: '#f9f9f9' },
    headerWrapper: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#f9f9f9',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#6b7280',
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
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    mapHint: {
        fontSize: 12,
        color: '#6b7280',
    },
    mapCount: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2563eb',
    },
    mapContainer: {
        marginTop: 4,
        paddingHorizontal: 8,
        paddingBottom: 16,
    },
});

export default TravelWizardStepRoute;
