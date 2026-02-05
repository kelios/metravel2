// src/screens/tabs/MapScreen.tsx
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    Platform,
    Pressable,
    Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import { getUserFriendlyNetworkError } from '@/src/utils/networkErrorHandler';
import ErrorDisplay from '@/components/ErrorDisplay';
import { useMapScreenController } from '@/hooks/useMapScreenController';
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton';
import { useMapPanelStore } from '@/stores/mapPanelStore';

const LazyMapPanel = lazy(() => import('@/components/MapPage/MapPanel'));
const LazyTravelListPanel = lazy(() => import('@/components/MapPage/TravelListPanel'));
const LazyMapMobileLayout = lazy(() =>
    import('@/components/MapPage/MapMobileLayout').then((mod) => ({ default: mod.MapMobileLayout }))
);

export default function MapScreen() {
    const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
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
        panelRef,
        coordinates,
        transportMode,
    } = useMapScreenController();

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        setHydrated(true);
    }, []);

    const openNonce = useMapPanelStore((s) => s.openNonce);

    const openRightPanelRef = useRef(openRightPanel);
    useEffect(() => {
        openRightPanelRef.current = openRightPanel;
    }, [openRightPanel]);

    useEffect(() => {
        if (!openNonce) return;
        openRightPanelRef.current();
    }, [openNonce]);


    const mapPanelPlaceholder = useMemo(
        () => <MapPageSkeleton />,
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

    if (!hydrated && Platform.OS === 'web') {
        return <MapPageSkeleton />;
    }

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
                    <Feather
                        name="filter"
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
                    <Feather
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
                        const reset = filtersPanelProps?.contextValue?.resetFilters;
                        if (typeof reset === 'function') reset();
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Сбросить фильтры"
                >
                    <Feather name="refresh-cw" size={20} color={themedColors.textMuted} />
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
                    <Feather name="x" size={22} color={themedColors.textMuted} />
                </Pressable>
            )}
        </View>
    );

    // Error state
    if (mapError) {
        const friendly = getUserFriendlyNetworkError(mapErrorDetails || mapError);
        const friendlyMessage = (friendly as any)?.message ?? String(friendly || '');
        return (
            <View style={styles.container}>
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
                    message={friendlyMessage || 'Проверьте соединение и попробуйте ещё раз'}
                    onRetry={() => {
                        invalidateTravelsQuery();
                        refetchMapData();
                    }}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {isFocused && Platform.OS === 'web' && (
                <InstantSEO
                    headKey="map"
                    title="Карта путешествий | MeTravel"
                    description="Интерактивная карта с маршрутами и местами для путешествий"
                    canonical={canonical}
                />
            )}

            <View style={styles.mapContainer}>
                <Animated.View ref={panelRef} style={[styles.rightPanel, panelStyle]}>
                {panelHeader}
                <View style={styles.panelContent}>
                    {rightPanelTab === 'filters' ? (
                        filtersPanelProps?.Component ? (
                            <filtersPanelProps.Component {...filtersPanelProps.contextValue}>
                                <filtersPanelProps.Panel />
                            </filtersPanelProps.Component>
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
                
                {mapComponent}
                {rightPanelVisible && isMobile && (
                    <Animated.View style={[styles.overlay, overlayStyle]} />
                )}
            </View>

            {Platform.OS !== 'web' && (
                <Pressable
                    style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
                    onPress={openRightPanel}
                    accessibilityRole="button"
                    accessibilityLabel="Открыть панель"
                >
                    <Feather name="sliders" size={24} color={themedColors.textOnPrimary} />
                </Pressable>
            )}

            {(loading || !mapReady) && (
                <View style={styles.loadingOverlay} pointerEvents="none" testID="map-loading-overlay">
                    <ActivityIndicator color={themedColors.primary} />
                </View>
            )}
        </View>
    );
}
