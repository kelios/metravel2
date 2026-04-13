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
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton';
import { useMapPanelStore } from '@/stores/mapPanelStore';
import MapPanel from '@/components/MapPage/MapPanel';

const LazyMapOnboarding = lazy(() => import('@/components/MapPage/MapOnboarding'));
import { MapLoadingBar } from '@/components/MapPage/MapLoadingBar';
import { MapQuickFilters } from '@/components/MapPage/MapQuickFilters';
import { ActiveFiltersBar } from '@/components/MapPage/ActiveFiltersBar';
import { MapShowListButton } from '@/components/MapPage/MapShowListButton';
import MapPanelHeader from '@/components/MapPage/MapPanelHeader';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import { MAP_SEO_TITLE, MAP_SEO_DESCRIPTION } from '@/constants/mapSeo';
import { buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import { createMapStructuredData } from '@/utils/discoverySeo';

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

    // --- SEO (single block, rendered once) ---
    const mapStructuredData = useMemo(
        () =>
            createMapStructuredData({
                canonical,
                title: MAP_SEO_TITLE,
                description: MAP_SEO_DESCRIPTION,
                entries: travelsData.map((item: any) => ({
                    name: item?.address || 'Маршрут на карте',
                    url: item?.urlTravel,
                    lat: item?.lat ?? String(item?.coord || '').split(',')[0],
                    lng: item?.lng ?? String(item?.coord || '').split(',')[1],
                    categoryName: item?.categoryName,
                })),
            }),
        [canonical, travelsData]
    );

    const mapSeoTags = useMemo(() => {
        if (Platform.OS !== 'web') return undefined;
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

    // Quick filter chips + active filters bar
    const quickFilterCategories = useMemo(() => {
        const cats = filtersPanelProps?.contextValue?.filters?.categories ?? [];
        if (!cats.length || !travelsData.length) return cats;
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

    const currentTransport = transportMode ?? 'car';
    const activeFilterItems = useMemo(() => {
        const items: { key: string; label: string }[] = [];
        quickFilterSelected.forEach((cat: string) => items.push({ key: `cat:${cat}`, label: cat }));
        if (currentRadius && currentRadius !== String(DEFAULT_RADIUS_KM)) {
            items.push({ key: 'radius', label: `${currentRadius} км` });
        }
        if (currentTransport !== 'car') {
            const transportLabels: Record<string, string> = { bike: 'Велосипед', foot: 'Пешком' };
            items.push({ key: 'transport', label: transportLabels[currentTransport] ?? currentTransport });
        }
        return items;
    }, [quickFilterSelected, currentRadius, currentTransport]);

    const handleRemoveActiveFilter = useCallback((key: string) => {
        const onChange = filtersPanelProps?.contextValue?.onFilterChange;
        if (!onChange) return;
        if (key.startsWith('cat:')) {
            const catName = key.slice(4);
            const current: string[] = filtersPanelProps?.contextValue?.filterValue?.categories ?? [];
            onChange('categories', current.filter((c: string) => c !== catName));
        } else if (key === 'radius') {
            onChange('radius', String(DEFAULT_RADIUS_KM));
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

    const handleOpenFiltersPanel = useCallback(() => {
        selectFiltersTab();
        if (isDesktopCollapsed && !isMobile) {
            toggleDesktopCollapse();
        }
        if (isMobile) {
            requestOpenBottomSheet('filters');
            return;
        }
        openRightPanel();
    }, [
        isDesktopCollapsed,
        isMobile,
        openRightPanel,
        requestOpenBottomSheet,
        selectFiltersTab,
        toggleDesktopCollapse,
    ]);

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

    const handleShowList = useCallback(() => {
        selectTravelsTab();
        if (isDesktopCollapsed) toggleDesktopCollapse();
    }, [selectTravelsTab, isDesktopCollapsed, toggleDesktopCollapse]);

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
                        onOpenFilters={handleOpenFiltersPanel}
                    />
                )}
                {Platform.OS === 'web' && !isMobile && travelsData.length > 0 && rightPanelTab !== 'travels' && (
                    <MapShowListButton
                        count={travelsData.length}
                        onPress={handleShowList}
                    />
                )}
                {mapReady ? (
                    <MapPanel {...mapPanelProps} />
                ) : (
                    mapPanelPlaceholder
                )}
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
            isMobile,
            mapPanelPlaceholder,
            mapPanelProps,
            mapReady,
            quickFilterCategories,
            quickFilterSelected,
            quickFilterToggle,
            rightPanelTab,
            handleShowList,
            travelsData.length,
            handleOpenFiltersPanel,
            styles.mapArea,
            showGeoBanner,
            dismissGeoBanner,
            themedColors.warning,
            themedColors.textMuted,
            styles.geoBanner,
            styles.geoBannerText,
            styles.geoBannerClose,
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
                            selectFiltersTab();
                            requestOpenBottomSheet('filters');
                        }}
                        filtersPanelProps={filtersPanelProps}
                        onResetFilters={handleClearAllFilters}
                        onExpandRadius={handleExpandRadius}
                    />
                </Suspense>
            </View>
        );
    }

    // Error state
    if (mapError) {
        const friendly = getUserFriendlyNetworkError(mapErrorDetails || mapError);
        const friendlyMessage = (friendly as any)?.message ?? String(friendly || '');
        return (
            <View style={styles.container}>
                {seoBlock}
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
                            style={({ pressed }) => [styles.collapseToggle, pressed && { opacity: 0.7 }]}
                            onPress={toggleDesktopCollapse}
                            accessibilityRole="button"
                            accessibilityLabel="Развернуть панель"
                        >
                            <Feather name="chevron-right" size={18} color={themedColors.text} />
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
                    rightPanelTab={rightPanelTab}
                    travelsCount={travelsData.length}
                    themedColors={themedColors}
                    styles={styles}
                    selectFiltersTab={selectFiltersTab}
                    selectTravelsTab={selectTravelsTab}
                    closeRightPanel={closeRightPanel}
                    resetFilters={resetFiltersForPanel}
                />
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
                            <Suspense fallback={
                                <View style={styles.panelPlaceholder}>
                                    <Text style={styles.panelPlaceholderText}>Загрузка фильтров…</Text>
                                </View>
                            }>
                                <filtersPanelProps.Component {...filtersPanelProps.contextValue}>
                                    <filtersPanelProps.Panel hideFooterReset={!isMobile} />
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
            <Suspense fallback={null}>
                <LazyMapOnboarding />
            </Suspense>
        </View>
    );
}
