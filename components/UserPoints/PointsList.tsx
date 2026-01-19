import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { userPointsApi } from '@/src/api/userPoints';
import { PointCard } from '@/components/UserPoints/PointCard';
import FormFieldWithValidation from '@/components/FormFieldWithValidation';
import SimpleMultiSelect from '@/components/SimpleMultiSelect';
import { buildAddressFromGeocode } from '@/components/travel/WebMapComponent';
import type { PointFilters as PointFiltersType } from '@/types/userPoints';
import { COLOR_CATEGORIES, PointCategory, PointColor, PointStatus, STATUS_LABELS } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

import { PointsListHeader } from './PointsListHeader'
import { PointsListGrid } from './PointsListGrid'
import { PointsListItem } from './PointsListItem'

type ViewMode = 'list' | 'map';

type PointsListProps = {
  onImportPress?: () => void;
};

export const PointsList: React.FC<PointsListProps> = ({ onImportPress }) => {
  const [filters, setFilters] = useState<PointFiltersType>({ page: 1, perPage: 50 });
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [showActions, setShowActions] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendationsNonce, setRecommendationsNonce] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkColor, setBulkColor] = useState<PointColor | null>(null);
  const [bulkStatus, setBulkStatus] = useState<PointStatus | null>(null);
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [showConfirmDeleteSelected, setShowConfirmDeleteSelected] = useState(false);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [editingPointId, setEditingPointId] = useState<number | null>(null);
  const [pointToDelete, setPointToDelete] = useState<any | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualNameTouched, setManualNameTouched] = useState(false);
  const [manualAutoName, setManualAutoName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualCoords, setManualCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualColor, setManualColor] = useState<PointColor>(PointColor.BLUE);
  const [manualStatus, setManualStatus] = useState<PointStatus>(PointStatus.PLANNING);
  const [manualCategory, setManualCategory] = useState<PointCategory>(PointCategory.OTHER);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const { width: windowWidth } = useWindowDimensions();
  const isNarrow = windowWidth < 420;
  const isMobile = Platform.OS !== 'web';

  const listColumns = useMemo(() => {
    if (viewMode !== 'list') return 1;
    if (Platform.OS !== 'web') return 1;
    if (windowWidth >= 1100) return 3;
    if (windowWidth >= 740) return 2;
    return 1;
  }, [viewMode, windowWidth]);

  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['userPoints', filters],
    queryFn: () => userPointsApi.getPoints(filters),
  });

  // If backend errors (or not ready) — treat as empty list.
  const points = useMemo(() => {
    if (error) return [];
    return Array.isArray(data) ? data : [];
  }, [data, error]);

  const filteredPoints = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    const selectedColors = filters.colors ?? [];
    const selectedStatuses = filters.statuses ?? [];

    return points.filter((p: any) => {
      if (selectedColors.length > 0 && !selectedColors.includes(p.color)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(p.status)) return false;
      if (!q) return true;

      const haystack = `${p.name ?? ''} ${p.address ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [filters.colors, filters.statuses, points, searchQuery]);

  const mapPoints = useMemo(() => {
    if (!selectionMode) return filteredPoints;
    if (viewMode !== 'map') return filteredPoints;
    if (!selectedIds.length) return [];
    const selected = new Set(selectedIds);
    return filteredPoints.filter((p: any) => selected.has(Number(p.id)));
  }, [filteredPoints, selectedIds, selectionMode, viewMode]);

  useEffect(() => {
    if (!selectionMode) return;
    const visible = new Set(filteredPoints.map((p: any) => Number(p.id)).filter((id: any) => Number.isFinite(id)));
    setSelectedIds((prev) => prev.filter((id) => visible.has(id)));
  }, [filteredPoints, selectionMode]);

  const resetManualForm = useCallback(() => {
    setManualName('');
    setManualNameTouched(false);
    setManualAutoName('');
    setManualAddress('');
    setManualCoords(null);
    setManualLat('');
    setManualLng('');
    setManualColor(PointColor.BLUE);
    setManualStatus(PointStatus.PLANNING);
    setManualCategory(PointCategory.OTHER);
    setManualError(null);
    setEditingPointId(null);
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const primary = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ru`
      );
      if (primary.ok) {
        return await primary.json();
      }
    } catch {
      // ignore and fall back
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ru&extratags=1&namedetails=1&zoom=18`
      );
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  const getPrimaryPlaceName = useCallback((geocodeData: any, lat: number, lng: number): string => {
    const poi =
      geocodeData?.name ||
      geocodeData?.address?.name ||
      geocodeData?.address?.tourism ||
      geocodeData?.address?.amenity ||
      geocodeData?.address?.historic ||
      geocodeData?.address?.leisure ||
      geocodeData?.address?.place_of_worship ||
      geocodeData?.address?.building;

    if (poi && String(poi).trim()) return String(poi).trim();

    const address = buildAddressFromGeocode(geocodeData, { lat, lng });
    const firstPart = String(address || '').split('·')[0]?.trim();
    return firstPart || String(address || '').trim() || 'Новая точка';
  }, []);

  const closeManualAdd = useCallback(() => {
    setShowManualAdd(false);
    resetManualForm();
  }, [resetManualForm]);

  const openManualAdd = useCallback(() => {
    setShowActions(false);
    resetManualForm();
    setShowManualAdd(true);
  }, [resetManualForm]);

  const openEditPoint = useCallback(
    (point: any) => {
      const id = Number(point?.id);
      if (!Number.isFinite(id)) return;

      setShowActions(false);
      setEditingPointId(id);
      setManualName(String(point?.name ?? ''));
      setManualNameTouched(true);
      setManualAutoName('');
      setManualAddress(String(point?.address ?? ''));
      const lat = Number(point?.latitude);
      const lng = Number(point?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setManualCoords({ lat, lng });
        setManualLat(String(lat));
        setManualLng(String(lng));
      } else {
        setManualCoords(null);
        setManualLat('');
        setManualLng('');
      }
      setManualColor((point?.color as any) ?? PointColor.BLUE);
      setManualStatus((point?.status as any) ?? PointStatus.PLANNING);
      setManualCategory((point?.category as any) ?? PointCategory.OTHER);
      setManualError(null);
      setShowManualAdd(true);
    },
    []
  );

  const requestDeletePoint = useCallback((point: any) => {
    setPointToDelete(point);
  }, []);

  const toggleSelect = useCallback((point: any) => {
    const id = Number(point?.id);
    if (!Number.isFinite(id)) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const selectAllVisible = useCallback(() => {
    const all = filteredPoints.map((p: any) => Number(p.id)).filter((id: any) => Number.isFinite(id));
    setSelectedIds(Array.from(new Set(all)));
  }, [filteredPoints]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
    setShowBulkEdit(false);
    setBulkColor(null);
    setBulkStatus(null);
  }, []);

  const applyBulkEdit = useCallback(async () => {
    if (!selectedIds.length) return;
    const updates: any = {};
    if (bulkColor) updates.color = bulkColor;
    if (bulkStatus) updates.status = bulkStatus;
    if (!Object.keys(updates).length) return;

    setIsBulkWorking(true);
    try {
      await userPointsApi.bulkUpdatePoints(selectedIds, updates);
      await refetch();
      setShowBulkEdit(false);
      setBulkColor(null);
      setBulkStatus(null);
      setSelectedIds([]);
      setSelectionMode(false);
    } catch {
      // noop
    } finally {
      setIsBulkWorking(false);
    }
  }, [bulkColor, bulkStatus, refetch, selectedIds]);

  const deleteSelected = useCallback(async () => {
    if (!selectedIds.length) return;
    setIsBulkWorking(true);
    setBulkProgress({ current: 0, total: selectedIds.length });
    try {
      const batchSize = 5;
      let done = 0;
      for (let i = 0; i < selectedIds.length; i += batchSize) {
        const chunk = selectedIds.slice(i, i + batchSize);
        await Promise.all(chunk.map((id) => userPointsApi.deletePoint(id)));
        done += chunk.length;
        setBulkProgress({ current: done, total: selectedIds.length });
      }
      await refetch();
      setSelectedIds([]);
      setSelectionMode(false);
    } catch {
      // noop
    } finally {
      setIsBulkWorking(false);
      setBulkProgress(null);
      setShowConfirmDeleteSelected(false);
    }
  }, [refetch, selectedIds]);

  const deleteAll = useCallback(async () => {
    const allIds = points.map((p: any) => Number(p.id)).filter((id: any) => Number.isFinite(id));
    if (!allIds.length) return;
    setIsBulkWorking(true);
    setBulkProgress({ current: 0, total: allIds.length });
    try {
      const batchSize = 5;
      let done = 0;
      for (let i = 0; i < allIds.length; i += batchSize) {
        const chunk = allIds.slice(i, i + batchSize);
        await Promise.all(chunk.map((id) => userPointsApi.deletePoint(id)));
        done += chunk.length;
        setBulkProgress({ current: done, total: allIds.length });
      }
      await refetch();
      exitSelectionMode();
    } catch {
      // noop
    } finally {
      setIsBulkWorking(false);
      setBulkProgress(null);
      setShowConfirmDeleteAll(false);
    }
  }, [exitSelectionMode, points, refetch]);

  const handleMapPress = useCallback(
    (coords: { lat: number; lng: number }) => {
      setViewMode('map');
      setShowActions(false);
      resetManualForm();
      setManualCoords(coords);
      setManualLat(coords.lat.toFixed(6));
      setManualLng(coords.lng.toFixed(6));
      setManualName('Новая точка');
      setShowManualAdd(true);

      void (async () => {
        const geocodeData = await reverseGeocode(coords.lat, coords.lng);
        if (!geocodeData) return;

        const addr = buildAddressFromGeocode(geocodeData, { lat: coords.lat, lng: coords.lng });
        setManualAddress(String(addr || '').trim());

        const primaryName = getPrimaryPlaceName(geocodeData, coords.lat, coords.lng);
        setManualAutoName(primaryName);

        if (!manualNameTouched) {
          setManualName(primaryName);
        }
      })();
    },
    [getPrimaryPlaceName, manualNameTouched, resetManualForm, reverseGeocode]
  );

  const suggestManualName = useCallback((): string => {
    if (manualAutoName) return manualAutoName;
    return 'Новая точка';
  }, [manualAutoName]);

  useEffect(() => {
    if (!showManualAdd) return;
    if (manualNameTouched) return;
    setManualName(suggestManualName());
  }, [manualNameTouched, showManualAdd, suggestManualName]);

  const parseCoordinate = useCallback((value: string): number | null => {
    const trimmed = value.trim().replace(',', '.');
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return null;
    return num;
  }, []);

  const syncCoordsFromInputs = useCallback(
    (nextLatStr: string, nextLngStr: string) => {
      const lat = parseCoordinate(nextLatStr);
      const lng = parseCoordinate(nextLngStr);
      if (lat == null || lng == null) {
        setManualCoords(null);
        return;
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        setManualCoords(null);
        return;
      }
      setManualCoords({ lat, lng });
    },
    [parseCoordinate]
  );

  useEffect(() => {
    // noop (legacy POI categories removed from UI)
  }, []);

  const handleSaveManual = useCallback(async () => {
    setManualError(null);
    const name = manualName.trim();
    if (!name) {
      setManualError('Введите название точки');
      return;
    }
    if (!manualCoords) {
      setManualError('Укажите координаты');
      return;
    }

    setIsSavingManual(true);
    try {
      const payload: any = {
        name,
        address: manualAddress || undefined,
        latitude: manualCoords.lat,
        longitude: manualCoords.lng,
        color: manualColor,
        category: manualCategory,
        status: manualStatus,
      };

      if (editingPointId) {
        await userPointsApi.updatePoint(editingPointId, payload);
      } else {
        await userPointsApi.createPoint(payload);
      }

      closeManualAdd();
      await refetch();
    } catch (e) {
      setManualError(e instanceof Error ? e.message : 'Не удалось сохранить точку');
    } finally {
      setIsSavingManual(false);
    }
  }, [closeManualAdd, editingPointId, manualAddress, manualCategory, manualColor, manualCoords, manualName, manualStatus, refetch]);

  const confirmDeletePoint = useCallback(async () => {
    const id = Number(pointToDelete?.id);
    if (!Number.isFinite(id)) {
      setPointToDelete(null);
      return;
    }

    setIsBulkWorking(true);
    try {
      await userPointsApi.deletePoint(id);
      await refetch();
    } catch {
      // noop
    } finally {
      setIsBulkWorking(false);
      setPointToDelete(null);
    }
  }, [pointToDelete, refetch]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setFilters(prev => ({ ...prev, search: text, page: 1 }));
  };

  const handleFilterChange = (newFilters: PointFiltersType) => {
    setFilters({ ...newFilters, page: 1, perPage: filters.perPage ?? 50 });
  };

  const handleLocateMe = useCallback(async () => {
    setIsLocating(true);
    setViewMode('map');

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          return;
        }

        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000,
          });
        });

        setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        return;
      }

      const Location = await import('expo-location');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm?.granted) {
        return;
      }

      const pos = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    } catch {
      // noop
    } finally {
      setIsLocating(false);
    }
  }, []);

  const renderHeader = () => (
    <PointsListHeader
      styles={styles}
      colors={{ text: colors.text, textMuted: colors.textMuted, textOnPrimary: colors.textOnPrimary }}
      isNarrow={isNarrow}
      isMobile={isMobile}
      total={filteredPoints.length}
      viewMode={viewMode}
      onViewModeChange={(mode) => setViewMode(mode)}
      showFilters={showFilters}
      onToggleFilters={() => setShowFilters((v) => !v)}
      onOpenActions={() => setShowActions(true)}
      onOpenRecommendations={() => setShowRecommendations(true)}
      searchQuery={searchQuery}
      onSearch={handleSearch}
      filters={filters}
      onFilterChange={handleFilterChange}
      siteCategoryOptions={[]}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      {error ? (
        <>
          <Text style={styles.emptyText}>Не удалось загрузить точки</Text>
          <Text style={styles.emptySubtext}>Проверьте подключение и попробуйте ещё раз</Text>
          <View style={styles.emptyActionsRow}>
            <TouchableOpacity
              style={[styles.retryButton, styles.emptyActionButton]}
              onPress={() => refetch()}
              accessibilityRole="button"
              accessibilityLabel="Повторить"
            >
              <Text style={styles.retryButtonText}>Повторить</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.emptyText}>Точки не найдены</Text>
          <Text style={styles.emptySubtext}>Импортируйте точки или добавьте вручную</Text>
          <View style={styles.emptyActionsRow}>
            <TouchableOpacity
              style={[styles.retryButton, styles.emptyActionButton]}
              onPress={() => onImportPress?.()}
              accessibilityRole="button"
              accessibilityLabel="Импорт"
            >
              <Text style={styles.retryButtonText}>Импорт</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, styles.emptyActionButton]}
              onPress={openManualAdd}
              accessibilityRole="button"
              accessibilityLabel="Добавить вручную"
            >
              <Text style={styles.secondaryButtonText}>Добавить вручную</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  const recommendations = useMemo(() => {
    // include nonce so clicking "Обновить" reshuffles
    void recommendationsNonce;
    if (!points.length) return [];

    const copy = [...points];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy.slice(0, 3);
  }, [points, recommendationsNonce]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <PointsListItem
        point={item}
        layout={listColumns > 1 ? 'grid' : 'list'}
        onPress={selectionMode && viewMode === 'list' ? undefined : openEditPoint}
        onEdit={selectionMode && viewMode === 'list' ? undefined : openEditPoint}
        onDelete={selectionMode && viewMode === 'list' ? undefined : requestDeletePoint}
        selectionMode={selectionMode && viewMode === 'list'}
        selected={selectedIds.includes(Number(item?.id))}
        onToggleSelect={toggleSelect}
      />
    ),
    [listColumns, openEditPoint, requestDeletePoint, selectedIds, selectionMode, toggleSelect, viewMode]
  );

  const renderFooter = useCallback(() => {
    return null
  }, [])

  return (
    <View style={styles.container}>
      {selectionMode && viewMode === 'list' ? (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkBarText}>
            {bulkProgress
              ? `Удаляем: ${bulkProgress.current}/${bulkProgress.total}`
              : `Выбрано: ${selectedIds.length}`}
          </Text>
          <View style={styles.bulkBarActions}>
            <TouchableOpacity
              style={[styles.bulkBarButton, isBulkWorking && styles.bulkBarButtonDisabled]}
              onPress={selectAllVisible}
              disabled={isBulkWorking}
              accessibilityRole="button"
              accessibilityLabel="Выбрать всё"
            >
              <Text style={styles.bulkBarButtonText}>Все</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBarButton, isBulkWorking && styles.bulkBarButtonDisabled]}
              onPress={clearSelection}
              disabled={isBulkWorking}
              accessibilityRole="button"
              accessibilityLabel="Снять"
            >
              <Text style={styles.bulkBarButtonText}>Снять</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBarButtonPrimary, isBulkWorking && styles.bulkBarButtonDisabled]}
              onPress={() => setShowBulkEdit(true)}
              disabled={isBulkWorking || selectedIds.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Изменить"
            >
              <Text style={styles.bulkBarButtonPrimaryText}>Изменить</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bulkBarButton, isBulkWorking && styles.bulkBarButtonDisabled]}
              onPress={() => setViewMode('map')}
              disabled={isBulkWorking || selectedIds.length === 0}
              accessibilityRole="button"
              accessibilityLabel="На карте"
            >
              <Text style={styles.bulkBarButtonText}>На карте</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBarButtonDanger, isBulkWorking && styles.bulkBarButtonDisabled]}
              onPress={() => setShowConfirmDeleteSelected(true)}
              disabled={isBulkWorking || selectedIds.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Удалить выбранные"
            >
              <Text style={styles.bulkBarButtonDangerText}>Удалить</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBarButton, isBulkWorking && styles.bulkBarButtonDisabled]}
              onPress={exitSelectionMode}
              disabled={isBulkWorking}
              accessibilityRole="button"
              accessibilityLabel="Готово"
            >
              <Text style={styles.bulkBarButtonText}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {selectionMode && viewMode === 'map' ? (
        <View style={styles.bulkMapBar}>
          <View style={styles.bulkMapBarRow}>
            <Text style={styles.bulkMapBarText}>
              {bulkProgress
                ? `Удаляем: ${bulkProgress.current}/${bulkProgress.total}`
                : selectedIds.length > 0
                  ? `Выбрано: ${selectedIds.length}`
                  : 'Выберите точки в списке'}
            </Text>
            <View style={styles.bulkMapBarActions}>
              <TouchableOpacity
                style={[styles.bulkMapBarButton, isBulkWorking && styles.bulkBarButtonDisabled]}
                onPress={() => setViewMode('list')}
                disabled={isBulkWorking}
                accessibilityRole="button"
                accessibilityLabel="Назад к списку"
              >
                <Text style={styles.bulkMapBarButtonText}>Список</Text>
              </TouchableOpacity>

              {selectedIds.length > 0 ? (
                <>
                  <TouchableOpacity
                    style={[styles.bulkMapBarButton, isBulkWorking && styles.bulkBarButtonDisabled]}
                    onPress={clearSelection}
                    disabled={isBulkWorking}
                    accessibilityRole="button"
                    accessibilityLabel="Снять"
                  >
                    <Text style={styles.bulkMapBarButtonText}>Снять</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.bulkMapBarButtonPrimary, isBulkWorking && styles.bulkBarButtonDisabled]}
                    onPress={() => setShowBulkEdit(true)}
                    disabled={isBulkWorking}
                    accessibilityRole="button"
                    accessibilityLabel="Изменить"
                  >
                    <Text style={styles.bulkMapBarButtonPrimaryText}>Изменить</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.bulkMapBarButtonDanger, isBulkWorking && styles.bulkBarButtonDisabled]}
                    onPress={() => setShowConfirmDeleteSelected(true)}
                    disabled={isBulkWorking}
                    accessibilityRole="button"
                    accessibilityLabel="Удалить выбранные"
                  >
                    <Text style={styles.bulkMapBarButtonDangerText}>Удалить</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <TouchableOpacity
                style={[styles.bulkMapBarButton, isBulkWorking && styles.bulkBarButtonDisabled]}
                onPress={exitSelectionMode}
                disabled={isBulkWorking}
                accessibilityRole="button"
                accessibilityLabel="Готово"
              >
                <Text style={styles.bulkMapBarButtonText}>Готово</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      <PointsListGrid
        styles={styles}
        colors={{ text: colors.text }}
        viewMode={viewMode}
        isLoading={isLoading}
        filteredPoints={viewMode === 'map' ? mapPoints : filteredPoints}
        numColumns={listColumns}
        renderHeader={renderHeader}
        renderItem={renderItem}
        renderEmpty={renderEmpty}
        renderFooter={renderFooter}
        onRefresh={refetch}
        currentLocation={currentLocation}
        onMapPress={handleMapPress}
        onPointEdit={openEditPoint}
        onPointDelete={requestDeletePoint}
        showManualAdd={showManualAdd}
        manualCoords={manualCoords}
        manualColor={manualColor}
        isLocating={isLocating}
        onLocateMe={handleLocateMe}
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

            <TouchableOpacity
              style={styles.actionsItem}
              onPress={() => {
                setShowActions(false);
                onImportPress?.();
              }}
              accessibilityRole="button"
              accessibilityLabel="Импорт"
            >
              <Text style={styles.actionsItemText}>Импорт</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionsItem}
              onPress={openManualAdd}
              accessibilityRole="button"
              accessibilityLabel="Добавить вручную"
            >
              <Text style={styles.actionsItemText}>Добавить вручную</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionsItem}
              onPress={() => {
                setShowActions(false);
                setViewMode('list');
                setSelectionMode(true);
                setSelectedIds([]);
              }}
              accessibilityRole="button"
              accessibilityLabel="Выбрать точки"
            >
              <Text style={styles.actionsItemText}>Выбрать точки</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionsItem}
              onPress={() => {
                setShowActions(false);
                setShowConfirmDeleteAll(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Удалить все точки"
            >
              <Text style={styles.actionsItemText}>Удалить все точки</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionsItem, styles.actionsItemCancel]}
              onPress={() => setShowActions(false)}
              accessibilityRole="button"
              accessibilityLabel="Отмена"
            >
              <Text style={styles.actionsItemCancelText}>Отмена</Text>
            </TouchableOpacity>
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

            <TouchableOpacity
              style={[
                styles.manualSaveButton,
                { backgroundColor: colors.danger } as any,
                isBulkWorking && styles.manualSaveButtonDisabled,
              ]}
              onPress={confirmDeletePoint}
              disabled={isBulkWorking}
              accessibilityRole="button"
              accessibilityLabel="Удалить"
            >
              <Text style={styles.manualSaveButtonText}>Удалить</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionsItem, styles.actionsItemCancel, { marginTop: DESIGN_TOKENS.spacing.sm } as any]}
              onPress={() => setPointToDelete(null)}
              accessibilityRole="button"
              accessibilityLabel="Отмена"
            >
              <Text style={styles.actionsItemCancelText}>Отмена</Text>
            </TouchableOpacity>
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

            <FormFieldWithValidation label="Цвет">
              <SimpleMultiSelect
                data={Object.entries(COLOR_CATEGORIES).map(([value, info]) => ({ value, label: (info as any).label }))}
                value={bulkColor ? [bulkColor] : []}
                onChange={(vals) => {
                  const v = (vals[vals.length - 1] as PointColor | undefined) ?? undefined;
                  setBulkColor(v ?? null);
                }}
                labelField="label"
                valueField="value"
                search={false}
              />
            </FormFieldWithValidation>

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

            <TouchableOpacity
              style={[styles.manualSaveButton, isBulkWorking && styles.manualSaveButtonDisabled]}
              onPress={applyBulkEdit}
              disabled={isBulkWorking || selectedIds.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Применить"
            >
              <Text style={styles.manualSaveButtonText}>Применить</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionsItem, styles.actionsItemCancel, { marginTop: DESIGN_TOKENS.spacing.sm } as any]}
              onPress={() => setShowBulkEdit(false)}
              accessibilityRole="button"
              accessibilityLabel="Отмена"
            >
              <Text style={styles.actionsItemCancelText}>Отмена</Text>
            </TouchableOpacity>
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

            <TouchableOpacity
              style={[styles.manualSaveButton, { backgroundColor: colors.danger } as any, isBulkWorking && styles.manualSaveButtonDisabled]}
              onPress={deleteSelected}
              disabled={isBulkWorking}
              accessibilityRole="button"
              accessibilityLabel="Удалить"
            >
              <Text style={styles.manualSaveButtonText}>Удалить</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionsItem, styles.actionsItemCancel, { marginTop: DESIGN_TOKENS.spacing.sm } as any]}
              onPress={() => setShowConfirmDeleteSelected(false)}
              accessibilityRole="button"
              accessibilityLabel="Отмена"
            >
              <Text style={styles.actionsItemCancelText}>Отмена</Text>
            </TouchableOpacity>
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

            <TouchableOpacity
              style={[styles.manualSaveButton, { backgroundColor: colors.danger } as any, isBulkWorking && styles.manualSaveButtonDisabled]}
              onPress={deleteAll}
              disabled={isBulkWorking}
              accessibilityRole="button"
              accessibilityLabel="Удалить все"
            >
              <Text style={styles.manualSaveButtonText}>Удалить все</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionsItem, styles.actionsItemCancel, { marginTop: DESIGN_TOKENS.spacing.sm } as any]}
              onPress={() => setShowConfirmDeleteAll(false)}
              accessibilityRole="button"
              accessibilityLabel="Отмена"
            >
              <Text style={styles.actionsItemCancelText}>Отмена</Text>
            </TouchableOpacity>
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
              <TouchableOpacity
                style={styles.manualHeaderButton}
                onPress={closeManualAdd}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
              >
                <Text style={styles.manualHeaderButtonText}>Закрыть</Text>
              </TouchableOpacity>
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

              <FormFieldWithValidation label="Цвет" required>
                <SimpleMultiSelect
                  data={Object.entries(COLOR_CATEGORIES).map(([value, info]) => ({ value, label: (info as any).label }))}
                  value={[manualColor]}
                  onChange={(vals) => {
                    const v = vals[vals.length - 1] as PointColor | undefined;
                    if (v) setManualColor(v);
                  }}
                  labelField="label"
                  valueField="value"
                  search={false}
                />
              </FormFieldWithValidation>

              <FormFieldWithValidation label="Статус" required>
                <SimpleMultiSelect
                  data={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                  value={[manualStatus]}
                  onChange={(vals) => {
                    const v = vals[vals.length - 1] as PointStatus | undefined;
                    if (v) setManualStatus(v);
                  }}
                  labelField="label"
                  valueField="value"
                  search={false}
                />
              </FormFieldWithValidation>

              {manualError && manualName.trim() && manualCoords ? (
                <Text style={styles.manualErrorText}>{manualError}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.manualFooter}>
              <TouchableOpacity
                style={[styles.manualSaveButton, isSavingManual && styles.manualSaveButtonDisabled]}
                onPress={handleSaveManual}
                disabled={isSavingManual}
                accessibilityRole="button"
                accessibilityLabel="Сохранить точку"
              >
                <Text style={styles.manualSaveButtonText}>
                  {isSavingManual ? 'Сохранение…' : 'Сохранить'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRecommendations}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecommendations(false)}
      >
        <View style={styles.recoOverlay}>
          <TouchableOpacity
            style={styles.recoBackdrop}
            activeOpacity={1}
            onPress={() => setShowRecommendations(false)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть рекомендации"
          />

          <View style={styles.recoModal}>
            <View style={styles.recoHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recoTitle}>Куда поехать сегодня</Text>
                <Text style={styles.recoSubtitle}>3 случайные точки</Text>
              </View>

              <TouchableOpacity
                style={styles.recoHeaderButton}
                onPress={() => setRecommendationsNonce((v) => v + 1)}
                accessibilityRole="button"
                accessibilityLabel="Обновить рекомендации"
              >
                <Text style={styles.recoHeaderButtonText}>Обновить</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.recoHeaderButton}
                onPress={() => setShowRecommendations(false)}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
              >
                <Text style={styles.recoHeaderButtonText}>Закрыть</Text>
              </TouchableOpacity>
            </View>

            {!points.length ? (
              <View style={styles.recoEmpty}>
                <Text style={styles.recoEmptyText}>Нет точек</Text>
                <Text style={styles.recoEmptySubtext}>
                  Импортируйте или добавьте точки вручную, чтобы получить рекомендации
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.recoScroll}
                contentContainerStyle={styles.recoScrollContent}
              >
                {recommendations.map((p) => (
                  <PointCard key={p.id} point={p} />
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export type PointsListStyles = ReturnType<typeof createStyles>;

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bulkBar: {
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingTop: DESIGN_TOKENS.spacing.md,
    paddingBottom: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bulkBarText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '700' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  bulkBarActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
    alignItems: 'center',
  },
  bulkBarButton: {
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkBarButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700' as any,
    color: colors.text,
  },
  bulkBarButtonPrimary: {
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.primary,
  },
  bulkBarButtonPrimaryText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '800' as any,
    color: colors.textOnPrimary,
  },
  bulkBarButtonDanger: {
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.danger,
  },
  bulkBarButtonDangerText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '800' as any,
    color: colors.textOnPrimary,
  },
  bulkBarButtonDisabled: {
    opacity: 0.7,
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
  bulkMapBarButton: {
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkMapBarButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700' as any,
    color: colors.text,
  },
  bulkMapBarButtonPrimary: {
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.primary,
  },
  bulkMapBarButtonPrimaryText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '800' as any,
    color: colors.textOnPrimary,
  },
  bulkMapBarButtonDanger: {
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.danger,
  },
  bulkMapBarButtonDangerText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '800' as any,
    color: colors.textOnPrimary,
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
  header: {
    padding: DESIGN_TOKENS.spacing.lg,
    backgroundColor: colors.surface,
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
  headerButton: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    justifyContent: 'center',
  },
  headerIconButton: {
    width: DESIGN_TOKENS.touchTarget.minHeight,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButtonPrimary: {
    width: DESIGN_TOKENS.touchTarget.minHeight,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700' as any,
    color: colors.text,
  },
  recoOpenButton: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  recoOpenButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700' as any,
    color: colors.textOnPrimary,
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
  actionsItem: {
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  actionsItemText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '700' as any,
    color: colors.text,
  },
  actionsItemCancel: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  actionsItemCancelText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '700' as any,
    color: colors.textMuted,
    textAlign: 'center',
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
  manualHeaderButton: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualHeaderButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700' as any,
    color: colors.text,
  },
  manualScroll: {
    flex: 1,
  },
  manualScrollContent: {
    padding: DESIGN_TOKENS.spacing.lg,
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
  manualSaveButton: {
    backgroundColor: colors.primary,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
  },
  manualSaveButtonDisabled: {
    opacity: 0.7,
  },
  manualSaveButtonText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '800' as any,
  },
  manualErrorText: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    color: colors.danger,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600' as any,
  },
  searchContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
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
  recoOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.lg,
  },
  recoBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  recoModal: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
  },
  recoHeader: {
    padding: DESIGN_TOKENS.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  recoTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '700' as any,
    color: colors.text,
  },
  recoSubtitle: {
    marginTop: 2,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
  },
  recoHeaderButton: {
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recoHeaderButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600' as any,
    color: colors.text,
  },
  recoScroll: {
    flex: 1,
  },
  recoScrollContent: {
    paddingVertical: DESIGN_TOKENS.spacing.lg,
  },
  recoEmpty: {
    padding: DESIGN_TOKENS.spacing.xl,
    alignItems: 'center',
  },
  recoEmptyText: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '700' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  recoEmptySubtext: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
