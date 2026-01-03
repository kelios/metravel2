// app/map/index.tsx
import React, { Suspense, lazy, useMemo } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    ActivityIndicator,
    Platform,
    Pressable,
} from 'react-native';
import IconMaterial from 'react-native-vector-icons/MaterialIcons';

import TravelListPanel from '@/components/MapPage/TravelListPanel';
import SwipeablePanel from '@/components/MapPage/SwipeablePanel';
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
    } = useMapScreenController();

    const mapPanelPlaceholder = useMemo(
        () => (
            <View style={styles.mapPlaceholder}>
                <ActivityIndicator size="large" color={themedColors.primary} />
                <Text style={styles.mapPlaceholderText}>Загружаем карту…</Text>
            </View>
        ),
        [styles.mapPlaceholder, styles.mapPlaceholderText, themedColors.primary],
    );

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
                        <IconMaterial
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
                        <IconMaterial
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
                <IconMaterial name="chevron-right" size={22} color={themedColors.textMuted} />
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
                <View
                    style={styles.content}
                >
                    <View style={styles.mapArea}>
                        {mapReady ? (
                            <Suspense fallback={mapPanelPlaceholder}>
                                <LazyMapPanel
                                    {...mapPanelProps}
                                />
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
                            <IconMaterial name="menu" size={24} color={themedColors.textOnPrimary} />
                        </Pressable>
                    )}

                    {/* Overlay для мобильных устройств */}
                    {isMobile && (
                        <Pressable
                            testID="map-panel-overlay"
                            style={[
                                styles.overlay,
                                rightPanelVisible ? styles.overlayVisible : styles.overlayHidden,
                            ]}
                            onPress={closeRightPanel}
                            accessibilityRole="button"
                            accessibilityLabel="Закрыть панель"
                        />
                    )}

                    {/* Правая панель с табами */}
                    {isMobile ? (
                        <SwipeablePanel
                            isOpen={rightPanelVisible}
                            onClose={closeRightPanel}
                            swipeDirection="right"
                            threshold={80}
                            style={[
                                styles.rightPanel,
                                rightPanelVisible
                                    ? styles.rightPanelMobileOpen
                                    : styles.rightPanelMobileClosed,
                            ]}
                        >
                            <View
                                accessibilityLabel="Панель карты"
                                id="map-panel"
                                ref={panelRef}
                                tabIndex={-1}
                                style={{ flex: 1 }}
                            >
                                {rightPanelVisible ? panelHeader : null}
                                <View style={styles.panelContent}>
                                    {rightPanelTab === 'filters' ? (
                                        <filtersPanelProps.Component {...filtersPanelProps.props} />
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
                                                    />
                                                </>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>
                        </SwipeablePanel>
                    ) : (
                        <View
                            style={[
                                styles.rightPanel,
                                !rightPanelVisible ? styles.rightPanelDesktopClosed : null,
                            ]}
                            accessibilityLabel="Панель карты"
                            id="map-panel"
                            ref={panelRef}
                            tabIndex={-1}
                        >
                            {rightPanelVisible ? panelHeader : null}
                            <View style={styles.panelContent}>
                                {rightPanelTab === 'filters' ? (
                                    <filtersPanelProps.Component {...filtersPanelProps.props} />
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
                                                />
                                            </>
                                        )}
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </>
    );
}
