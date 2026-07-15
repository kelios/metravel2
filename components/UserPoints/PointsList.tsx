import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  View,
  useWindowDimensions,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getPointCategoryNames } from '@/utils/travelPointMeta';
import { STATUS_LABELS } from '@/types/userPoints';
import { DESIGN_COLORS } from '@/constants/designSystem';
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
  const [showFilters, setShowFilters] = useState(false);
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

  const { width: windowWidth } = useWindowDimensions();
  const isNarrow = windowWidth < 420;
  const isMobile = Platform.OS !== 'web';
  const isWideScreenWeb = Platform.OS === 'web' && windowWidth >= 1024;

  const queryClient = useQueryClient();

  const presetPrevCategoryIdsRef = useRef<string[] | null>(null);

  const {
    filters,
    setFilters,
    searchQuery,
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
    points,
    isLoading,
    loadFailed,
    refetch,
    categoryIdToName,
    categoryData,
    resolveCategoryIdsByNames,
    availableCategoryOptions,
    availableColors,
    manualColorOptions,
    filteredPoints,
  } = usePointsDataModel({
    defaultPerPage,
    filters,
    searchQuery,
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
    filteredPoints: filteredPoints as Record<string, unknown>[],
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

  const handleOpenActions = useCallback(() => {
    blurActiveElementForModal();
    setShowActions(true);
  }, [blurActiveElementForModal]);

  const renderHeader = usePointsHeaderRenderer({
    styles,
    colors: headerColors,
    isNarrow,
    isMobile,
    total: points.length,
    found: visibleFilteredPoints.length,
    hasActiveFilters,
    onResetFilters: handleResetFilters,
    activeFilterChips,
    onRemoveFilterChip: handleRemoveFilterChip,
    viewMode,
    onViewModeChange: setViewMode,
    hideViewToggle: !isWideScreenWeb,
    showFilters,
    onToggleFilters: () => setShowFilters((prev) => !prev),
    showMapSettings,
    onToggleMapSettings: () => setShowMapSettings((v) => !v),
    showingRecommendations,
    onOpenActions: handleOpenActions,
    onOpenRecommendations: handleOpenRecommendations,
    searchQuery,
    onSearch: handleSearch,
    filters,
    onFilterChange: handleFilterChange,
    activePresetId,
    onPresetChange: handlePresetChange,
    siteCategoryOptions: availableCategoryOptions,
    availableColors,
  });

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <PointsListItem
        point={item}
        layout={listColumns > 1 ? 'grid' : 'list'}
        onPress={selectionMode ? undefined : handleOpenPointOnMap}
        onEdit={selectionMode ? undefined : openEditPoint}
        onDelete={selectionMode ? undefined : requestDeletePoint}
        selectionMode={selectionMode}
        selected={selectedIdSet.has(Number(item?.id))}
        active={Number(item?.id) === Number(activePointId)}
        compact
        driveInfo={Number(item?.id) === Number(activePointId) ? activeDriveInfo : null}
        onToggleSelect={toggleSelect}
      />
    ),
    [
      activeDriveInfo, 
      activePointId, 
      listColumns, 
      handleOpenPointOnMap,
      openEditPoint, 
      requestDeletePoint, 
      selectedIdSet, 
      selectionMode, 
      toggleSelect
    ]
  );

  const renderFooter = useCallback(() => {
    return null
  }, [])

  const renderEmpty = useCallback(() => {
    if (loadFailed) {
      return (
        <View style={styles.emptyContainer}>
          <EmptyState
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
      <View style={styles.emptyContainer}>
        <EmptyState
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
	        listExtraData={{ selectionMode, selectedIds }}
	        listKey={selectionMode ? 'selection' : 'normal'}
	        panelTab={panelTab}
	        onPanelTabChange={setPanelTab}
	        numColumns={listColumns}
	        renderHeader={renderHeader}
	        renderItem={renderItem}
	        renderEmpty={renderEmpty}
        onOpenActions={handleOpenActions}
        renderFooter={renderFooter}
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
        onSearch={handleSearch}
        hasFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        showMapSettings={showMapSettings}
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
