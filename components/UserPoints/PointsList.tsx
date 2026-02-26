import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getPointCategoryNames } from '@/utils/travelPointMeta';
import { STATUS_LABELS } from '@/types/userPoints';
import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
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
  const defaultPerPage = Platform.OS === 'web' ? 5000 : 200;
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showMapSettings, setShowMapSettings] = useState(false);
  const viewMode: ViewMode = 'map'; // Fixed to map view only
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

  const { handleRemoveFilterChip } = usePointsFilterChipActions({
    availableCategoryOptions,
    filters,
    setFilters,
    setSearchQuery,
    handlePresetChange,
  });

  const handleLocateMe = locateMe;

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
    showFilters,
    onToggleFilters: () => setShowFilters((prev) => !prev),
    showMapSettings,
    onToggleMapSettings: () => setShowMapSettings((v) => !v),
    onOpenActions: () => {
      blurActiveElementForModal();
      setShowActions(true);
    },
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
        onPress={selectionMode ? undefined : handleShowPointOnMap}
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
      handleShowPointOnMap, 
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
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Нет точек</Text>
      </View>
    );
  }, [styles.emptyContainer, styles.emptyText]);

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
        manualCoords={manualCoords}
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

export type PointsListStyles = Record<string, any>;


const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 0,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  bulkMapBar: {
    position: 'absolute',
    top: Platform.OS === 'web' ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.lg,
    left: DESIGN_TOKENS.spacing.lg,
    right: DESIGN_TOKENS.spacing.lg,
    zIndex: 10,
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  bulkMapBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
    flexWrap: 'wrap',
  },
  bulkMapBarText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '800' as any,
    color: colors.text,
  },
  bulkMapBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
    justifyContent: 'flex-end',
  },
  listContent: {
    paddingBottom: DESIGN_TOKENS.spacing.xl,
  },
  gridListContent: {
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingBottom: DESIGN_TOKENS.spacing.xl,
  },
  gridColumnWrapper: {
    gap: DESIGN_TOKENS.spacing.md,
    paddingBottom: DESIGN_TOKENS.spacing.md,
  },
  titleContainer: {
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    flexShrink: 1,
    gap: DESIGN_TOKENS.spacing.xs,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statPillLabel: {
    fontSize: 12,
    fontWeight: '700' as any,
    color: colors.textMuted,
  },
  statPillValue: {
    fontSize: 12,
    fontWeight: '800' as any,
    color: colors.text,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  titleRowNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  headerActionsRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  actionsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    flexShrink: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  headerActionsNarrow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: '700' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  subtitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.textMuted,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: 2,
  },
  viewButton: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.sm,
  },
  viewIconButton: {
    width: DESIGN_TOKENS.touchTarget.minHeight,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonActive: {
    backgroundColor: colors.primary,
  },
  viewButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: '600' as any,
  },
  viewButtonTextActive: {
    color: colors.textOnPrimary,
  },
  mapContainer: {
    flex: 1,
  },
  mapInner: {
    flex: 1,
  },
  locateFab: {
    position: 'absolute',
    right: DESIGN_TOKENS.spacing.lg,
    bottom: DESIGN_TOKENS.spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  locateFabDisabled: {
    opacity: 0.6,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as any) : null),
  },
  actionsOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.lg,
  },
  actionsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  actionsModal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: DESIGN_TOKENS.spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionsTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '800' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  actionsButton: {
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  manualOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.lg,
  },
  manualBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  manualModal: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualHeader: {
    padding: DESIGN_TOKENS.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  manualTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '800' as any,
    color: colors.text,
    flex: 1,
  },
  manualScroll: {
    flex: 1,
  },
  manualScrollContent: {
    padding: DESIGN_TOKENS.spacing.lg,
  },
  manualColorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  manualInput: {
    backgroundColor: colors.surface,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coordsRow: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  coordsCol: {
    flex: 1,
    minWidth: 120,
  },
  manualFooter: {
    padding: DESIGN_TOKENS.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalSpacing: {
    marginTop: DESIGN_TOKENS.spacing.sm,
  },
  manualErrorText: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    color: colors.danger,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600' as any,
  },
  searchContainer: {
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  searchInput: {
    backgroundColor: colors.surface,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  filterButton: {
    backgroundColor: colors.backgroundSecondary,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  filterButtonText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600' as any,
  },
  emptyContainer: {
    padding: DESIGN_TOKENS.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '600' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  emptySubtext: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyActionsRow: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    flexWrap: 'wrap',
  },
  emptyActionButton: {
    minWidth: 160,
  },
  secondaryButton: {
    backgroundColor: colors.backgroundSecondary,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600' as any,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.xl,
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    color: colors.danger,
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
  },
  retryButtonText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600' as any,
  },
});
