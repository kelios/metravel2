// app/map/index.tsx
import React, { Suspense, lazy, useMemo } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    ActivityIndicator,
    Platform,
    Pressable,
    Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import TravelListPanel from '@/components/MapPage/TravelListPanel';
import { MapMobileLayout } from '@/components/MapPage/MapMobileLayout';
import InstantSEO from '@/components/seo/InstantSEO';
import { getUserFriendlyNetworkError } from '@/src/utils/networkErrorHandler';
import ErrorDisplay from '@/components/ErrorDisplay';
import { useMapScreenController } from '@/hooks/useMapScreenController';

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

    // Use mobile layout for native platforms (iOS/Android) when on mobile
    const useMobileLayout = isMobile && Platform.OS !== 'web';

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
                    <View style={[styles.tabIconBubble, rightPanelTab === 'filters' && styles.tabIconBubbleActive]}>
                        <MaterialIcons
                            name="filter-list"
                            size={18}
                            color={rightPanelTab === 'filters' ? themedColors.textOnPrimary : themedColors.primary}
                        />
                    </View>
                    <View style={styles.tabLabelColumn}>
                        <Text style={[styles.tabText, rightPanelTab === 'filters' && styles.tabTextActive]}>
                            Фильтры
                        </Text>
                        <Text style={[styles.tabHint, rightPanelTab === 'filters' && styles.tabHintActive]}>
                            Настрой параметров
                        </Text>
                    </View>
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
                    <View style={[styles.tabIconBubble, rightPanelTab === 'travels' && styles.tabIconBubbleActive]}>
                        <MaterialIcons
                            name="list"
                            size={18}
                            color={rightPanelTab === 'travels' ? themedColors.textOnPrimary : themedColors.primary}
                        />
                    </View>
                    <View style={styles.tabLabelColumn}>
                        <Text style={[styles.tabText, rightPanelTab === 'travels' && styles.tabTextActive]}>
                            Список
                        </Text>
                        <Text style={[styles.tabHint, rightPanelTab === 'travels' && styles.tabHintActive]}>
                            {travelsData.length} мест
                        </Text>
                    </View>
                </Pressable>
            </View>

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
                    <View style={styles.mapArea}>
                        {mapReady ? (
                            <Suspense fallback={mapPanelPlaceholder}>
                                <LazyMapPanel {...mapPanelProps} />
                            </Suspense>
                        ) : (
                            mapPanelPlaceholder
                        )}
                    </View>

                    {/* ✅ ИСПРАВЛЕНИЕ: RouteHint и RouteStats перенесены в боковую панель */}

                    {/* Кнопка для показа/скрытия панели */}
                    {!rightPanelVisible && (
                        <Pressable
                            testID="map-open-panel-button"
                            style={styles.togglePanelButton}
                            onPress={openRightPanel}
                            accessibilityRole="button"
                            accessibilityLabel="Показать панель"
                        >
                            <MaterialIcons name="menu" size={24} color={themedColors.textOnPrimary} />
                        </Pressable>
                    )}

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
                                        <FiltersPanelComponent {...filtersPanelProps.props} />
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
