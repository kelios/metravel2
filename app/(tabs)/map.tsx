// app/map/index.tsx
import React, { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
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

import TravelListPanel from '@/components/MapPage/TravelListPanel';
import { MapMobileLayout } from '@/components/MapPage/MapMobileLayout';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { getUserFriendlyNetworkError } from '@/src/utils/networkErrorHandler';
import ErrorDisplay from '@/components/ErrorDisplay';
import { useMapScreenController } from '@/hooks/useMapScreenController';
import { useMapPanelStore } from '@/stores/mapPanelStore';

// Ensure RouteHint is bundled (used inside FiltersPanel)
import '@/components/MapPage/RouteHint';

const LazyMapPanel = lazy(() => import('@/components/MapPage/MapPanel'));

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

    const FiltersPanelComponent = filtersPanelProps.Component;

    const mapPanelPlaceholder = useMemo(
        () => (
            <View style={styles.mapPlaceholder}>
                <ActivityIndicator size="large" color={themedColors.primary} />
                <Text style={styles.mapPlaceholderText}>Загружаем карту…</Text>
            </View>
        ),
        [styles.mapPlaceholder, styles.mapPlaceholderText, themedColors.primary],
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
        [mapReady, mapPanelProps, mapPanelPlaceholder, styles.mapArea]
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
                <MapMobileLayout
                    mapComponent={mapComponent}
                    travelsData={travelsData}
                    coordinates={coordinates}
                    transportMode={transportMode}
                    buildRouteTo={buildRouteTo}
                    onCenterOnUser={() => {
                        // TODO: Implement center on user location
                        console.info('Center on user location');
                    }}
                    onOpenFilters={selectFiltersTab}
                    filtersPanelProps={filtersPanelProps}
                />
            </>
        );
    }

    // Функция рендеринга содержимого панели
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
                    accessibilityLabel="Скрыть панель"
                >
                    <MaterialIcons name="chevron-right" size={22} color={themedColors.textMuted} />
                </Pressable>
            )}
        </View>
    );

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
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                {mapComponent}

                {/* ✅ ИСПРАВЛЕНИЕ: RouteHint и RouteStats перенесены в боковую панель */}

                    {/* Overlay для мобильных устройств */}
                    {isMobile && rightPanelVisible && (
                        <Animated.View style={[styles.overlay, overlayStyle]}>
                            <Pressable
                                testID="map-panel-overlay"
                                style={{ flex: 1 }}
                                onPress={closeRightPanel}
                                accessibilityRole="button"
                                accessibilityLabel="Закрыть панель"
                            />
                        </Animated.View>
                    )}

                    <Animated.View
                        style={[styles.rightPanel, panelStyle]}
                        accessibilityLabel="Панель карты"
                        id="map-panel"
                        ref={panelRef}
                        tabIndex={-1}
                    >
                        {rightPanelVisible && (
                            <>
                                {panelHeader}
                                <View style={styles.panelContent}>
                                    {rightPanelTab === 'filters' ? (
                                        <FiltersPanelComponent
                                            {...filtersPanelProps.props}
                                            hideFooterReset={Platform.OS === 'web' && !isMobile}
                                        />
                                    ) : (
                                        <View style={styles.travelsListContainer} testID="map-travels-tab">
                                            {loading && !isPlaceholderData ? (
                                                <View style={styles.loader}>
                                                    <ActivityIndicator size="small" color={themedColors.primary} />
                                                    <Text style={styles.loaderText}>Загрузка...</Text>
                                                </View>
                                            ) : mapError ? (
                                                <View style={styles.errorContainer}>
                                                    <ErrorDisplay
                                                        message={getUserFriendlyNetworkError(mapErrorDetails)}
                                                        onRetry={refetchMapData}
                                                        variant="error"
                                                    />
                                                </View>
                                            ) : (
                                                <>
                                                    {isFetching && isPlaceholderData && (
                                                        <View style={styles.updatingIndicator}>
                                                            <ActivityIndicator size="small" color={themedColors.primary} />
                                                            <Text style={styles.updatingText}>Обновление...</Text>
                                                        </View>
                                                    )}
                                                    <TravelListPanel
                                                        travelsData={travelsData}
                                                        buildRouteTo={buildRouteTo}
                                                        isMobile={isMobile}
                                                        isLoading={loading && !isPlaceholderData}
                                                        onRefresh={invalidateTravelsQuery}
                                                        isRefreshing={isFetching && !isPlaceholderData}
                                                        userLocation={mapPanelProps.coordinates}
                                                        transportMode={mapPanelProps.transportMode}
                                                    />
                                                </>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </>
                        )}
                    </Animated.View>
                </View>
            </SafeAreaView>
        </>
    );
}
