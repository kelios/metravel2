import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { userPointsApi } from '@/src/api/userPoints';
import { fetchFiltersMap } from '@/src/api/map';
import FormFieldWithValidation from '@/components/FormFieldWithValidation';
import SimpleMultiSelect from '@/components/SimpleMultiSelect';
import { buildAddressFromGeocode } from '@/components/travel/WebMapComponent';
import type { PointFilters as PointFiltersType } from '@/types/userPoints';
import { PointStatus, STATUS_LABELS } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

import { PointsListHeader } from './PointsListHeader'
import { PointsListGrid } from './PointsListGrid'
import { PointsListItem } from './PointsListItem'

const STATUS_TO_COLOR: Record<PointStatus, string> = {
  [PointStatus.VISITED]: 'green',
  [PointStatus.WANT_TO_VISIT]: 'purple',
  [PointStatus.PLANNING]: 'blue',
  [PointStatus.ARCHIVED]: 'gray',
}

type ViewMode = 'list' | 'map';

type PointsListProps = {
  onImportPress?: () => void;
};

export const PointsList: React.FC<PointsListProps> = ({ onImportPress }) => {
  const [filters, setFilters] = useState<PointFiltersType>({ page: 1, perPage: 50, radiusKm: 100 });
  const [showFilters, setShowFilters] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const viewMode: ViewMode = 'map'; // Fixed to map view only
  const [showActions, setShowActions] = useState(false);
  const [recommendedPointIds, setRecommendedPointIds] = useState<number[]>([]);
  const [showingRecommendations, setShowingRecommendations] = useState(false);
  const [recommendedRoutes, setRecommendedRoutes] = useState<Record<number, { distance: number; duration: number }>>({});
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activePointId, setActivePointId] = useState<number | null>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkColor, setBulkColor] = useState<string | null>(null);
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
  const [manualColor, setManualColor] = useState<string>('#2196F3');
  const [manualStatus, setManualStatus] = useState<PointStatus>(PointStatus.PLANNING);
  const [manualCategory, setManualCategory] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const { width: windowWidth } = useWindowDimensions();
  const isNarrow = windowWidth < 420;
  const isMobile = Platform.OS !== 'web';

  // Auto-request geolocation on mount for default 100km radius filter
  useEffect(() => {
    const requestLocation = async () => {
      try {
        if (Platform.OS === 'web') {
          if (typeof navigator === 'undefined' || !navigator.geolocation) {
            return;
          }

          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            });
          });

          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            return;
          }

          const pos = await Location.getCurrentPositionAsync({});
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        }
      } catch {
        // If location fails, user can still see all points or manually enable location
      }
    };

    requestLocation();
  }, []);

  const listColumns = 1;

  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const siteCategoryOptionsQuery = useQuery({
    queryKey: ['userPointsSiteCategories'],
    queryFn: async () => {
      const data = await fetchFiltersMap();
      const raw = (data as any)?.categories;
      if (!Array.isArray(raw)) return [] as Array<{ id: string; name: string }>;

      return raw
        .map((cat: any) => {
          if (cat == null) return null;

          const name = typeof cat === 'string' ? cat : cat?.name;
          const normalizedName = String(name ?? cat ?? '').trim();
          if (!normalizedName) return null;

          // Use the backend category name as the filter value to match point.category.
          return { id: normalizedName, name: normalizedName };
        })
        .filter((v: any): v is { id: string; name: string } => v != null);
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['userPoints', filters],
    queryFn: () => userPointsApi.getPoints(filters),
  });

  // If backend errors (or not ready) — treat as empty list.
  const points = useMemo(() => {
    if (error) return [];
    return Array.isArray(data) ? data : [];
  }, [data, error]);

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const p of points as any[]) {
      const s = String(p?.status ?? '').trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [points]);

  const availableColors = useMemo(() => {
    const colorMap = new Map<string, number>();
    for (const p of points as any[]) {
      const c = String(p?.color ?? '').trim();
      if (c) {
        colorMap.set(c, (colorMap.get(c) || 0) + 1);
      }
    }
    return Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .map(([color]) => color);
  }, [points]);

  const filteredPointsWithoutCategory = useMemo(() => {
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

  const availableCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of filteredPointsWithoutCategory as any[]) {
      const c = String(p?.category ?? '').trim();
      if (c) set.add(c);
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ id: name, name }));
  }, [filteredPointsWithoutCategory]);

  const filteredPoints = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    const selectedColors = filters.colors ?? [];
    const selectedStatuses = filters.statuses ?? [];
    const selectedCategories = filters.siteCategories ?? [];
    const radiusKm = filters.radiusKm;

    // Helper function to calculate distance in km using Haversine formula
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    return points.filter((p: any) => {
      if (selectedColors.length > 0 && !selectedColors.includes(p.color)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(p.status)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(String(p.category ?? ''))) return false;
      
      // Radius filter - only apply if radiusKm is set and currentLocation exists
      if (radiusKm !== null && radiusKm !== undefined && currentLocation) {
        const pointLat = Number(p.latitude);
        const pointLng = Number(p.longitude);
        if (Number.isFinite(pointLat) && Number.isFinite(pointLng)) {
          const distance = calculateDistance(
            currentLocation.lat,
            currentLocation.lng,
            pointLat,
            pointLng
          );
          if (distance > radiusKm) return false;
        }
      }
      
      if (!q) return true;

      const haystack = `${p.name ?? ''} ${p.address ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [filters.colors, filters.siteCategories, filters.statuses, filters.radiusKm, points, searchQuery, currentLocation]);

  const mapPoints = useMemo(() => {
    // Show only recommended points when in recommendations mode
    if (showingRecommendations && recommendedPointIds.length > 0) {
      const recommended = new Set(recommendedPointIds);
      return filteredPoints.filter((p: any) => recommended.has(Number(p.id)));
    }
    
    if (!selectionMode) return filteredPoints;
    if (!selectedIds.length) return filteredPoints;
    const selected = new Set(selectedIds);
    return filteredPoints.filter((p: any) => selected.has(Number(p.id)));
  }, [filteredPoints, selectedIds, selectionMode, showingRecommendations, recommendedPointIds]);

  useEffect(() => {
    const selected = filters.siteCategories ?? [];
    if (!selected.length) return;
    const available = new Set(availableCategoryOptions.map((c) => c.id));
    const next = selected.filter((c) => available.has(c));
    if (next.length === selected.length) return;
    setFilters((prev) => ({ ...prev, siteCategories: next, page: 1 }));
  }, [availableCategoryOptions, filters.siteCategories]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    setFilters((prev) => ({ ...prev, search: text, page: 1 }));
  }, []);

  const handleFilterChange = useCallback(
    (newFilters: PointFiltersType) => {
      setFilters({ ...newFilters, page: 1, perPage: filters.perPage ?? 50 });
    },
    [filters.perPage]
  );

  const hasActiveFilters = useMemo(() => {
    return (
      (filters.statuses?.length ?? 0) > 0 ||
      (filters.siteCategories?.length ?? 0) > 0 ||
      (filters.colors?.length ?? 0) > 0
    );
  }, [filters.colors, filters.siteCategories, filters.statuses]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    
    (filters.statuses ?? []).forEach((status) => {
      const label = (STATUS_LABELS as Record<string, string>)[status as unknown as string] || String(status);
      chips.push({ key: `status-${status}`, label: `Статус: ${label}` });
    });
    
    (filters.siteCategories ?? []).forEach((cat) => {
      chips.push({ key: `category-${cat}`, label: `Категория: ${cat}` });
    });
    
    (filters.colors ?? []).forEach((color) => {
      chips.push({ key: `color-${color}`, label: `Цвет: ${color}` });
    });
    
    return chips;
  }, [filters.colors, filters.siteCategories, filters.statuses]);

  const handleResetFilters = useCallback(() => {
    setFilters({ page: 1, perPage: filters.perPage ?? 50 });
  }, [filters.perPage]);

  const handleRemoveFilterChip = useCallback((key: string) => {
    if (key.startsWith('status-')) {
      const status = key.replace('status-', '') as PointStatus;
      const next = (filters.statuses ?? []).filter((s) => s !== status);
      setFilters((prev) => ({ ...prev, statuses: next, page: 1 }));
    } else if (key.startsWith('category-')) {
      const category = key.replace('category-', '');
      const next = (filters.siteCategories ?? []).filter((c) => c !== category);
      setFilters((prev) => ({ ...prev, siteCategories: next, page: 1 }));
    } else if (key.startsWith('color-')) {
      const color = key.replace('color-', '');
      const next = (filters.colors ?? []).filter((c) => c !== color);
      setFilters((prev) => ({ ...prev, colors: next, page: 1 }));
    }
  }, [filters.colors, filters.siteCategories, filters.statuses]);

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
    setManualColor('#2196F3');
    setManualStatus(PointStatus.PLANNING);
    setManualCategory('');
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

  const openEditPoint = useCallback(
    (point: any) => {
      if (!point) return;
      setShowActions(false);
      resetManualForm();

      setEditingPointId(Number(point.id));
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
      setManualColor(String(point?.color ?? '#2196F3'));
      const nextStatus = ((point?.status as any) ?? PointStatus.PLANNING) as PointStatus;
      setManualStatus(nextStatus);
      setManualCategory(String((point as any)?.category ?? ''));
      setManualError(null);
      setShowManualAdd(true);
    },
    [resetManualForm]
  );

  const requestDeletePoint = useCallback((point: any) => {
    setPointToDelete(point);
  }, []);

const toggleSelect = useCallback((point: any) => {
  const id = Number(point?.id);
  if (!Number.isFinite(id)) return;
  setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
}, []);

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
      setShowActions(false);
      resetManualForm();
      setManualCoords(coords);
      setManualLat(coords.lat.toFixed(6));
      setManualLng(coords.lng.toFixed(6));
      setManualName('Новая точка');
      setShowManualAdd(true);
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
    if (!manualCategory) {
      setManualError('Выберите категорию');
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

  const handleOpenRecommendations = useCallback(async () => {
    // Get 3 random points from filtered points (respects all active filters)
    const shuffled = [...filteredPoints].sort(() => Math.random() - 0.5);
    const recommended = shuffled.slice(0, 3);
    const recommendedIds = recommended.map((p: any) => Number(p.id));
    
    setRecommendedPointIds(recommendedIds);
    setShowingRecommendations(true);
    
    // Calculate routes if we have current location
    if (currentLocation && recommended.length > 0) {
      const routes: Record<number, { distance: number; duration: number }> = {};
      
      // Calculate route to each recommended point
      for (const point of recommended) {
        try {
          // Use OSRM public API for car routing
          const url = `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${point.longitude},${point.latitude}?overview=false`;
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.code === 'Ok' && data.routes && data.routes[0]) {
            const route = data.routes[0];
            routes[Number(point.id)] = {
              distance: Math.round(route.distance / 1000), // Convert meters to km
              duration: Math.round(route.duration / 60), // Convert seconds to minutes
            };
          }
        } catch (error) {
          // If route calculation fails, skip this point
          console.warn('Failed to calculate route for point', point.id, error);
        }
      }
      
      setRecommendedRoutes(routes);
      setActivePointId(null); // Clear any active point to trigger auto-fit
    }
  }, [filteredPoints, currentLocation]);

  const handleShowPointOnMap = useCallback((point: any) => {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return;
    
    // Set active point to center map on it
    setActivePointId(Number(point.id));
    
    // Clear active point after a short delay so user can click again
    setTimeout(() => {
      setActivePointId(null);
    }, 1000);
  }, []);

  const handleLocateMe = useCallback(async () => {
    setIsLocating(true);

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

  const renderHeader = useCallback(() => {
    return (
      <PointsListHeader
        styles={styles}
        colors={{ text: colors.text, textMuted: colors.textMuted, textOnPrimary: colors.textOnPrimary }}
        isNarrow={isNarrow}
        isMobile={isMobile}
        total={points.length}
        found={filteredPoints.length}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        activeFilterChips={activeFilterChips}
        onRemoveFilterChip={handleRemoveFilterChip}
        viewMode={viewMode}
        onViewModeChange={() => {}} // No-op since view is fixed to map
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
        onOpenActions={() => setShowActions(true)}
        onOpenRecommendations={handleOpenRecommendations}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        filters={filters}
        onFilterChange={handleFilterChange}
        siteCategoryOptions={availableCategoryOptions}
        availableStatuses={availableStatuses}
        availableColors={availableColors}
      />
    );
  }, [
    activeFilterChips,
    availableColors,
    availableStatuses,
    availableCategoryOptions,
    colors.text,
    colors.textMuted,
    colors.textOnPrimary,
    filters,
    filteredPoints.length,
    handleFilterChange,
    handleRemoveFilterChip,
    handleResetFilters,
    handleSearch,
    hasActiveFilters,
    isMobile,
    isNarrow,
    points.length,
    searchQuery,
    showFilters,
    styles,
    viewMode,
  ]);

const suggestManualName = useCallback((): string => {
  if (manualAutoName) return manualAutoName;
  return 'Новая точка';
}, [manualAutoName]);

useEffect(() => {
  if (!showManualAdd) return;
  if (manualNameTouched) return;
  setManualName(suggestManualName());
}, [manualNameTouched, showManualAdd, suggestManualName]);


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

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <PointsListItem
        point={item}
        layout={listColumns > 1 ? 'grid' : 'list'}
        onPress={selectionMode ? undefined : handleShowPointOnMap}
        onEdit={selectionMode ? undefined : openEditPoint}
        onDelete={selectionMode ? undefined : requestDeletePoint}
        selectionMode={selectionMode}
        selected={selectedIds.includes(Number(item?.id))}
        onToggleSelect={toggleSelect}
      />
    ),
    [listColumns, handleShowPointOnMap, openEditPoint, requestDeletePoint, selectedIds, selectionMode, toggleSelect]
  );

  const renderFooter = useCallback(() => {
    return null
  }, [])

  return (
    <View style={styles.container}>
      {selectionMode ? (
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
                onPress={() => {}}
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
        showingRecommendations={showingRecommendations}
        onCloseRecommendations={() => {
          setShowingRecommendations(false);
          setRecommendedPointIds([]);
          setRecommendedRoutes({});
        }}
        activePointId={activePointId}
        recommendedRoutes={recommendedRoutes}
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

              <FormFieldWithValidation label="Категория" required>
                <SimpleMultiSelect
                  data={(siteCategoryOptionsQuery.data ?? []).map((cat) => ({
                    value: cat.name,
                    label: cat.name,
                  }))}
                  value={manualCategory ? [manualCategory] : []}
                  onChange={(vals) => {
                    const v = vals[vals.length - 1];
                    if (typeof v === 'string') setManualCategory(v);
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
                    if (!v) return;
                    setManualStatus(v);
                    if (!editingPointId) setManualColor(STATUS_TO_COLOR[v]);
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
    </View>
  );
};

export type PointsListStyles = ReturnType<typeof createStyles>;

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: DESIGN_TOKENS.spacing.lg,
    paddingBottom: 0,
    gap: DESIGN_TOKENS.spacing.md,
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
  titleContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
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
  webChip: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  webChipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600' as any,
    color: colors.text,
  },
});
