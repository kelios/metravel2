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
import { usePointsDriveInfo } from './usePointsDriveInfo';
import { usePointsExportKml } from './usePointsExportKml';
import { usePointsActivePoint } from './usePointsActivePoint';
import { usePointsFiltersController } from './usePointsFiltersController';
import { usePointsFilterChipActions } from './usePointsFilterChipActions';
import { usePointsDataModel } from './usePointsDataModel';
import { usePointsViewModel } from './usePointsViewModel';
import { usePointsHeaderRenderer } from './usePointsHeaderRenderer';

import { PointsListGrid } from './PointsListGrid'
import { PointsListItem } from './PointsListItem'
import { PointsListActionsModal } from './PointsListActionsModal'
import { PointsListBulkModals } from './PointsListBulkModals'
import { PointsListManualModal } from './PointsListManualModal'
import { PointsListBulkMapBar } from './PointsListBulkMapBar'
import EmptyState from '@/components/ui/EmptyState'
import { translate as i18nT } from '@/i18n'
import { SCREEN_CONTENT_FIRST_PROPS } from '@/utils/screenContentMarker'


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

  const listColumns = 1;

  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const headerColors = useMemo(
    () => ({ text: colors.text, textMuted: colors.textMuted, textOnPrimary: colors.textOnPrimary }),
    [colors.text, colors.textMuted, colors.textOnPrimary]
  );
  const gridColors = useMemo(() => ({ text: colors.text }), [colors.text]);

  const {
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

  const {
    selectionMode,
    selectedIds,
    selectedIdSet,
    showBulkEdit,
    setShowBulkEdit,
    bulkStatus,
    setBulkStatus,
    isBulkWorking,
    setIsBulkWorking,
    bulkProgress,
    showConfirmDeleteSelected,
    setShowConfirmDeleteSelected,
    showConfirmDeleteAll,
    setShowConfirmDeleteAll,
    startSelectionMode,
    toggleSelect,
    clearSelection,
    exitSelectionMode,
    applyBulkEdit,
    deleteSelected,
    deleteAll,
  } = usePointsBulkActions({ filteredPoints, queryClient });

  const {
    editingPointId,
    showManualAdd,
    manualName,
    setManualName,
    setManualNameTouched,
    manualCoords,
    manualLat,
    setManualLat,
    manualLng,
    setManualLng,
    manualColor,
    setManualColor,
    manualCategoryIds,
    setManualCategoryIds,
    isSavingManual,
    manualError,
    openManualAdd,
    closeManualAdd,
    openEditPoint,
    handleMapPress,
    syncCoordsFromInputs,
    handleSaveManual,
  } = usePointsManualForm({
    blurActiveElementForModal,
    setShowActions,
    resolveCategoryIdsForEdit,
    queryClient,
  });
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

  const { pointToDelete, setPointToDelete, requestDeletePoint, confirmDeletePoint } = usePointsDeletePoint({
    queryClient,
    setIsBulkWorking,
  });

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

  const activeDriveInfo = usePointsDriveInfo({
    activePointId,
    currentLocation,
    visibleFilteredPoints: visibleFilteredPoints as Record<string, unknown>[],
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

  const renderHeader = usePointsHeaderRenderer({
    styles,
    colors: headerColors,
    isMobile,
    total: totalCount,
    found: visibleFilteredPoints.length,
    hasActiveFilters,
    onResetFilters: handleResetFilters,
    activeFilterChips,
    onRemoveFilterChip: handleRemoveFilterChip,
    viewMode,
    onViewModeChange: setViewMode,
    hideViewToggle: !isWideScreenWeb,
    canShowMapSettings,
    showMapSettings: mapSettingsVisible,
    onToggleMapSettings: () => setShowMapSettings((v) => !v),
    showingRecommendations,
    onOpenActions: handleOpenActions,
    onOpenRecommendations: handleOpenRecommendations,
    // Поле поиска в шапке только в отдельном режиме списка: в режиме карты
    // своё поле есть у шапки списка (#3134, одно поле на экран).
    showSearch: viewMode === 'list' && isWideScreenWeb,
    searchQuery,
    onSearch: handleSearch,
    filters,
    onFilterChange: handleFilterChangeWithLocation,
    activePresetId,
    onPresetChange: handlePresetChange,
    siteCategoryOptions: availableCategoryOptions,
    availableColors,
  });

  // #3133: renderItem стабилен — изменчивые входы (активная точка, выделение,
  // время в пути) читаются из latest-ref, а перерисовку видимых строк запускает
  // `listExtraData` у FlashList. Раньше смена активной точки меняла identity
  // renderItem → пересоздавалась шапка списка и все видимые карточки.
  const renderItemStateRef = useRef({ activePointId, activeDriveInfo, selectedIdSet, selectionMode });
  renderItemStateRef.current = { activePointId, activeDriveInfo, selectedIdSet, selectionMode };
  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const state = renderItemStateRef.current;
      const isActive = Number(item?.id) === Number(state.activePointId);
      return (
        <PointsListItem
          point={item}
          layout={listColumns > 1 ? 'grid' : 'list'}
          onPress={state.selectionMode ? undefined : handleOpenPointOnMap}
          onEdit={state.selectionMode ? undefined : openEditPoint}
          onDelete={state.selectionMode ? undefined : requestDeletePoint}
          selectionMode={state.selectionMode}
          selected={state.selectedIdSet.has(Number(item?.id))}
          active={isActive}
          compact
          driveInfo={isActive ? state.activeDriveInfo : null}
          onToggleSelect={toggleSelect}
        />
      );
    },
    [handleOpenPointOnMap, listColumns, openEditPoint, requestDeletePoint, toggleSelect]
  );

  const renderEmpty = useCallback(() => {
    if (loadFailed) {
      return (
        <View style={styles.emptyContainer}>
          <EmptyState
            density="compact"
            icon="wifi-off"
            variant="error"
            title={i18nT('map:components.UserPoints.PointsList.ne_udalos_zagruzit_tochki_a1d1dfdc')}
            description={i18nT('map:components.UserPoints.PointsList.proverte_podklyuchenie_k_internetu_i_poprobu_e66933f1')}
            action={{ label: i18nT('map:components.UserPoints.PointsList.povtorit_0641a83c'), onPress: () => refetch() }}
          />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer} {...SCREEN_CONTENT_FIRST_PROPS}>
        <EmptyState
          density="compact"
          icon="map-pin"
          variant="empty"
          title={i18nT('map:components.UserPoints.PointsList.u_vas_poka_net_tochek_7f6af4ba')}
          description={i18nT('map:components.UserPoints.PointsList.sohranyayte_interesnye_mesta_na_karte_ili_do_04659fd5')}
          action={{ label: i18nT('map:components.UserPoints.PointsList.dobavit_tochku_c3c1a974'), onPress: openManualAdd }}
        />
      </View>
    );
  }, [styles.emptyContainer, openManualAdd, loadFailed, refetch]);

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
	        listExtraData={{ selectionMode, selectedIds, activePointId, activeDriveInfo }}
	        activeFilterCount={activeFilterChips.length}
	        isSearching={isSearching}
	        listKey={selectionMode ? 'selection' : 'normal'}
	        panelTab={panelTab}
	        onPanelTabChange={setPanelTab}
	        numColumns={listColumns}
	        renderHeader={renderHeader}
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

      <PointsListActionsModal
        styles={styles}
        visible={showActions}
        exportError={exportError}
        isExporting={isExporting}
        onClose={() => setShowActions(false)}
        onImport={() => {
          setShowActions(false);
          onImportPress?.();
        }}
        onExport={handleExportKml}
        onOpenManualAdd={openManualAdd}
        onStartSelection={() => {
          setShowActions(false);
          startSelectionMode();
          setPanelTab('list');
        }}
        onDeleteAll={() => {
          setShowActions(false);
          blurActiveElementForModal();
          setShowConfirmDeleteAll(true);
        }}
      />

      <PointsListBulkModals
        styles={styles}
        pointToDelete={pointToDelete}
        onClosePointDelete={() => setPointToDelete(null)}
        onConfirmPointDelete={confirmDeletePoint}
        showBulkEdit={showBulkEdit}
        onCloseBulkEdit={() => setShowBulkEdit(false)}
        bulkStatus={bulkStatus}
        onBulkStatusChange={setBulkStatus}
        onApplyBulkEdit={applyBulkEdit}
        showConfirmDeleteSelected={showConfirmDeleteSelected}
        onCloseConfirmDeleteSelected={() => setShowConfirmDeleteSelected(false)}
        selectedCount={selectedIds.length}
        onDeleteSelected={deleteSelected}
        showConfirmDeleteAll={showConfirmDeleteAll}
        onCloseConfirmDeleteAll={() => setShowConfirmDeleteAll(false)}
        onDeleteAll={deleteAll}
        isBulkWorking={isBulkWorking}
      />

      <PointsListManualModal
        styles={styles}
        visible={showManualAdd}
        editingPointId={editingPointId}
        onClose={closeManualAdd}
        manualName={manualName}
        onChangeName={(v) => {
          setManualNameTouched(true);
          setManualName(v);
        }}
        manualError={manualError}
        manualCoords={manualCoordsValue}
        manualLat={manualLat}
        onChangeLat={(v) => {
          setManualLat(v);
          syncCoordsFromInputs(v, manualLng);
        }}
        manualLng={manualLng}
        onChangeLng={(v) => {
          setManualLng(v);
          syncCoordsFromInputs(manualLat, v);
        }}
        categoryOptions={categoryData}
        manualCategoryIds={manualCategoryIds}
        onChangeCategoryIds={setManualCategoryIds}
        manualColorOptions={manualColorOptions}
        manualColor={manualColor}
        onChangeColor={setManualColor}
        isSavingManual={isSavingManual}
        onSave={handleSaveManual}
      />
    </View>
  );
};

export type { PointsListStyles } from './types';
