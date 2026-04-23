// src/screens/tabs/MapScreen.tsx
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    Platform,
    Pressable,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import { getUserFriendlyNetworkError } from '@/utils/networkErrorHandler';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import { useMapScreenController } from '@/hooks/useMapScreenController';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton';
import { useMapPanelStore } from '@/stores/mapPanelStore';
import { useRouteStore } from '@/stores/routeStore';
import MapPanel from '@/components/MapPage/MapPanel';

const LazyMapOnboarding = lazy(() => import('@/components/MapPage/MapOnboarding'));
import { MapLoadingBar } from '@/components/MapPage/MapLoadingBar';
import MapPanelHeader from '@/components/MapPage/MapPanelHeader';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import { MAP_SEO_TITLE, MAP_SEO_DESCRIPTION } from '@/constants/mapSeo';
import { buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import { createMapStructuredData } from '@/utils/discoverySeo';

const MAP_STRUCTURED_DATA_ENTRY_LIMIT = 12;

// Preload Leaflet runtime in parallel with lazy chunk downloads.
// By the time Map.web.tsx's useLeafletLoader calls import('leaflet'),
// the module will already be in the cache → eliminates serial waterfall.
if (Platform.OS === 'web') {
    import('@/utils/loadLeafletRuntime').then((m) => m.loadLeafletRuntime()).catch(() => {})
}

const LazyTravelListPanel = lazy(() => import('@/components/MapPage/TravelListPanel'));
const LazyMapMobileLayout = lazy(() =>
    import('@/components/MapPage/MapMobileLayout').then((mod) => ({ default: mod.MapMobileLayout }))
);
const LazyMapQuickFilters = lazy(() =>
    import('@/components/MapPage/MapQuickFilters').then((mod) => ({ default: mod.MapQuickFilters }))
);
const LazyActiveFiltersBar = lazy(() =>
    import('@/components/MapPage/ActiveFiltersBar').then((mod) => ({ default: mod.ActiveFiltersBar }))
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
        isDebouncingFilters,
        isPlaceholderData,
        hasMore,
        onLoadMore,
        mapError,
        mapErrorDetails,
        refetchMapData,
        invalidateTravelsQuery,
        buildRouteTo,
        centerOnUser,
        zoomIn,
        zoomOut,
        panelRef,
        geoError,
        hasUserLocation,
        coordinates,
        transportMode,
    } = useMapScreenController();

    const [geoBannerDismissed, setGeoBannerDismissed] = useState(false);
    const [shouldLoadOnboarding, setShouldLoadOnboarding] = useState(false);
    const dismissGeoBanner = useCallback(() => setGeoBannerDismissed(true), []);
    const showGeoBanner = Boolean(geoError && !geoBannerDismissed);

    useEffect(() => {
        if (!geoError && geoBannerDismissed) setGeoBannerDismissed(false);
    }, [geoError, geoBannerDismissed]);

    useEffect(() => {
        if (shouldLoadOnboarding) return;
        if (Platform.OS !== 'web') {
            setShouldLoadOnboarding(true);
            return;
        }

        const win = typeof window !== 'undefined' ? window : undefined;
        const requestIdle = win?.requestIdleCallback;
        if (typeof requestIdle === 'function') {
            const idleId = requestIdle(() => setShouldLoadOnboarding(true), { timeout: 1000 });
            return () => win?.cancelIdleCallback?.(idleId);
        }

        const timer = setTimeout(() => setShouldLoadOnboarding(true), 600);
        return () => clearTimeout(timer);
    }, [shouldLoadOnboarding]);

    // Network status — drive offline UI + auto-retry on reconnect during error state
    const { isConnected } = useNetworkStatus();
    const wasDisconnectedRef = useRef(!isConnected);
    useEffect(() => {
        if (!mapError) {
            wasDisconnectedRef.current = !isConnected;
            return;
        }
        if (isConnected && wasDisconnectedRef.current) {
            wasDisconnectedRef.current = false;
            invalidateTravelsQuery();
            refetchMapData();
            return;
        }
        wasDisconnectedRef.current = !isConnected;
    }, [isConnected, mapError, invalidateTravelsQuery, refetchMapData]);

    // --- SEO (single block, rendered once) ---
    const mapStructuredData = useMemo(() => {
        if (Platform.OS !== 'web' || !isFocused) return null;
        return createMapStructuredData({
            canonical,
            title: MAP_SEO_TITLE,
            description: MAP_SEO_DESCRIPTION,
            entries: travelsData.slice(0, MAP_STRUCTURED_DATA_ENTRY_LIMIT).map((item: any) => ({
                name: item?.address || 'Маршрут на карте',
                url: item?.urlTravel,
                lat: item?.lat ?? String(item?.coord || '').split(',')[0],
                lng: item?.lng ?? String(item?.coord || '').split(',')[1],
                categoryName: item?.categoryName,
            })),
        });
    }, [canonical, isFocused, travelsData]);

    const mapSeoTags = useMemo(() => {
        if (Platform.OS !== 'web' || !mapStructuredData) return undefined;
        return (
            <script
                key="map-structured-data"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(mapStructuredData) }}
            />
        );
    }, [mapStructuredData]);

    const seoBlock = useMemo(() => {
        if (Platform.OS !== 'web' || !isFocused) return null;
        return (
            <InstantSEO
                headKey={mapError ? 'map-error' : 'map'}
                title={MAP_SEO_TITLE}
                description={MAP_SEO_DESCRIPTION}
                canonical={canonical}
                image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
                additionalTags={mapSeoTags}
            />
        );
    }, [isFocused, mapError, canonical, mapSeoTags]);

    // Resize handle for desktop panel (web only)
    const handleResizeMouseDown = useCallback((e: any) => {
        if (Platform.OS !== 'web' || isMobile) return;
        e.preventDefault();
        const startX = e.clientX;
        const startW = desktopPanelWidth;
        const onMove = (ev: MouseEvent) => {
            const delta = ev.clientX - startX;
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


    const openNonce = useMapPanelStore((s) => s.openNonce);
    const requestedOpenTab = useMapPanelStore((s) => s.requestedTab);

    const openRightPanelRef = useRef(openRightPanel);
    useEffect(() => {
        openRightPanelRef.current = openRightPanel;
    }, [openRightPanel]);

    useEffect(() => {
        if (!openNonce) return;
        if (requestedOpenTab === 'list') {
            selectTravelsTab();
        } else {
            selectFiltersTab();
        }
        openRightPanelRef.current();
    }, [openNonce, requestedOpenTab, selectFiltersTab, selectTravelsTab]);


    const mapPanelPlaceholder = useMemo(
        () => <MapPageSkeleton inline />,
        [],
    );

    const quickFilterSelected: string[] = useMemo(
        () => filtersPanelProps?.contextValue?.filterValue?.categoryTravelAddress ?? [],
        [filtersPanelProps?.contextValue?.filterValue?.categoryTravelAddress],
    );
    const quickRadiusOptions = useMemo(
        () => filtersPanelProps?.contextValue?.filters?.radius ?? [],
        [filtersPanelProps?.contextValue?.filters?.radius],
    );
    const quickCategoryOptions = useMemo(
        () => filtersPanelProps?.contextValue?.filters?.categoryTravelAddress ?? [],
        [filtersPanelProps?.contextValue?.filters?.categoryTravelAddress],
    );
    const quickOverlayOptions = useMemo(
        () => filtersPanelProps?.contextValue?.overlayOptions ?? [],
        [filtersPanelProps?.contextValue?.overlayOptions],
    );
    const quickEnabledOverlays = useMemo(
        () => filtersPanelProps?.contextValue?.enabledOverlays ?? {},
        [filtersPanelProps?.contextValue?.enabledOverlays],
    );
    const currentRadius = filtersPanelProps?.contextValue?.filterValue?.radius ?? '';
    const quickCategoriesValue = useMemo(() => {
        if (quickFilterSelected.length === 0) return 'Все';
        if (quickFilterSelected.length === 1) return quickFilterSelected[0];
        return `${quickFilterSelected.length} выбрано`;
    }, [quickFilterSelected]);
    const quickRadiusValue = useMemo(() => {
        if (!currentRadius) return 'Выбор';
        return `${currentRadius} км`;
    }, [currentRadius]);

    const quickOverlaysValue = useMemo(() => {
        const enabledCount = quickOverlayOptions.filter((option: { id: string }) => Boolean(quickEnabledOverlays?.[option.id])).length;
        if (enabledCount === 0) return 'Выкл';
        if (enabledCount === 1) return '1 вкл';
        return `${enabledCount} вкл`;
    }, [quickEnabledOverlays, quickOverlayOptions]);

    const mapQuickActionButtons = useMemo(
        () => [
            ...(hasUserLocation
                ? [{
                    key: 'locate',
                    label: 'ÐœÐ¾Ðµ Ð¼ÐµÑÑ‚Ð¾Ð¿Ð¾Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ',
                    icon: 'crosshair' as const,
                    onPress: centerOnUser,
                    testID: 'map-center-user-inline',
                }]
                : []),
            {
                key: 'zoom-in',
                label: 'ÐŸÑ€Ð¸Ð±Ð»Ð¸Ð·Ð¸Ñ‚ÑŒ',
                icon: 'plus' as const,
                onPress: zoomIn,
                testID: 'map-zoom-in-inline',
            },
            {
                key: 'zoom-out',
                label: 'ÐžÑ‚Ð´Ð°Ð»Ð¸Ñ‚ÑŒ',
                icon: 'minus' as const,
                onPress: zoomOut,
                testID: 'map-zoom-out-inline',
            },
        ],
        [centerOnUser, hasUserLocation, zoomIn, zoomOut],
    );
    const localizedMapQuickActionButtons = useMemo(
        () => mapQuickActionButtons.map((action) => ({
            ...action,
            label:
                action.key === 'locate'
                    ? '\u041c\u043e\u0435 \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435'
                    : action.key === 'zoom-in'
                        ? '\u041f\u0440\u0438\u0431\u043b\u0438\u0437\u0438\u0442\u044c'
                        : action.key === 'zoom-out'
                            ? '\u041e\u0442\u0434\u0430\u043b\u0438\u0442\u044c'
                            : action.label,
        })),
        [mapQuickActionButtons],
    );

    const currentTransport = transportMode ?? 'car';
    const currentMode = filtersPanelProps?.contextValue?.mode;
    const activeFilterItems = useMemo(() => {
        const items: { key: string; label: string }[] = [];
        quickFilterSelected.forEach((cat: string) => items.push({ key: `cat:${cat}`, label: cat }));
        const radiusValue = currentRadius || String(DEFAULT_RADIUS_KM);
        items.push({ key: 'radius', label: `${radiusValue} км` });
        if (currentMode === 'route' && currentTransport !== 'car') {
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
            const current: string[] = filtersPanelProps?.contextValue?.filterValue?.categoryTravelAddress ?? [];
            onChange('categoryTravelAddress', current.filter((c: string) => c !== catName));
        } else if (key === 'radius') {
            onChange('radius', String(DEFAULT_RADIUS_KM));
        } else if (key === 'transport') {
            const setTransport = filtersPanelProps?.contextValue?.setTransportMode;
            if (typeof setTransport === 'function') setTransport('car');
        }
    }, [filtersPanelProps?.contextValue?.onFilterChange, filtersPanelProps?.contextValue?.filterValue?.categoryTravelAddress, filtersPanelProps?.contextValue?.setTransportMode]);

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

    const resetFiltersForPanel = useMemo(() => {
        const reset = filtersPanelProps?.contextValue?.resetFilters;
        return typeof reset === 'function' ? reset : undefined;
    }, [filtersPanelProps?.contextValue?.resetFilters]);
    const setPanelMode = filtersPanelProps?.contextValue?.setMode;

    const handleSelectSearchTab = useCallback(() => {
        useRouteStore.getState().clearRouteAndSetMode('radius');
        selectFiltersTab();
    }, [selectFiltersTab]);

    const handleSelectRouteTab = useCallback(() => {
        setPanelMode?.('route');
        selectFiltersTab();
    }, [setPanelMode, selectFiltersTab]);

    const activePanelTab = useMemo<'search' | 'route' | 'travels'>(() => {
        if (rightPanelTab === 'travels') return 'travels';
        return filtersPanelProps?.contextValue?.mode === 'route' ? 'route' : 'search';
    }, [filtersPanelProps?.contextValue?.mode, rightPanelTab]);
    const shouldShowFloatingRadiusPill = Boolean(
        currentRadius && Platform.OS !== 'web',
    );

    const mapComponent = useMemo(
        () => (
            <View style={styles.mapArea}>
                <MapLoadingBar visible={isFetching || isDebouncingFilters} />
                {Platform.OS === 'web' && !isMobile && (
                    <Suspense fallback={null}>
                        <LazyMapQuickFilters
                            extraActions={localizedMapQuickActionButtons}
                            extraActionsPosition="inside-radius"
                            radiusValue={quickRadiusValue}
                            categoriesValue={quickCategoriesValue}
                            overlaysValue={quickOverlaysValue}
                            radiusOptions={quickRadiusOptions}
                            radiusSelected={currentRadius}
                            onChangeRadius={(next) => filtersPanelProps?.contextValue?.onFilterChange?.('radius', next)}
                            categoriesOptions={quickCategoryOptions}
                            categoriesSelected={quickFilterSelected}
                            onChangeCategories={(next) => filtersPanelProps?.contextValue?.onFilterChange?.('categoryTravelAddress', next)}
                            overlayOptions={quickOverlayOptions}
                            enabledOverlays={quickEnabledOverlays}
                            onChangeOverlay={(id, enabled) => filtersPanelProps?.contextValue?.onOverlayToggle?.(id, enabled)}
                            onResetOverlays={filtersPanelProps?.contextValue?.onResetOverlays}
                            travelsData={travelsData}
                        />
                    </Suspense>
                )}
                {mapReady ? (
                    <MapPanel {...mapPanelProps} hideFloatingControls={isMobile} />
                ) : (
                    mapPanelPlaceholder
                )}
                {shouldShowFloatingRadiusPill ? (
                    <View
                        style={[styles.radiusPill, { pointerEvents: 'none' } as any]}
                        accessibilityRole="text"
                        accessibilityLabel={`Видимый радиус ${currentRadius} километров`}
                        testID="map-radius-pill"
                    >
                        <Feather name="radio" size={12} color={themedColors.primary} />
                        <Text style={styles.radiusPillText}>{currentRadius} км</Text>
                    </View>
                ) : null}
                {showGeoBanner && (
                    <View style={styles.geoBanner} testID="map-geo-banner">
                        <Feather name="map-pin" size={13} color={themedColors.warning} />
                        <Text style={styles.geoBannerText}>
                            Геолокация недоступна
                        </Text>
                        <Pressable
                            onPress={dismissGeoBanner}
                            accessibilityRole="button"
                            accessibilityLabel="Закрыть уведомление"
                            hitSlop={10}
                            style={({ pressed }) => [styles.geoBannerClose, pressed && { opacity: 0.6 }]}
                        >
                            <Feather name="x" size={12} color={themedColors.textMuted} />
                        </Pressable>
                    </View>
                )}
            </View>
        ),
        [
            isFetching,
            isDebouncingFilters,
            isMobile,
            mapPanelPlaceholder,
            mapPanelProps,
            mapReady,
            travelsData,
            quickCategoriesValue,
            quickOverlaysValue,
            quickRadiusValue,
            quickRadiusOptions,
            quickCategoryOptions,
            quickOverlayOptions,
            quickEnabledOverlays,
            localizedMapQuickActionButtons,
            currentRadius,
            shouldShowFloatingRadiusPill,
            quickFilterSelected,
            filtersPanelProps?.contextValue,
            styles.mapArea,
            showGeoBanner,
            dismissGeoBanner,
            themedColors.warning,
            themedColors.textMuted,
            styles.geoBanner,
            styles.geoBannerText,
            styles.geoBannerClose,
            styles.radiusPill,
            styles.radiusPillText,
            themedColors.primary,
        ]
    );

    if (isMobile) {
        return (
            <View style={styles.container}>
                {seoBlock}
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
                            handleSelectSearchTab();
                            requestOpenBottomSheet('filters');
                        }}
                        filtersPanelProps={filtersPanelProps}
                        onResetFilters={handleClearAllFilters}
                        onExpandRadius={handleExpandRadius}
                        quickActionButtons={localizedMapQuickActionButtons}
                    />
                </Suspense>
            </View>
        );
    }

    // Error state
    if (mapError) {
        const friendly = getUserFriendlyNetworkError(mapErrorDetails || mapError);
        const friendlyMessage = (friendly as any)?.message ?? String(friendly || '');
        const offlineMessage = 'Нет подключения к интернету. Карта загрузится автоматически, как только соединение восстановится.';
        const effectiveMessage = !isConnected
            ? offlineMessage
            : friendlyMessage || 'Проверьте соединение и попробуйте ещё раз';
        return (
            <View style={styles.container}>
                {seoBlock}
                <ErrorDisplay
                    title={!isConnected ? 'Нет подключения' : 'Не удалось загрузить карту'}
                    message={effectiveMessage}
                    isNetworkError={!isConnected}
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
            {seoBlock}

            <View style={styles.mapContainer}>
                {/* Desktop collapsed strip */}
                {!isMobile && isDesktopCollapsed && Platform.OS === 'web' && (
                    <View
                        testID="map-panel-collapsed"
                        style={styles.collapsedPanel}
                    >
                        <Pressable
                            testID="map-panel-expand-button"
                            hitSlop={8}
                            style={({ pressed }) => [styles.collapseToggle, pressed && { opacity: 0.7 }]}
                            onPress={toggleDesktopCollapse}
                            accessibilityRole="button"
                            accessibilityLabel="Развернуть панель"
                        >
                            <Feather name="chevron-right" size={18} color={themedColors.text} />
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [styles.collapsedIconBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => { toggleDesktopCollapse(); handleSelectSearchTab(); }}
                            accessibilityRole="button"
                            accessibilityLabel="Поиск"
                        >
                            <Feather name="search" size={18} color={themedColors.textMuted} />
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [styles.collapsedIconBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => { toggleDesktopCollapse(); handleSelectRouteTab(); }}
                            accessibilityRole="button"
                            accessibilityLabel="Построение маршрута"
                        >
                            <Feather name="navigation" size={18} color={themedColors.textMuted} />
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [styles.collapsedIconBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => { toggleDesktopCollapse(); selectTravelsTab(); }}
                            accessibilityRole="button"
                            accessibilityLabel={`Список точек (${travelsData.length})`}
                        >
                            <Feather name="list" size={18} color={themedColors.textMuted} />
                            {travelsData.length > 0 && (
                                <View style={styles.collapsedBadge}>
                                    <Text style={styles.collapsedBadgeText}>
                                        {travelsData.length > 999 ? '999+' : travelsData.length}
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
                        hitSlop={8}
                        style={({ pressed }) => [styles.collapseToggleInPanel, pressed && { opacity: 0.7 }]}
                        onPress={toggleDesktopCollapse}
                        accessibilityRole="button"
                        accessibilityLabel="Свернуть панель"
                    >
                        <Feather name="chevron-left" size={16} color={themedColors.textMuted} />
                    </Pressable>
                )}
                <MapPanelHeader
                    isMobile={isMobile}
                    activeTab={activePanelTab}
                    travelsCount={travelsData.length}
                    themedColors={themedColors}
                    styles={styles}
                    selectSearchTab={handleSelectSearchTab}
                    selectRouteTab={handleSelectRouteTab}
                    selectTravelsTab={selectTravelsTab}
                    closeRightPanel={closeRightPanel}
                    resetFilters={resetFiltersForPanel}
                />
                {!isMobile && activePanelTab === 'search' && activeFilterItems.length > 0 && (
                    <Suspense fallback={null}>
                        <LazyActiveFiltersBar
                            filters={activeFilterItems}
                            onRemoveFilter={handleRemoveActiveFilter}
                            onClearAll={handleClearAllFilters}
                        />
                    </Suspense>
                )}
                <View style={styles.panelContent}>
                    {rightPanelTab === 'filters' ? (
                        filtersPanelProps?.Component ? (
                            <Suspense fallback={
                                <View style={styles.panelPlaceholder}>
                                    <Text style={styles.panelPlaceholderText}>Загрузка фильтров…</Text>
                                </View>
                            }>
                                <filtersPanelProps.Component {...filtersPanelProps.contextValue}>
                                    <filtersPanelProps.Panel hideTopControls={true} hideFooterReset={!isMobile} />
                                </filtersPanelProps.Component>
                            </Suspense>
                        ) : (
                            <View style={styles.panelPlaceholder}>
                                <Text style={styles.panelPlaceholderText}>Загрузка фильтров…</Text>
                            </View>
                        )
                    ) : (
                        <View
                            testID="map-travels-tab"
                            {...(Platform.OS === 'web' ? ({ 'data-testid': 'map-travels-tab' } as any) : null)}
                            style={{ flex: 1 }}
                        >
                            <Suspense fallback={<ActivityIndicator style={{ paddingVertical: 32 }} color={themedColors.primary} />}>
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

            {!mapReady && (
                <View style={[styles.loadingOverlay, { pointerEvents: 'none' }]} testID="map-loading-overlay">
                    <ActivityIndicator color={themedColors.primary} accessibilityLabel="Загрузка карты" />
                </View>
            )}

            {/* Onboarding для новых пользователей */}
            {shouldLoadOnboarding ? (
                <Suspense fallback={null}>
                    <LazyMapOnboarding />
                </Suspense>
            ) : null}
        </View>
    );
}
