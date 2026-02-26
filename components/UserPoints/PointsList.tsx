import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { userPointsApi } from '@/api/userPoints';
import { fetchFilters } from '@/api/misc';
import { normalizeCategoryDictionary, createCategoryNameToIdsMap, resolveCategoryIdsByNames as mapNamesToIds } from '@/utils/userPointsCategories';
import { getPointCategoryNames } from '@/utils/travelPointMeta';
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation';
import SimpleMultiSelect from '@/components/forms/SimpleMultiSelect';
import Button from '@/components/ui/Button';
import ColorChip from '@/components/ui/ColorChip';
import type { PointFilters as PointFiltersType } from '@/types/userPoints';
import { PointStatus, STATUS_LABELS } from '@/types/userPoints';
import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import {
  POINTS_PRESETS,
  haversineKm,
  normalizeCategoryIdsFromPoint,
  sortPointsByPresetProximity,
} from './pointsListLogic';
import { buildActiveFilterChips, computeHasActiveFilters } from './pointsFiltersMeta';
import { usePointsPresets } from './usePointsPresets';
import { usePointsRecommendations } from './usePointsRecommendations';
import { usePointsBulkActions } from './usePointsBulkActions';
import { usePointsManualForm } from './usePointsManualForm';
import { usePointsDeletePoint } from './usePointsDeletePoint';
import { usePointsDriveInfo } from './usePointsDriveInfo';

import { PointsListHeader } from './PointsListHeader'
import { PointsListGrid } from './PointsListGrid'
import { PointsListItem } from './PointsListItem'

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
  const [filters, setFilters] = useState<PointFiltersType>({ page: 1, perPage: defaultPerPage, radiusKm: 100 });
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showMapSettings, setShowMapSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const viewMode: ViewMode = 'map'; // Fixed to map view only
  const [panelTab, setPanelTab] = useState<'filters' | 'list'>('list');
  const [showActions, setShowActions] = useState(false);
  const [activePointId, setActivePointId] = useState<number | null>(null);
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
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { width: windowWidth } = useWindowDimensions();
  const isNarrow = windowWidth < 420;
  const isMobile = Platform.OS !== 'web';
  const isWideScreenWeb = Platform.OS === 'web' && windowWidth >= 1024;

  const showPointTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const presetPrevCategoryIdsRef = useRef<string[] | null>(null);

  useEffect(() => {
    return () => {
      if (showPointTimeoutRef.current) {
        clearTimeout(showPointTimeoutRef.current);
        showPointTimeoutRef.current = null;
      }
    };
  }, []);

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

  const siteCategoryOptionsQuery = useQuery({
    queryKey: ['userPointsCategoryDictionary'],
    queryFn: async () => {
      const data = await fetchFilters();
      const raw = (data as any)?.categoryTravelAddress ?? (data as any)?.category_travel_address;
      return normalizeCategoryDictionary(raw);
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const categoryData = useMemo(() => siteCategoryOptionsQuery.data ?? [], [siteCategoryOptionsQuery.data]);

  const categoryIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoryData) {
      const id = String((c as any)?.id ?? '').trim();
      const name = String((c as any)?.name ?? id).trim();
      if (!id) continue;
      map.set(id, name || id);
    }
    return map;
  }, [categoryData]);

  const categoryNameToIds = useMemo(() => createCategoryNameToIdsMap(categoryData), [categoryData]);

  const resolveCategoryIdsByNames = useCallback(
    (names: string[]) => mapNamesToIds(names, categoryNameToIds),
    [categoryNameToIds]
  );

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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['userPointsAll'],
    queryFn: () => userPointsApi.getPoints({ page: 1, perPage: defaultPerPage }),
    staleTime: 10 * 60 * 1000,
  });

  // If backend errors (or not ready) — treat as empty list.
  const points = useMemo(() => {
    if (error) return [];
    return Array.isArray(data) ? data : [];
  }, [data, error]);

  const pointsWithDerivedCategories = useMemo(() => {
    return (points as any[]).map((p) => {
      const categoryIds = normalizeCategoryIdsFromPoint(p);
      const categoryNames = categoryIds
        .map((id) => categoryIdToName.get(id) ?? id)
        .map((v) => String(v).trim())
        .filter(Boolean);
      return { ...p, categoryIds, categoryNames };
    });
  }, [categoryIdToName, points]);

  const baseFilteredPoints = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    const selectedColors = filters.colors ?? [];
    const selectedStatuses = filters.statuses ?? [];
    const radiusKm = filters.radiusKm;

    const radiusFilterEnabled = radiusKm !== null && radiusKm !== undefined && currentLocation;
    const userLat = Number(currentLocation?.lat);
    const userLng = Number(currentLocation?.lng);
    const radius = Number(radiusKm);
    const canDoRadius =
      Boolean(radiusFilterEnabled) &&
      Number.isFinite(userLat) &&
      Number.isFinite(userLng) &&
      Number.isFinite(radius) &&
      radius > 0;

    const latDelta = canDoRadius ? radius / 111 : 0;
    const lngDelta = canDoRadius ? radius / (111 * Math.max(0.2, Math.cos((userLat * Math.PI) / 180))) : 0;
    const minLat = canDoRadius ? userLat - latDelta : 0;
    const maxLat = canDoRadius ? userLat + latDelta : 0;
    const minLng = canDoRadius ? userLng - lngDelta : 0;
    const maxLng = canDoRadius ? userLng + lngDelta : 0;

    return pointsWithDerivedCategories.filter((p: any) => {
      if (selectedColors.length > 0 && !selectedColors.includes(p.color)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(p.status)) return false;

      if (canDoRadius) {
        const pointLat = Number(p.latitude);
        const pointLng = Number(p.longitude);
        if (Number.isFinite(pointLat) && Number.isFinite(pointLng)) {
          if (pointLat < minLat || pointLat > maxLat || pointLng < minLng || pointLng > maxLng) return false;
          const distance = haversineKm(userLat, userLng, pointLat, pointLng);
          if (distance > radius) return false;
        }
      }

      if (!q) return true;
      const haystack = `${p.name ?? ''} ${p.address ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [currentLocation, filters.colors, filters.radiusKm, filters.statuses, pointsWithDerivedCategories, searchQuery]);

  const availableCategoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of baseFilteredPoints as any[]) {
      const ids = Array.isArray(p?.categoryIds) ? p.categoryIds : [];
      for (const id of ids) {
        const norm = String(id).trim();
        if (!norm) continue;
        counts.set(norm, (counts.get(norm) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id]) => ({ id, name: categoryIdToName.get(id) ?? id }));
  }, [baseFilteredPoints, categoryIdToName]);

  const availableColors = useMemo(() => {
    const colorMap = new Map<string, number>();
    for (const p of points as any[]) {
      const c = String(p?.color ?? '').trim();
      if (c) {
        colorMap.set(c, (colorMap.get(c) || 0) + 1);
      }
    }

    const observed = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([color]) => color);

    const seen = new Set<string>();
    const merged: string[] = [];
    for (const c of observed) {
      if (!c || seen.has(c)) continue;
      seen.add(c);
      merged.push(c);
    }
    for (const c of DEFAULT_POINT_COLORS) {
      if (!c || seen.has(c)) continue;
      seen.add(c);
      merged.push(c);
    }

    return merged;
  }, [points]);

  const manualColorOptions = useMemo(() => {
    const base = [...DEFAULT_POINT_COLORS, ...(availableColors ?? [])];
    const unique = Array.from(new Set(base.map((c) => String(c).trim()).filter(Boolean)));
    return unique.length ? unique : DEFAULT_POINT_COLORS.slice();
  }, [availableColors]);

  const filteredPoints = useMemo(() => {
    const selectedCategoryIds = filters.categoryIds ?? [];
    if (!selectedCategoryIds.length) return baseFilteredPoints;

    return baseFilteredPoints.filter((p: any) => {
      if (selectedCategoryIds.length > 0) {
        const ids = Array.isArray(p?.categoryIds) ? p.categoryIds : [];
        const hasAny = selectedCategoryIds.some((id) => ids.includes(id));
        if (!hasAny) return false;
      }

      return true;
    });
  }, [baseFilteredPoints, filters.categoryIds]);

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

  const visibleFilteredPoints = useMemo(() => {
    // Show only recommended points when in recommendations mode
    if (showingRecommendations && recommendedPointIds.length > 0) {
      const recommended = new Set(recommendedPointIds);
      return filteredPoints.filter((p: any) => recommended.has(Number(p.id)));
    }

    return sortPointsByPresetProximity(filteredPoints, activePreset, resolveCategoryIdsByNames);
  }, [activePreset, filteredPoints, recommendedPointIds, resolveCategoryIdsByNames, showingRecommendations]);

  const activeDriveInfo = usePointsDriveInfo({
    activePointId,
    currentLocation,
    visibleFilteredPoints: visibleFilteredPoints as Record<string, unknown>[],
  });

  useEffect(() => {
    const selected = filters.categoryIds ?? [];
    if (!selected.length) return;
    const available = new Set(availableCategoryOptions.map((c) => c.id));
    const next = selected.filter((c) => available.has(c));
    if (next.length === selected.length) return;
    setFilters((prev) => ({ ...prev, categoryIds: next, page: 1 }));
  }, [availableCategoryOptions, filters.categoryIds]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    setFilters((prev) => ({ ...prev, search: text, page: 1 }));
  }, []);

  const handleFilterChange = useCallback(
    (newFilters: PointFiltersType) => {
      setFilters({ ...newFilters, page: 1, perPage: filters.perPage ?? defaultPerPage });
    },
    [defaultPerPage, filters.perPage]
  );

  const hasActiveFilters = useMemo(
    () => computeHasActiveFilters({ activePresetId, filters, searchQuery }),
    [activePresetId, filters, searchQuery]
  );

  const activeFilterChips = useMemo(
    () =>
      buildActiveFilterChips({
        activePreset,
        categoryIdToName,
        filters,
        searchQuery,
        statusLabels: STATUS_LABELS as Record<string, string>,
      }),
    [activePreset, categoryIdToName, filters, searchQuery]
  );

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setFilters({ page: 1, perPage: filters.perPage ?? 50, radiusKm: 100 });
    setActivePresetId(null);
    presetPrevCategoryIdsRef.current = null;
    closeRecommendations();
    setActivePointId(null);
  }, [closeRecommendations, filters.perPage]);

  const handleRemoveFilterChip = useCallback((key: string) => {
    if (key === 'preset') {
      handlePresetChange(null);
      return;
    }

    if (key === 'search') {
      setSearchQuery('');
      setFilters((prev) => ({ ...prev, search: '', page: 1 }));
      return;
    }

    if (key === 'radius') {
      setFilters((prev) => ({ ...prev, radiusKm: 100, page: 1 }));
      return;
    }

    if (key.startsWith('status-')) {
      const status = key.replace('status-', '') as PointStatus;
      const next = (filters.statuses ?? []).filter((s) => s !== status);
      setFilters((prev) => ({ ...prev, statuses: next, page: 1 }));
    } else if (key.startsWith('category-')) {
      const category = key.replace('category-', '');
      const next = (filters.categoryIds ?? []).filter((c) => c !== category);
      setFilters((prev) => ({ ...prev, categoryIds: next, page: 1 }));
    } else if (key.startsWith('color-')) {
      const color = key.replace('color-', '');
      const next = (filters.colors ?? []).filter((c) => c !== color);
      setFilters((prev) => ({ ...prev, colors: next, page: 1 }));
    }
  }, [filters.categoryIds, filters.colors, filters.statuses, handlePresetChange]);

  const handleExportKml = useCallback(async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const result = await userPointsApi.exportKml();

      const fallbackName = `user-points-${new Date().toISOString().slice(0, 10)}.kml`;
      const filename = String((result as any)?.filename || '').trim() || fallbackName;
      const contentType = String((result as any)?.contentType || '').trim() || 'application/vnd.google-earth.kml+xml';

      if (Platform.OS === 'web') {
        const blob = (result as any)?.blob as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }

      const blob = (result as any)?.blob as Blob;
      const text = await blob.text();
      const cacheDir = (FileSystem as any).cacheDirectory ?? (FileSystem.Paths.cache as any).uri;
      const uri = `${cacheDir}${filename}`;
      await FileSystem.writeAsStringAsync(uri, text);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: contentType, dialogTitle: 'Экспорт точек' });
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Ошибка экспорта');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleOpenRecommendations = useCallback(
    async () => openRecommendations(filteredPoints),
    [filteredPoints, openRecommendations]
  );

  const handleShowPointOnMap = useCallback((point: any) => {
    const lat = Number((point as any)?.latitude);
    const lng = Number((point as any)?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    // Important: do NOT clear activePointId with a timeout.
    // Clearing it causes PointsMap to re-run its auto-centering (user location / fitBounds)
    // which overrides the zoom-to-point behavior.
    //
    // Instead, force a re-trigger even when the user clicks the same card again.
    const id = Number((point as any)?.id);
    if (!Number.isFinite(id)) return;

    setActivePointId(null);
    if (showPointTimeoutRef.current) {
      clearTimeout(showPointTimeoutRef.current);
    }
    showPointTimeoutRef.current = setTimeout(() => {
      setActivePointId(id);
    }, 0);
  }, []);

  const handleLocateMe = locateMe;

  const renderHeader = useCallback(() => {
    return (
      <PointsListHeader
        styles={styles}
        colors={headerColors}
        isNarrow={isNarrow}
        isMobile={isMobile}
        total={points.length}
        found={visibleFilteredPoints.length}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        activeFilterChips={activeFilterChips}
        onRemoveFilterChip={handleRemoveFilterChip}
        viewMode={viewMode}
        onViewModeChange={() => {}}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        showMapSettings={showMapSettings}
        onToggleMapSettings={() => setShowMapSettings((v) => !v)}
        onOpenActions={() => {
          blurActiveElementForModal();
          setShowActions(true);
        }}
        onOpenRecommendations={handleOpenRecommendations}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        filters={filters}
        onFilterChange={handleFilterChange}
        presets={POINTS_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
        activePresetId={activePresetId}
        onPresetChange={handlePresetChange}
        siteCategoryOptions={availableCategoryOptions}
        availableColors={availableColors}
      />
    );
  }, [
    activeFilterChips,
    activePresetId,
    availableColors,
    availableCategoryOptions,
    blurActiveElementForModal,
    headerColors,
    filters,
    handleOpenRecommendations,
    handleFilterChange,
    handlePresetChange,
    handleRemoveFilterChip,
    handleResetFilters,
    handleSearch,
    hasActiveFilters,
    isMobile,
    isNarrow,
    points.length,
    visibleFilteredPoints.length,
    searchQuery,
    showFilters,
    showMapSettings,
    styles,
    viewMode,
  ]);

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
	        <View
	          style={[
	            styles.bulkMapBar,
	            isWideScreenWeb ? { right: 420 + DESIGN_TOKENS.spacing.lg } : null,
	          ]}
	        >
	          <View style={styles.bulkMapBarRow}>
	            <Text style={styles.bulkMapBarText}>
	              {bulkProgress
	                ? `Удаляем: ${bulkProgress.current}/${bulkProgress.total}`
                : selectedIds.length > 0
                  ? `Выбрано: ${selectedIds.length}`
                  : 'Выберите точки в списке'}
            </Text>
	            <View style={styles.bulkMapBarActions}>
	              <Button
	                label="Список"
	                onPress={() => setPanelTab('list')}
	                disabled={isBulkWorking}
	                size="sm"
	                variant="secondary"
	                accessibilityLabel="Назад к списку"
	              />

              {selectedIds.length > 0 ? (
                <>
                  <Button
                    label="Снять"
                    onPress={clearSelection}
                    disabled={isBulkWorking}
                    size="sm"
                    variant="secondary"
                    accessibilityLabel="Снять"
                  />
                  <Button
                    label="Изменить"
                    onPress={() => {
                      blurActiveElementForModal();
                      setShowBulkEdit(true);
                    }}
                    disabled={isBulkWorking}
                    size="sm"
                    accessibilityLabel="Изменить"
                  />
                  <Button
                    label="Удалить"
                    onPress={() => {
                      blurActiveElementForModal();
                      setShowConfirmDeleteSelected(true);
                    }}
                    disabled={isBulkWorking}
                    size="sm"
                    variant="danger"
                    accessibilityLabel="Удалить выбранные"
                  />
                </>
              ) : null}

              <Button
                label="Готово"
                onPress={exitSelectionMode}
                disabled={isBulkWorking}
                size="sm"
                variant="secondary"
                accessibilityLabel="Готово"
              />
            </View>
          </View>
        </View>
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

      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActions(false)}
      >
        <View style={styles.actionsOverlay}>
          <Pressable
            style={styles.actionsBackdrop}
            onPress={() => setShowActions(false)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть меню"
          />

          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>Действия</Text>

            {exportError ? <Text style={styles.manualErrorText}>{exportError}</Text> : null}

            <Button
              label="Импорт"
              onPress={() => {
                setShowActions(false);
                onImportPress?.();
              }}
              accessibilityLabel="Импорт"
              fullWidth
              style={styles.actionsButton}
            />

            <Button
              label={isExporting ? 'Экспорт…' : 'Экспорт'}
              onPress={handleExportKml}
              accessibilityLabel="Экспорт"
              fullWidth
              loading={isExporting}
              style={styles.actionsButton}
            />

            <Button
              label="Добавить вручную"
              onPress={openManualAdd}
              accessibilityLabel="Добавить вручную"
              fullWidth
              style={styles.actionsButton}
            />

	            <Button
	              label="Выбрать точки"
	              onPress={() => {
	                setShowActions(false);
	                startSelectionMode();
	                setPanelTab('list');
	              }}
	              accessibilityLabel="Выбрать точки"
	              fullWidth
	              style={styles.actionsButton}
	            />

            <Button
              label="Удалить все точки"
              onPress={() => {
                setShowActions(false);
                blurActiveElementForModal();
                setShowConfirmDeleteAll(true);
              }}
              accessibilityLabel="Удалить все точки"
              fullWidth
              variant="danger"
              style={styles.actionsButton}
            />

            <Button
              label="Отмена"
              onPress={() => setShowActions(false)}
              accessibilityLabel="Отмена"
              fullWidth
              variant="ghost"
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(pointToDelete)}
        transparent
        animationType="fade"
        onRequestClose={() => setPointToDelete(null)}
      >
        <View style={styles.actionsOverlay}>
          <Pressable
            style={styles.actionsBackdrop}
            onPress={() => setPointToDelete(null)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />

          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>Удалить точку?</Text>
            <Text style={styles.emptySubtext}>{String(pointToDelete?.name ?? '')}</Text>

            <Button
              label="Удалить"
              onPress={confirmDeletePoint}
              disabled={isBulkWorking}
              loading={isBulkWorking}
              accessibilityLabel="Удалить"
              fullWidth
              variant="danger"
            />

            <Button
              label="Отмена"
              onPress={() => setPointToDelete(null)}
              accessibilityLabel="Отмена"
              fullWidth
              variant="ghost"
              style={styles.modalSpacing}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBulkEdit}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBulkEdit(false)}
      >
        <View style={styles.actionsOverlay}>
          <Pressable
            style={styles.actionsBackdrop}
            onPress={() => setShowBulkEdit(false)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />

          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>Изменить выбранные</Text>

            <FormFieldWithValidation label="Статус">
              <SimpleMultiSelect
                data={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                value={bulkStatus ? [bulkStatus] : []}
                onChange={(vals) => {
                  const v = (vals[vals.length - 1] as PointStatus | undefined) ?? undefined;
                  setBulkStatus(v ?? null);
                }}
                labelField="label"
                valueField="value"
                search={false}
              />
            </FormFieldWithValidation>

            <Button
              label="Применить"
              onPress={applyBulkEdit}
              disabled={isBulkWorking || selectedIds.length === 0}
              loading={isBulkWorking}
              accessibilityLabel="Применить"
              fullWidth
            />

            <Button
              label="Отмена"
              onPress={() => setShowBulkEdit(false)}
              accessibilityLabel="Отмена"
              fullWidth
              variant="ghost"
              style={styles.modalSpacing}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showConfirmDeleteSelected}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmDeleteSelected(false)}
      >
        <View style={styles.actionsOverlay}>
          <Pressable
            style={styles.actionsBackdrop}
            onPress={() => setShowConfirmDeleteSelected(false)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />
          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>Удалить выбранные?</Text>
            <Text style={styles.emptySubtext}>Будут удалены: {selectedIds.length}</Text>

            <Button
              label="Удалить"
              onPress={deleteSelected}
              disabled={isBulkWorking}
              loading={isBulkWorking}
              accessibilityLabel="Удалить"
              fullWidth
              variant="danger"
            />

            <Button
              label="Отмена"
              onPress={() => setShowConfirmDeleteSelected(false)}
              accessibilityLabel="Отмена"
              fullWidth
              variant="ghost"
              style={styles.modalSpacing}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showConfirmDeleteAll}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmDeleteAll(false)}
      >
        <View style={styles.actionsOverlay}>
          <Pressable
            style={styles.actionsBackdrop}
            onPress={() => setShowConfirmDeleteAll(false)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />
          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>Удалить все точки?</Text>
            <Text style={styles.emptySubtext}>Это действие нельзя отменить</Text>

            <Button
              label="Удалить все"
              onPress={deleteAll}
              disabled={isBulkWorking}
              loading={isBulkWorking}
              accessibilityLabel="Удалить все"
              fullWidth
              variant="danger"
            />

            <Button
              label="Отмена"
              onPress={() => setShowConfirmDeleteAll(false)}
              accessibilityLabel="Отмена"
              fullWidth
              variant="ghost"
              style={styles.modalSpacing}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showManualAdd}
        transparent
        animationType="fade"
        onRequestClose={closeManualAdd}
      >
        <View style={styles.manualOverlay}>
          <Pressable
            style={styles.manualBackdrop}
            onPress={closeManualAdd}
            accessibilityRole="button"
            accessibilityLabel="Закрыть форму"
          />
          <View style={styles.manualModal}>
            <View style={styles.manualHeader}>
              <Text style={styles.manualTitle}>{editingPointId ? 'Редактировать точку' : 'Добавить точку вручную'}</Text>
              <Button
                label="Закрыть"
                onPress={closeManualAdd}
                accessibilityLabel="Закрыть"
                size="sm"
                variant="secondary"
              />
            </View>

            <ScrollView style={styles.manualScroll} contentContainerStyle={styles.manualScrollContent}>
              <FormFieldWithValidation label="Название" required error={manualError && !manualName.trim() ? manualError : null}>
                <TextInput
                  style={styles.manualInput}
                  value={manualName}
                  onChangeText={(v) => {
                    setManualNameTouched(true);
                    setManualName(v);
                  }}
                  placeholder="Например: Любимое кафе"
                  placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                />
              </FormFieldWithValidation>

              <View style={styles.coordsRow}>
                <View style={styles.coordsCol}>
                  <FormFieldWithValidation label="Lat" required error={manualError && !manualCoords ? manualError : null}>
                    <TextInput
                      style={styles.manualInput}
                      value={manualLat}
                      onChangeText={(v) => {
                        setManualLat(v);
                        syncCoordsFromInputs(v, manualLng);
                      }}
                      placeholder="55.755800"
                      placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                      keyboardType={Platform.OS === 'ios' || Platform.OS === 'android' ? 'numeric' : (undefined as any)}
                    />
                  </FormFieldWithValidation>
                </View>
                <View style={styles.coordsCol}>
                  <FormFieldWithValidation label="Lng" required error={manualError && !manualCoords ? manualError : null}>
                    <TextInput
                      style={styles.manualInput}
                      value={manualLng}
                      onChangeText={(v) => {
                        setManualLng(v);
                        syncCoordsFromInputs(manualLat, v);
                      }}
                      placeholder="37.617300"
                      placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                      keyboardType={Platform.OS === 'ios' || Platform.OS === 'android' ? 'numeric' : (undefined as any)}
                    />
                  </FormFieldWithValidation>
                </View>
              </View>

              <FormFieldWithValidation label="Категория" required>
                <SimpleMultiSelect
                  data={(siteCategoryOptionsQuery.data ?? []).map((cat) => ({
                    value: cat.id,
                    label: cat.name,
                  }))}
                  value={manualCategoryIds}
                  onChange={(vals) => setManualCategoryIds(vals.filter((v): v is string => typeof v === 'string'))}
                  labelField="label"
                  valueField="value"
                  search={false}
                />
              </FormFieldWithValidation>

              <FormFieldWithValidation label="Цвет">
                <View style={styles.manualColorRow}>
                  {manualColorOptions.map((color) => {
                    const isSelected = manualColor === color;
                    return (
                      <ColorChip
                        key={color}
                        color={color}
                        selected={isSelected}
                        onPress={() => setManualColor(color)}
                        accessibilityLabel={`Цвет ${color}`}
                        chipSize={32}
                        dotSize={20}
                        dotBorderWidth={1}
                      />
                    );
                  })}
                </View>
              </FormFieldWithValidation>

              {manualError && manualName.trim() && manualCoords ? (
                <Text style={styles.manualErrorText}>{manualError}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.manualFooter}>
              <Button
                label={isSavingManual ? 'Сохранение…' : 'Сохранить'}
                onPress={handleSaveManual}
                disabled={isSavingManual}
                loading={isSavingManual}
                accessibilityLabel="Сохранить точку"
                fullWidth
              />
            </View>
          </View>
        </View>
      </Modal>
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
