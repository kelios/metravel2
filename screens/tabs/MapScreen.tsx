// src/screens/tabs/MapScreen.tsx
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getUserFriendlyNetworkError } from '@/utils/networkErrorHandler';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import { useMapScreenController } from '@/hooks/useMapScreenController';
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton';
import { useMapPanelStore } from '@/stores/mapPanelStore';
import MapOnboarding from '@/components/MapPage/MapOnboarding';
import { MapLoadingBar } from '@/components/MapPage/MapLoadingBar';
import { MapQuickFilters } from '@/components/MapPage/MapQuickFilters';
import { ActiveFiltersBar } from '@/components/MapPage/ActiveFiltersBar';
import { MapShowListButton } from '@/components/MapPage/MapShowListButton';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import { useRouteStore } from '@/stores/routeStore';

const LazyMapPanel = lazy(() => import('@/components/MapPage/MapPanel'));
const LazyTravelListPanel = lazy(() => import('@/components/MapPage/TravelListPanel'));
const LazyMapMobileLayout = lazy(() =>
    import('@/components/MapPage/MapMobileLayout').then((mod) => ({ default: mod.MapMobileLayout }))
);

const MAP_SEO_DESCRIPTION =
    'Интерактивная карта путешествий Metravel: находите маршруты, достопримечательности и идеи поездок, фильтруйте точки и стройте свой путь.';

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
        isDesktopCollapsed,
        desktopPanelWidth,
        selectFiltersTab,
        selectTravelsTab,
        openRightPanel,
        closeRightPanel,
        toggleDesktopCollapse,
        onResizePanelWidth,
        panelStyle,
        overlayStyle,
        filtersPanelProps,
        travelsData,
        loading,
        isFetching,
        isPlaceholderData,
        hasMore,
        onLoadMore,
        mapError,
        mapErrorDetails,
        refetchMapData,
        invalidateTravelsQuery,
        buildRouteTo,
        centerOnUser,
        panelRef,
        geoError,
        coordinates,
        transportMode,
    } = useMapScreenController();

    const [geoBannerDismissed, setGeoBannerDismissed] = useState(false);
    const dismissGeoBanner = useCallback(() => setGeoBannerDismissed(true), []);
    const showGeoBanner = Boolean(geoError && !geoBannerDismissed);

    // Resize handle for desktop panel (web only)
    const handleResizeMouseDown = useCallback((e: any) => {
        if (Platform.OS !== 'web' || isMobile) return;
        e.preventDefault();
        const startX = e.clientX;
        const startW = desktopPanelWidth;
        const onMove = (ev: MouseEvent) => {
            // Panel is on the right, dragging left = wider
            const delta = startX - ev.clientX;
            onResizePanelWidth(startW + delta);
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [isMobile, desktopPanelWidth, onResizePanelWidth]);

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
        () => <MapPageSkeleton inline />,
        [],
    );

    // Quick filter chips + active filters bar
    const quickFilterCategories = useMemo(() => {
        const cats = filtersPanelProps?.contextValue?.filters?.categories ?? [];
        if (!cats.length || !travelsData.length) return cats;
        // Sort by popularity: count how many travel items belong to each category
        const countMap = new Map<string, number>();
        for (const t of travelsData) {
            const names = (t.categoryName || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            for (const n of names) countMap.set(n, (countMap.get(n) || 0) + 1);
        }
        return [...cats].sort((a, b) => (countMap.get(b.name) || 0) - (countMap.get(a.name) || 0));
    }, [filtersPanelProps?.contextValue?.filters?.categories, travelsData]);
    const quickFilterSelected: string[] = useMemo(
        () => filtersPanelProps?.contextValue?.filterValue?.categories ?? [],
        [filtersPanelProps?.contextValue?.filterValue?.categories],
    );
    const currentRadius = filtersPanelProps?.contextValue?.filterValue?.radius ?? '';
    const quickFilterToggle = useCallback((name: string) => {
        const onChange = filtersPanelProps?.contextValue?.onFilterChange;
        if (!onChange) return;
        const current: string[] = filtersPanelProps?.contextValue?.filterValue?.categories ?? [];
        const next = current.includes(name)
            ? current.filter((c: string) => c !== name)
            : [...current, name];
        onChange('categories', next);
    }, [filtersPanelProps?.contextValue?.onFilterChange, filtersPanelProps?.contextValue?.filterValue?.categories]);

    const currentMode = filtersPanelProps?.contextValue?.mode ?? 'radius';
    const currentTransport = transportMode ?? 'car';

    const activeFilterItems = useMemo(() => {
        const items: { key: string; label: string }[] = [];
        quickFilterSelected.forEach((cat: string) => items.push({ key: `cat:${cat}`, label: cat }));
        if (currentRadius && currentRadius !== String(DEFAULT_RADIUS_KM)) {
            items.push({ key: 'radius', label: `${currentRadius} км` });
        }
        if (currentMode === 'route') {
            items.push({ key: 'mode', label: 'Маршрут' });
        }
        if (currentTransport !== 'car') {
            const transportLabels: Record<string, string> = { bike: 'Велосипед', foot: 'Пешком' };
            items.push({ key: 'transport', label: transportLabels[currentTransport] ?? currentTransport });
        }
        return items;
    }, [quickFilterSelected, currentRadius, currentMode, currentTransport]);

    const handleRemoveActiveFilter = useCallback((key: string) => {
        const onChange = filtersPanelProps?.contextValue?.onFilterChange;
        if (!onChange) return;
        if (key.startsWith('cat:')) {
            const catName = key.slice(4);
            const current: string[] = filtersPanelProps?.contextValue?.filterValue?.categories ?? [];
            onChange('categories', current.filter((c: string) => c !== catName));
        } else if (key === 'radius') {
            onChange('radius', String(DEFAULT_RADIUS_KM));
        } else if (key === 'mode') {
            // Atomic: clear route and switch to radius so the query doesn't get disabled on an intermediate render.
            useRouteStore.getState().clearRouteAndSetMode('radius');
        } else if (key === 'transport') {
            const setTransport = filtersPanelProps?.contextValue?.setTransportMode;
            if (typeof setTransport === 'function') setTransport('car');
        }
    }, [filtersPanelProps?.contextValue?.onFilterChange, filtersPanelProps?.contextValue?.filterValue?.categories, filtersPanelProps?.contextValue?.setTransportMode]);

    const handleClearAllFilters = useCallback(() => {
        const reset = filtersPanelProps?.contextValue?.resetFilters;
        if (typeof reset === 'function') reset();
    }, [filtersPanelProps?.contextValue?.resetFilters]);

    const requestOpenBottomSheet = useMapPanelStore((s) => s.requestOpen);

    const handleExpandRadius = useCallback(() => {
        const onChange = filtersPanelProps?.contextValue?.onFilterChange;
        if (!onChange) return;
        const current = Number(filtersPanelProps?.contextValue?.filterValue?.radius) || 30;
        const next = Math.min(current * 2, 500);
        onChange('radius', String(next));
    }, [filtersPanelProps?.contextValue?.onFilterChange, filtersPanelProps?.contextValue?.filterValue?.radius]);

    const mapComponent = useMemo(
        () => (
            <View style={styles.mapArea}>
                <MapLoadingBar visible={isFetching} />
                {Platform.OS === 'web' && quickFilterCategories.length > 0 && (
                    <MapQuickFilters
                        categories={quickFilterCategories}
                        selectedCategories={quickFilterSelected}
                        onToggleCategory={quickFilterToggle}
                        maxVisible={isMobile ? 3 : 5}
                    />
                )}
                {Platform.OS === 'web' && !isMobile && travelsData.length > 0 && rightPanelTab !== 'travels' && (
                    <MapShowListButton
                        count={travelsData.length}
                        onPress={selectTravelsTab}
                    />
                )}
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
            isFetching,
            isMobile,
            mapPanelPlaceholder,
            mapPanelProps,
            mapReady,
            quickFilterCategories,
            quickFilterSelected,
            quickFilterToggle,
            rightPanelTab,
            selectTravelsTab,
            travelsData.length,
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
                        description={MAP_SEO_DESCRIPTION}
                        canonical={canonical}
                    />
                )}
                <Suspense fallback={mapPanelPlaceholder}>
                    <LazyMapMobileLayout
                        mapComponent={mapComponent}
                        travelsData={travelsData}
                        hasMore={hasMore}
                        onLoadMore={onLoadMore}
                        onRefresh={refetchMapData}
                        isRefreshing={isFetching && isPlaceholderData}
                        coordinates={coordinates}
                        transportMode={transportMode}
                        buildRouteTo={buildRouteTo}
                        onCenterOnUser={centerOnUser}
                        onOpenFilters={() => {
                            selectFiltersTab();
                            requestOpenBottomSheet();
                        }}
                        filtersPanelProps={filtersPanelProps}
                        onResetFilters={handleClearAllFilters}
                        onExpandRadius={handleExpandRadius}
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
            <View style={styles.tabsSegment} accessibilityRole="tablist" aria-label="Панель карты">
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
                        <Text style={[styles.tabText, rightPanelTab === 'filters' && styles.tabTextActive]}>
                            Фильтры
                        </Text>
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
                    accessibilityLabel={`Список (${travelsData.length} мест)`}
                >
                    <Feather
                        name="list"
                        size={isMobile ? 22 : 18}
                        color={rightPanelTab === 'travels' ? themedColors.textInverse : themedColors.text}
                    />
                    {!isMobile && (
                        <Text style={[styles.tabText, rightPanelTab === 'travels' && styles.tabTextActive]}>
                            Список
                        </Text>
                    )}
                    {travelsData.length > 0 && (
                        <View style={[
                            styles.badge,
                            rightPanelTab === 'travels' && styles.badgeActive,
                        ]}>
                            <Text style={[
                                styles.badgeText,
                                rightPanelTab === 'travels' && styles.badgeTextActive,
                            ]}>
                                {travelsData.length > 99 ? '99+' : travelsData.length}
                            </Text>
                        </View>
                    )}
                </Pressable>
            </View>

            {Platform.OS === 'web' && !isMobile ? (
                <Pressable
                    testID="map-reset-filters-button"
                    style={({ pressed }) => [styles.resetButton, pressed && { opacity: 0.7 }]}
                    onPress={() => {
                        selectFiltersTab();
                        const reset = filtersPanelProps?.contextValue?.resetFilters;
                        if (typeof reset === 'function') reset();
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Сбросить фильтры"
                >
                    <Feather name="refresh-cw" size={14} color={themedColors.textMuted} />
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
                        description={MAP_SEO_DESCRIPTION}
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
                    description={MAP_SEO_DESCRIPTION}
                    canonical={canonical}
                />
            )}

            {showGeoBanner && (
                <View style={styles.geoBanner} testID="map-geo-banner">
                    <Feather name="map-pin" size={14} color={themedColors.warning} />
                    <Text style={styles.geoBannerText}>
                        Геолокация недоступна — показываем карту по умолчанию
                    </Text>
                    <Pressable
                        onPress={dismissGeoBanner}
                        accessibilityRole="button"
                        accessibilityLabel="Закрыть уведомление"
                        style={({ pressed }) => [styles.geoBannerClose, pressed && { opacity: 0.6 }]}
                    >
                        <Feather name="x" size={14} color={themedColors.textMuted} />
                    </Pressable>
                </View>
            )}

            <View style={styles.mapContainer}>
                {/* Desktop collapsed strip */}
                {!isMobile && isDesktopCollapsed && Platform.OS === 'web' && (
                    <View
                        testID="map-panel-collapsed"
                        style={styles.collapsedPanel}
                    >
                        <Pressable
                            testID="map-panel-expand-button"
                            style={({ pressed }) => [styles.collapseToggle, pressed && { opacity: 0.7 }]}
                            onPress={toggleDesktopCollapse}
                            accessibilityRole="button"
                            accessibilityLabel="Развернуть панель"
                        >
                            <Feather name="chevron-left" size={18} color={themedColors.text} />
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [styles.collapsedIconBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => { toggleDesktopCollapse(); selectFiltersTab(); }}
                            accessibilityRole="button"
                            accessibilityLabel="Фильтры"
                        >
                            <Feather name="filter" size={18} color={themedColors.textMuted} />
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [styles.collapsedIconBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => { toggleDesktopCollapse(); selectTravelsTab(); }}
                            accessibilityRole="button"
                            accessibilityLabel={`Список (${travelsData.length})`}
                        >
                            <Feather name="list" size={18} color={themedColors.textMuted} />
                            {travelsData.length > 0 && (
                                <View style={styles.collapsedBadge}>
                                    <Text style={styles.collapsedBadgeText}>
                                        {travelsData.length > 99 ? '99+' : travelsData.length}
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    </View>
                )}

                {/* Desktop expanded panel */}
                {!(isDesktopCollapsed && !isMobile && Platform.OS === 'web') && (
                <Animated.View ref={panelRef} style={[styles.rightPanel, panelStyle, !isMobile && Platform.OS === 'web' ? { width: desktopPanelWidth } : null]}>
                {/* Resize handle on desktop */}
                {!isMobile && Platform.OS === 'web' && (
                    <View
                        testID="map-panel-resize-handle"
                        style={styles.resizeHandle}
                        onStartShouldSetResponder={() => true}
                        {...({ onMouseDown: handleResizeMouseDown } as any)}
                    />
                )}
                {/* Collapse button on desktop */}
                {!isMobile && Platform.OS === 'web' && (
                    <Pressable
                        testID="map-panel-collapse-button"
                        style={({ pressed }) => [styles.collapseToggleInPanel, pressed && { opacity: 0.7 }]}
                        onPress={toggleDesktopCollapse}
                        accessibilityRole="button"
                        accessibilityLabel="Свернуть панель"
                    >
                        <Feather name="chevron-right" size={16} color={themedColors.textMuted} />
                    </Pressable>
                )}
                {panelHeader}
                {!isMobile && activeFilterItems.length > 0 && (
                    <ActiveFiltersBar
                        filters={activeFilterItems}
                        onRemoveFilter={handleRemoveActiveFilter}
                        onClearAll={handleClearAllFilters}
                    />
                )}
                <View style={styles.panelContent}>
                    {rightPanelTab === 'filters' ? (
                        filtersPanelProps?.Component ? (
                            <filtersPanelProps.Component {...filtersPanelProps.contextValue}>
                                <filtersPanelProps.Panel hideFooterReset={!isMobile} />
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
                                    hasMore={hasMore}
                                    onLoadMore={onLoadMore}
                                    isRefreshing={isFetching && isPlaceholderData}
                                    onRefresh={refetchMapData}
                                    userLocation={coordinates}
                                    transportMode={transportMode}
                                    onResetFilters={handleClearAllFilters}
                                    onExpandRadius={handleExpandRadius}
                                />
                            </Suspense>
                        </View>
                    )}
                </View>
            </Animated.View>
                )}
                
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
                <View style={[styles.loadingOverlay, { pointerEvents: 'none' }]} testID="map-loading-overlay">
                    <ActivityIndicator color={themedColors.primary} />
                </View>
            )}

            {/* Onboarding для новых пользователей */}
            <MapOnboarding />
        </View>
    );
}
