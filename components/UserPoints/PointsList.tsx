import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getPointCategoryNames } from '@/utils/travelPointMeta';
import { STATUS_LABELS } from '@/types/userPoints';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { useBreakpoints } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { createStyles } from './PointsList.styles';
import { normalizeCategoryIdsFromPoint } from './pointsListLogic';
import { usePointsPresets } from './usePointsPresets';
import { usePointsRecommendations } from './usePointsRecommendations';
import { usePointsBulkActions } from './usePointsBulkActions';
import { usePointsManualForm } from './usePointsManualForm';
import { usePointsDeletePoint } from './usePointsDeletePoint';
import { usePointsExportKml } from './usePointsExportKml';
import { usePointsActivePoint } from './usePointsActivePoint';
import { usePointsFiltersController } from './usePointsFiltersController';
import { usePointsFilterChipActions } from './usePointsFilterChipActions';
import { usePointsDataModel } from './usePointsDataModel';
import { usePointsViewModel } from './usePointsViewModel';
import { PointsListHeader } from './PointsListHeader';
import { PointsListEmptyState } from './PointsListEmptyState';
import { getPointsPresetLabel, POINTS_PRESETS } from './pointsListLogic';
import { getUserPointsCenter } from './userPointsMapData';

import { PointsListGrid } from './PointsListGrid'
import { PointsListItem } from './PointsListItem'
import { PointsListModals } from './PointsListModals'
import { PointsListBulkMapBar } from './PointsListBulkMapBar'


const DEFAULT_POINT_COLORS: string[] = [
  'red',
  'green',
  'purple',
  'brown',
  'blue',
  'yellow',
  'pink',
  'gray',
  ...DESIGN_COLORS.userPointPalette,
  DESIGN_COLORS.travelPoint,
];


type ViewMode = 'list' | 'map';

type PointsListProps = {
  onImportPress?: () => void;
};

export const PointsList: React.FC<PointsListProps> = ({ onImportPress }) => {
  const defaultPerPage = 200;
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [showMapSettings, setShowMapSettings] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [panelTab, setPanelTab] = useState<'filters' | 'list'>('list');
  const [showActions, setShowActions] = useState(false);
  const { activePointId, setActivePointId, handleShowPointOnMap } = usePointsActivePoint();
  const {
    currentLocation,
    isLocating,
    recommendedPointIds,
    showingRecommendations,
    recommendedRoutes,
    handleLocateMe: locateMe,
    handleOpenRecommendations: openRecommendations,
    handleCloseRecommendations: closeRecommendations,
  } = usePointsRecommendations({ setActivePointId });
  const { isExporting, exportError, handleExportKml } = usePointsExportKml();

  // #1788 — режим берётся из ВЬЮПОРТА, а не из платформы. `Platform.OS !== 'web'`
  // здесь означал «нативное приложение всегда мобильное, браузер никогда», из-за
  // чего mobile web на 390px получал десктопную раскладку, а iPhone-приложение на
  // той же ширине — мобильную; docs/RULES.md требует один responsive-UX на
  // mobile web / Android / iPhone. Ширина уже читается в этом же компоненте.
  // `clientOnly` обязателен: без него первый web-кадр приходит с width=0
  // (`hooks/useHydrationReady.ts`), и десктоп на мгновение рисуется мобильной
  // раскладкой — тот самый скачок, из-за которого правило появилось (#1282).
  // Экран монтируется уже после гидратации (`UserPointsScreen` держит спиннер,
  // пока `authReady === false`), поэтому SSR-кадра здесь нет.
  const { width: windowWidth, isMobile } = useBreakpoints({ clientOnly: true });
  // Панель настроек карты остаётся web-only: у native нет моста MapUiApi
  // (см. комментарий ниже), поэтому здесь Platform — признак ВОЗМОЖНОСТИ, а не
  // раскладки, и остаётся на месте.
  const isWideScreenWeb = Platform.OS === 'web' && windowWidth >= 1024;
  // Only desktop map mode mounts the settings panel alongside a live map.
  // Native has no MapUiApi bridge; narrow layouts unmount the map on Filters.
  const canShowMapSettings = isWideScreenWeb && viewMode === 'map';
  const mapSettingsVisible = canShowMapSettings && showMapSettings;

  const queryClient = useQueryClient();

  const presetPrevCategoryIdsRef = useRef<string[] | null>(null);

  const {
    filters,
    setFilters,
    searchQuery,
    appliedSearchQuery,
    setSearchQuery,
    handleSearch,
    handleFilterChange,
    handleResetFilters,
  } = usePointsFiltersController({
    defaultPerPage,
    setActivePresetId,
    presetPrevCategoryIdsRef,
    closeRecommendations,
    setActivePointId,
  });

  const blurActiveElementForModal = useCallback(() => {
    if (Platform.OS !== 'web') return;
    try {
      const el = (globalThis as any)?.document?.activeElement as any;
      if (el && typeof el.blur === 'function') el.blur();
    } catch {
      // noop
    }
  }, []);

  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const headerColors = useMemo(
    () => ({ text: colors.text, textMuted: colors.textMuted, textOnPrimary: colors.textOnPrimary }),
    [colors.text, colors.textMuted, colors.textOnPrimary]
  );
  const gridColors = useMemo(() => ({ text: colors.text }), [colors.text]);

  const {
    points,
    totalCount,
    isLoading,
    loadFailed,
    refetch,
    isSearching,
    categoryIdToName,
    categoryData,
    resolveCategoryIdsByNames,
    availableCategoryOptions,
    availableColors,
    manualColorOptions,
    filteredPoints,
  } = usePointsDataModel({
    filters,
    // #3132: модель и карта видят запрос после паузы в наборе; поле ввода — сразу.
    searchQuery: appliedSearchQuery,
    currentLocation,
    defaultPointColors: DEFAULT_POINT_COLORS,
  });

  const { activePreset, handlePresetChange } = usePointsPresets({
    activePresetId,
    setActivePresetId,
    filtersCategoryIds: filters.categoryIds,
    setFilters,
    presetPrevCategoryIdsRef,
    resolveCategoryIdsByNames,
  });

  const resolveCategoryIdsForEdit = useCallback(
    (point: any): string[] => {
      const rawIds = normalizeCategoryIdsFromPoint(point);
      const validIds = rawIds.filter((id) => categoryIdToName.has(String(id).trim()));
      if (validIds.length > 0) return validIds;

      const names = getPointCategoryNames(point);
      const resolved = resolveCategoryIdsByNames(names);
      return resolved;
    },
    [categoryIdToName, resolveCategoryIdsByNames]
  );

  const bulk = usePointsBulkActions({ filteredPoints, queryClient });
  const {
    selectionMode,
    selectedIds,
    selectedIdSet,
    setShowBulkEdit,
    isBulkWorking,
    setIsBulkWorking,
    bulkProgress,
    setShowConfirmDeleteSelected,
    setShowConfirmDeleteAll,
    startSelectionMode,
    toggleSelect,
    clearSelection,
    exitSelectionMode,
  } = bulk;

  const manual = usePointsManualForm({
    blurActiveElementForModal,
    setShowActions,
    resolveCategoryIdsForEdit,
    queryClient,
  });
  const { showManualAdd, manualCoords, manualColor, openManualAdd, openEditPoint, handleMapPress } = manual;
  const manualCoordsValue = useMemo(
    () => {
      if (typeof manualCoords === 'string') return manualCoords;
      if (manualCoords && typeof manualCoords === 'object') {
        const lat = 'lat' in manualCoords ? String(manualCoords.lat ?? '') : '';
        const lng = 'lng' in manualCoords ? String(manualCoords.lng ?? '') : '';
        return lat && lng ? `${lat},${lng}` : '';
      }
      return '';
    },
    [manualCoords]
  );

  const deletion = usePointsDeletePoint({ queryClient, setIsBulkWorking });
  const { requestDeletePoint } = deletion;

  const {
    visibleFilteredPoints,
    hasActiveFilters,
    activeFilterChips,
    handleOpenRecommendations,
  } = usePointsViewModel({
    filteredPoints: filteredPoints as unknown as Record<string, unknown>[],
    showingRecommendations,
    recommendedPointIds,
    activePreset,
    resolveCategoryIdsByNames,
    activePresetId,
    filters,
    searchQuery,
    categoryIdToName,
    statusLabels: STATUS_LABELS as Record<string, string>,
    openRecommendations: openRecommendations as (points: Record<string, unknown>[]) => Promise<void>,
  });

  const handleOpenPointOnMap = useCallback((point: any) => {
    setViewMode('map');
    setPanelTab('list');
    handleShowPointOnMap(point);
  }, [handleShowPointOnMap]);

  const { handleRemoveFilterChip } = usePointsFilterChipActions({
    availableCategoryOptions,
    filters,
    setFilters,
    setSearchQuery,
    handlePresetChange,
  });

  const handleLocateMe = locateMe;

  // PERM-3: радиус фильтрует только относительно геолокации, а её больше не
  // спрашивают при загрузке. Выбор другого радиуса — действие пользователя,
  // поэтому без локации запрашиваем её здесь; иначе чип молча ничего не делал бы.
  const handleFilterChangeWithLocation = useCallback(
    (next: Parameters<typeof handleFilterChange>[0]) => {
      handleFilterChange(next);
      if (!currentLocation && !isLocating && next.radiusKm != null && next.radiusKm !== filters.radiusKm) {
        void locateMe();
      }
    },
    [currentLocation, filters.radiusKm, handleFilterChange, isLocating, locateMe],
  );

  const handleOpenActions = useCallback(() => {
    blurActiveElementForModal();
    setShowActions(true);
  }, [blurActiveElementForModal]);

  // Подписи пресетов — через i18n на каждом рендере (локаль переключается без ремаунта).
  const presetOptions = POINTS_PRESETS.map((preset) => ({ id: preset.id, label: getPointsPresetLabel(preset) }));
  // #3135: шапка — элемент `PointsListHeader`, а не `useCallback` с 29 зависимостями.
  const header = (
    <PointsListHeader
      styles={styles}
      colors={headerColors}
      isMobile={isMobile}
      total={totalCount}
      found={visibleFilteredPoints.length}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      activeFilterChips={activeFilterChips}
      onRemoveFilterChip={handleRemoveFilterChip}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      hideViewToggle={!isWideScreenWeb}
      canShowMapSettings={canShowMapSettings}
      showMapSettings={mapSettingsVisible}
      onToggleMapSettings={() => setShowMapSettings((v) => !v)}
      showingRecommendations={showingRecommendations}
      onOpenActions={handleOpenActions}
      onOpenRecommendations={handleOpenRecommendations}
      showSearch={viewMode === 'list' && isWideScreenWeb}
      searchQuery={searchQuery}
      onSearch={handleSearch}
      filters={filters}
      onFilterChange={handleFilterChangeWithLocation}
      presets={presetOptions}
      activePresetId={activePresetId}
      onPresetChange={handlePresetChange}
      siteCategoryOptions={availableCategoryOptions}
      availableColors={availableColors}
    />
  );

  // #3133: renderItem стабилен — изменчивые входы (активная точка, выделение,
  // время в пути) читаются из latest-ref, а перерисовку видимых строк запускает
  // `listExtraData` у FlashList. Раньше смена активной точки меняла identity
  // renderItem → пересоздавалась шапка списка и все видимые карточки.
  const renderItemStateRef = useRef({ activePointId, currentLocation, selectedIdSet, selectionMode });
  renderItemStateRef.current = { activePointId, currentLocation, selectedIdSet, selectionMode };
  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const state = renderItemStateRef.current;
      const isActive = Number(item?.id) === Number(state.activePointId);
      return (
        <PointsListItem
          point={item}
          onPress={state.selectionMode ? undefined : handleOpenPointOnMap}
          onEdit={state.selectionMode ? undefined : openEditPoint}
          onDelete={state.selectionMode ? undefined : requestDeletePoint}
          selectionMode={state.selectionMode}
          selected={state.selectedIdSet.has(Number(item?.id))}
          active={isActive}
          compact
          driveFrom={isActive ? state.currentLocation : null}
          onToggleSelect={toggleSelect}
        />
      );
    },
    [handleOpenPointOnMap, openEditPoint, requestDeletePoint, toggleSelect]
  );

  const renderEmpty = useCallback(
    () => <PointsListEmptyState styles={styles} loadFailed={loadFailed} onRetry={() => refetch()} onAddPoint={openManualAdd} />,
    [styles, openManualAdd, loadFailed, refetch]
  );

  // Куда смотреть карте, если геокодер поиска ничего не нашёл: геолокация,
  // иначе центр коллекции (#3135; раньше — зашитый Минск).
  const geocodeFallbackCenter = useMemo(
    () => getUserPointsCenter(currentLocation ?? undefined, points),
    [currentLocation, points]
  );

	  return (
	    <View style={styles.container}>
	      {selectionMode ? (
	        <PointsListBulkMapBar
            styles={styles}
            isWideScreenWeb={isWideScreenWeb}
            bulkProgress={bulkProgress}
            selectedCount={selectedIds.length}
            isBulkWorking={isBulkWorking}
            onBackToList={() => setPanelTab('list')}
            onClearSelection={clearSelection}
            onOpenBulkEdit={() => {
              blurActiveElementForModal();
              setShowBulkEdit(true);
            }}
            onOpenDeleteSelected={() => {
              blurActiveElementForModal();
              setShowConfirmDeleteSelected(true);
            }}
            onDone={exitSelectionMode}
          />
      ) : null}

	      <PointsListGrid
	        styles={styles}
	        colors={gridColors}
	        viewMode={viewMode}
	        isLoading={isLoading}
	        filteredPoints={visibleFilteredPoints}
	        listExtraData={{ selectionMode, selectedIds, activePointId, currentLocation }}
	        activeFilterCount={activeFilterChips.length}
	        isSearching={isSearching}
	        listKey={selectionMode ? 'selection' : 'normal'}
	        panelTab={panelTab}
	        onPanelTabChange={setPanelTab}
	        header={header}
	        geocodeFallbackCenter={geocodeFallbackCenter}
	        renderItem={renderItem}
	        renderEmpty={renderEmpty}
        onOpenActions={handleOpenActions}
        onRefresh={refetch}
	        currentLocation={currentLocation}
	        onMapPress={handleMapPress}
	        onMapPointPress={selectionMode ? undefined : handleShowPointOnMap}
	        onPointEdit={openEditPoint}
	        onPointDelete={requestDeletePoint}
	        showManualAdd={showManualAdd}
        manualCoords={manualCoords}
        manualColor={manualColor}
        isLocating={isLocating}
        onLocateMe={handleLocateMe}
        showingRecommendations={showingRecommendations}
        onRefreshRecommendations={handleOpenRecommendations}
        onCloseRecommendations={closeRecommendations}
        activePointId={activePointId}
        recommendedRoutes={recommendedRoutes}
        searchQuery={searchQuery}
        appliedSearchQuery={appliedSearchQuery}
        onSearch={handleSearch}
        hasFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        showMapSettings={mapSettingsVisible}
      />

      <PointsListModals
        styles={styles}
        bulk={bulk}
        manual={manual}
        deletion={deletion}
        manualCoordsValue={manualCoordsValue}
        categoryOptions={categoryData}
        manualColorOptions={manualColorOptions}
        showActions={showActions}
        onCloseActions={() => setShowActions(false)}
        exportError={exportError}
        isExporting={isExporting}
        onExport={handleExportKml}
        onImport={() => {
          setShowActions(false);
          onImportPress?.();
        }}
        onStartSelection={() => {
          setShowActions(false);
          startSelectionMode();
          setPanelTab('list');
        }}
        onRequestDeleteAll={() => {
          setShowActions(false);
          blurActiveElementForModal();
          setShowConfirmDeleteAll(true);
        }}
      />
    </View>
  );
};

export type { PointsListStyles } from './types';
