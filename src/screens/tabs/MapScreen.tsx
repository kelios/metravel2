// src/screens/tabs/MapScreen.tsx
import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    ActivityIndicator,
    Platform,
    Pressable,
    Animated,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import { getUserFriendlyNetworkError } from '@/src/utils/networkErrorHandler';
import ErrorDisplay from '@/components/ErrorDisplay';
import { useMapScreenController } from '@/hooks/useMapScreenController';
import { useMapPanelStore } from '@/stores/mapPanelStore';

const LazyMapPanel = lazy(() => import('@/components/MapPage/MapPanel'));
const LazyTravelListPanel = lazy(() => import('@/components/MapPage/TravelListPanel'));
const LazyMapMobileLayout = lazy(() =>
    import('@/components/MapPage/MapMobileLayout').then((mod) => ({ default: mod.MapMobileLayout }))
);

export default function MapScreen() {
    const {
        canonical,
        isFocused,
        isMobile,
        themedColors,
        styles,
        mapReady,
        mapPanelProps,
        rightPanelTab,
        rightPanelVisible,
        selectFiltersTab,
        selectTravelsTab,
        openRightPanel,
        closeRightPanel,
        panelStyle,
        overlayStyle,
        filtersPanelProps,
        travelsData,
        loading,
        isFetching,
        isPlaceholderData,
        mapError,
        mapErrorDetails,
        refetchMapData,
        invalidateTravelsQuery,
        buildRouteTo,
        centerOnUser,
        filtersTabRef,
        panelRef,
        coordinates,
        transportMode,
    } = useMapScreenController();

    const openNonce = useMapPanelStore((s) => s.openNonce);

    const openRightPanelRef = useRef(openRightPanel);
    useEffect(() => {
        openRightPanelRef.current = openRightPanel;
    }, [openRightPanel]);

    useEffect(() => {
        if (!openNonce) return;
        openRightPanelRef.current();
    }, [openNonce]);

    const FiltersPanelComponent = filtersPanelProps?.Component;

    const mapPanelPlaceholder = useMemo(
        () => {
            const { MapPageSkeleton } = require('@/components/MapPage/MapPageSkeleton');
            return <MapPageSkeleton />;
        },
        [],
    );

    // Map component for mobile layout
    const mapComponent = useMemo(
        () => (
            <View style={styles.mapArea}>
                {mapReady ? (
                    <Suspense fallback={mapPanelPlaceholder}>
                        <LazyMapPanel {...mapPanelProps} />
                    </Suspense>
                ) : (
                    mapPanelPlaceholder
                )}
            </View>
        ),
        [
            mapPanelPlaceholder,
            mapPanelProps,
            mapReady,
            styles.mapArea,
        ]
    );

    // Use mobile layout on small screens (including web), desktop keeps right panel
    const useMobileLayout = isMobile;

    if (useMobileLayout) {
        return (
            <>
                {isFocused && Platform.OS === 'web' && (
                    <InstantSEO
                        headKey="map"
                        title="Карта путешествий | MeTravel"
                        description="Интерактивная карта с маршрутами и местами для путешествий"
                        canonical={canonical}
                    />
                )}
                <Suspense fallback={mapPanelPlaceholder}>
                    <LazyMapMobileLayout
                        mapComponent={mapComponent}
                        travelsData={travelsData}
                        coordinates={coordinates}
                        transportMode={transportMode}
                        buildRouteTo={buildRouteTo}
                        onCenterOnUser={centerOnUser}
                        onOpenFilters={selectFiltersTab}
                        filtersPanelProps={filtersPanelProps}
                    />
                </Suspense>
            </>
        );
    }

    // Panel content header
    const panelHeader = (
        <View style={styles.tabsContainer}>
            {/* Drag handle для мобильных */}
            {isMobile && (
                <View style={styles.dragHandle} />
            )}
            <View style={styles.tabsSegment}>
                <Pressable
                    ref={filtersTabRef}
                    testID="map-panel-tab-filters"
                    style={({ pressed }) => [
                        styles.tab,
                        rightPanelTab === 'filters' && styles.tabActive,
                        pressed && styles.tabPressed,
                    ]}
                    onPress={selectFiltersTab}
                    hitSlop={8}
                    android_ripple={{ color: themedColors.overlayLight }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: rightPanelTab === 'filters' }}
                    accessibilityLabel="Фильтры"
                >
                    <MaterialIcons
                        name="filter-list"
                        size={isMobile ? 22 : 18}
                        color={rightPanelTab === 'filters' ? themedColors.textInverse : themedColors.text}
                    />
                    {!isMobile && (
                        <View style={styles.tabLabelColumn}>
                            <Text style={[styles.tabText, rightPanelTab === 'filters' && styles.tabTextActive]}>
                                Фильтры
                            </Text>
                            <Text style={[styles.tabHint, rightPanelTab === 'filters' && styles.tabHintActive]}>
                                Настрой параметров
                            </Text>
                        </View>
                    )}
                </Pressable>

                <Pressable
                    testID="map-panel-tab-travels"
                    style={({ pressed }) => [
                        styles.tab,
                        rightPanelTab === 'travels' && styles.tabActive,
                        pressed && styles.tabPressed,
                    ]}
                    onPress={selectTravelsTab}
                    hitSlop={8}
                    android_ripple={{ color: themedColors.overlayLight }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: rightPanelTab === 'travels' }}
                    accessibilityLabel="Список"
                >
                    <MaterialIcons
                        name="list"
                        size={isMobile ? 22 : 18}
                        color={rightPanelTab === 'travels' ? themedColors.textInverse : themedColors.text}
                    />
                    {!isMobile && (
                        <View style={styles.tabLabelColumn}>
                            <Text style={[styles.tabText, rightPanelTab === 'travels' && styles.tabTextActive]}>
                                Список
                            </Text>
                            <Text style={[styles.tabHint, rightPanelTab === 'travels' && styles.tabHintActive]}>
                                {travelsData.length} мест
                            </Text>
                        </View>
                    )}
                </Pressable>
            </View>

            {Platform.OS === 'web' && !isMobile ? (
                <Pressable
                    testID="map-reset-filters-button"
                    style={({ pressed }) => [styles.closePanelButton, pressed && { opacity: 0.7 }]}
                    onPress={() => {
                        selectFiltersTab();
                        const reset = (filtersPanelProps as any)?.props?.resetFilters;
                        if (typeof reset === 'function') reset();
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Сбросить фильтры"
                >
                    <MaterialIcons name="refresh" size={20} color={themedColors.textMuted} />
                </Pressable>
            ) : (
                <Pressable
                    testID="map-close-panel-button"
                    style={({ pressed }) => [styles.closePanelButton, pressed && { opacity: 0.7 }]}
                    onPress={closeRightPanel}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Закрыть панель"
                >
                    <MaterialIcons name="close" size={22} color={themedColors.textMuted} />
                </Pressable>
            )}
        </View>
    );

    // Error state
    if (mapError) {
        const friendly = getUserFriendlyNetworkError(mapErrorDetails || mapError);
        return (
            <SafeAreaView style={styles.container}>
                {isFocused && Platform.OS === 'web' && (
                    <InstantSEO
                        headKey="map-error"
                        title="Карта путешествий | MeTravel"
                        description="Интерактивная карта с маршрутами и местами для путешествий"
                        canonical={canonical}
                    />
                )}
                <ErrorDisplay
                    title="Не удалось загрузить карту"
                    message={friendly?.message || 'Проверьте соединение и попробуйте ещё раз'}
                    actionText="Повторить"
                    onRetry={() => {
                        invalidateTravelsQuery();
                        refetchMapData();
                    }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {isFocused && Platform.OS === 'web' && (
                <InstantSEO
                    headKey="map"
                    title="Карта путешествий | MeTravel"
                    description="Интерактивная карта с маршрутами и местами для путешествий"
                    canonical={canonical}
                />
            )}

            <View style={styles.mapContainer}>
                {mapComponent}
                {rightPanelVisible && (
                    <Animated.View style={[styles.overlay, overlayStyle]} />
                )}
            </View>

            <Animated.View ref={panelRef} style={[styles.rightPanel, panelStyle]}>
                {panelHeader}
                <View style={styles.panelContent}>
                    {rightPanelTab === 'filters' ? (
                        FiltersPanelComponent ? (
                            <FiltersPanelComponent {...filtersPanelProps.props} />
                        ) : (
                            <View style={styles.panelPlaceholder}>
                                <Text style={styles.panelPlaceholderText}>Загрузка фильтров…</Text>
                            </View>
                        )
                    ) : (
                        <View testID="map-travels-tab" style={{ flex: 1 }}>
                            <Suspense fallback={null}>
                                <LazyTravelListPanel
                                    travelsData={travelsData}
                                    buildRouteTo={buildRouteTo}
                                    isMobile={isMobile}
                                    isLoading={loading || isFetching}
                                    isRefreshing={isFetching && isPlaceholderData}
                                    userLocation={coordinates}
                                    transportMode={transportMode}
                                />
                            </Suspense>
                        </View>
                    )}
                </View>
            </Animated.View>

            {Platform.OS !== 'web' && (
                <Pressable
                    style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
                    onPress={openRightPanel}
                    accessibilityRole="button"
                    accessibilityLabel="Открыть панель"
                >
                    <MaterialIcons name="tune" size={24} color={themedColors.textOnPrimary} />
                </Pressable>
            )}

            {(loading || !mapReady) && (
                <View style={styles.loadingOverlay} pointerEvents="none" testID="map-loading-overlay">
                    <ActivityIndicator color={themedColors.primary} />
                </View>
            )}
        </SafeAreaView>
    );
}
