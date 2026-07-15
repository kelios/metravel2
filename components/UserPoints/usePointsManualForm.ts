import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { QueryClient } from '@tanstack/react-query';

import { userPointsApi } from '@/api/userPoints';
import { queryKeys } from '@/api/queryKeys';
import { buildAddressFromGeocode } from '@/utils/geocodeHelpers';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { PointStatus } from '@/types/userPoints';
import { bigDataCloudReverse } from '@/api/external/bigdatacloud';
import { nominatimReverse } from '@/api/external/nominatim';
import { translate as i18nT } from '@/i18n'
import { getMapGeocoderLanguage } from '@/utils/mapLocale';


type PointLike = Record<string, unknown>;

type Coords = { lat: number; lng: number };

type Params = {
  blurActiveElementForModal: () => void;
  setShowActions: React.Dispatch<React.SetStateAction<boolean>>;
  resolveCategoryIdsForEdit: (point: PointLike) => string[];
  queryClient: QueryClient;
};

const parseCoordinate = (value: string): number | null => {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return num;
};

const getPrimaryPlaceName = (geocodeData: unknown, lat: number, lng: number): string => {
  const data = (geocodeData ?? {}) as Record<string, unknown>;
  const address = (data.address ?? {}) as Record<string, unknown>;

  const poi =
    data.name ??
    address.name ??
    address.tourism ??
    address.amenity ??
    address.historic ??
    address.leisure ??
    address.place_of_worship ??
    address.building;

  if (poi && String(poi).trim()) return String(poi).trim();

  const builtAddress = buildAddressFromGeocode(geocodeData, { lat, lng });
  const firstPart = String(builtAddress || '').split('·')[0]?.trim();
  return firstPart || String(builtAddress || '').trim() || i18nT('map:components.UserPoints.usePointsManualForm.novaya_tochka_4d3f685d');
};

const reverseGeocode = async (lat: number, lng: number): Promise<unknown | null> => {
  const geocoderLanguage = getMapGeocoderLanguage();
  try {
    const primary = await bigDataCloudReverse(lat, lng, geocoderLanguage);
    if (primary.ok) {
      return await primary.json();
    }
  } catch {
    // ignore and fall back
  }

  try {
    const response = await nominatimReverse(
      { lat, lng, zoom: 18, addressdetails: 1, extratags: 1, namedetails: 1, acceptLanguage: geocoderLanguage },
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

export const usePointsManualForm = ({
  blurActiveElementForModal,
  setShowActions,
  resolveCategoryIdsForEdit,
  queryClient,
}: Params) => {
  const [editingPointId, setEditingPointId] = useState<number | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualNameTouched, setManualNameTouched] = useState(false);
  const [manualAutoName, setManualAutoName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualCoords, setManualCoords] = useState<Coords | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualColor, setManualColor] = useState<string>(DESIGN_COLORS.userPointDefault);
  const [manualStatus, setManualStatus] = useState<PointStatus>(PointStatus.PLANNING);
  const [manualCategoryIds, setManualCategoryIds] = useState<string[]>([]);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const manualNameTouchedRef = useRef(false);
  const geocodeSeq = useRef(0);

  useEffect(() => {
    manualNameTouchedRef.current = manualNameTouched;
  }, [manualNameTouched]);

  useEffect(() => {
    if (!showManualAdd) return;
    if (manualNameTouched) return;
    setManualName(manualAutoName || i18nT('map:components.UserPoints.usePointsManualForm.novaya_tochka_4d3f685d'));
  }, [manualAutoName, manualNameTouched, showManualAdd]);

  const resetManualForm = useCallback(() => {
    geocodeSeq.current += 1;
    setManualName('');
    setManualNameTouched(false);
    setManualAutoName('');
    setManualAddress('');
    setManualCoords(null);
    setManualLat('');
    setManualLng('');
    setManualColor(DESIGN_COLORS.userPointDefault);
    setManualStatus(PointStatus.PLANNING);
    setManualCategoryIds([]);
    setManualError(null);
    setEditingPointId(null);
  }, []);

  const closeManualAdd = useCallback(() => {
    setShowManualAdd(false);
    resetManualForm();
  }, [resetManualForm]);

  const openManualAdd = useCallback(() => {
    blurActiveElementForModal();
    setShowActions(false);
    resetManualForm();
    setShowManualAdd(true);
  }, [blurActiveElementForModal, resetManualForm, setShowActions]);

  const syncCoordsFromInputs = useCallback((nextLatStr: string, nextLngStr: string) => {
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
  }, []);

  const openEditPoint = useCallback(
    (point: unknown) => {
      const item = (point ?? {}) as PointLike;
      if (!item) return;

      const id = Number(item.id);
      if (!Number.isFinite(id)) {
        setManualError(i18nT('map:components.UserPoints.usePointsManualForm.nevozmozhno_otkryt_tochku_nekorrektnyy_ident_0257c8ac'));
        return;
      }

      blurActiveElementForModal();
      setShowActions(false);
      resetManualForm();

      setEditingPointId(id);
      setManualName(String(item.name ?? ''));
      setManualNameTouched(true);
      setManualAutoName('');
      setManualAddress(String(item.address ?? ''));

      const lat = Number(item.latitude);
      const lng = Number(item.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setManualCoords({ lat, lng });
        setManualLat(String(lat));
        setManualLng(String(lng));
      } else {
        setManualCoords(null);
        setManualLat('');
        setManualLng('');
      }

      setManualColor(String(item.color ?? DESIGN_COLORS.userPointDefault));
      const nextStatus = (item.status ?? PointStatus.PLANNING) as PointStatus;
      setManualStatus(nextStatus);
      setManualCategoryIds(resolveCategoryIdsForEdit(item));
      setManualError(null);
      setShowManualAdd(true);
    },
    [blurActiveElementForModal, resetManualForm, resolveCategoryIdsForEdit, setShowActions]
  );

  const handleMapPress = useCallback(
    (coords: Coords) => {
      if (
        !Number.isFinite(coords.lat) ||
        !Number.isFinite(coords.lng) ||
        coords.lat < -90 ||
        coords.lat > 90 ||
        coords.lng < -180 ||
        coords.lng > 180
      ) {
        return;
      }

      blurActiveElementForModal();
      setShowActions(false);
      resetManualForm();
      setManualCoords(coords);
      setManualLat(coords.lat.toFixed(6));
      setManualLng(coords.lng.toFixed(6));
      setManualName(i18nT('map:components.UserPoints.usePointsManualForm.novaya_tochka_4d3f685d'));
      setShowManualAdd(true);

      const reqId = ++geocodeSeq.current;

      void (async () => {
        const geocodeData = await reverseGeocode(coords.lat, coords.lng);
        if (reqId !== geocodeSeq.current) return;
        if (!geocodeData) return;

        const addr = buildAddressFromGeocode(geocodeData, { lat: coords.lat, lng: coords.lng });
        setManualAddress(String(addr || '').trim());

        const primaryName = getPrimaryPlaceName(geocodeData, coords.lat, coords.lng);
        setManualAutoName(primaryName);

        if (!manualNameTouchedRef.current) {
          setManualName(primaryName);
        }
      })();
    },
    [blurActiveElementForModal, resetManualForm, setShowActions]
  );

  const handleSaveManual = useCallback(async () => {
    setManualError(null);
    const name = manualName.trim();
    if (!name) {
      setManualError(i18nT('map:components.UserPoints.usePointsManualForm.vvedite_nazvanie_tochki_28d3eba6'));
      return;
    }
    if (!manualCoords) {
      setManualError(i18nT('map:components.UserPoints.usePointsManualForm.ukazhite_koordinaty_69d8e5dc'));
      return;
    }
    if ((manualCategoryIds || []).length === 0) {
      setManualError(i18nT('map:components.UserPoints.usePointsManualForm.vyberite_kategoriyu_7b566566'));
      return;
    }

    setIsSavingManual(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        address: manualAddress || undefined,
        latitude: manualCoords.lat,
        longitude: manualCoords.lng,
        color: manualColor,
        categoryIds: manualCategoryIds,
        status: manualStatus,
      };

      if (editingPointId != null) {
        const updated = await userPointsApi.updatePoint(editingPointId, payload);
        queryClient.setQueryData(queryKeys.userPointsAll(), (prev: unknown) => {
          const arr = Array.isArray(prev) ? prev : [];
          return arr.map((p: unknown) => {
            const item = (p ?? {}) as Record<string, unknown>;
            return Number(item.id) === Number(editingPointId) ? updated : item;
          });
        });
      } else {
        const created = await userPointsApi.createPoint(payload);
        queryClient.setQueryData(queryKeys.userPointsAll(), (prev: unknown) => {
          const arr = Array.isArray(prev) ? prev : [];
          return [created, ...arr];
        });
      }

      closeManualAdd();
    } catch (error) {
      setManualError(error instanceof Error ? error.message : i18nT('map:components.UserPoints.usePointsManualForm.ne_udalos_sohranit_tochku_ce20a696'));
    } finally {
      setIsSavingManual(false);
    }
  }, [
    closeManualAdd,
    editingPointId,
    manualAddress,
    manualCategoryIds,
    manualColor,
    manualCoords,
    manualName,
    manualStatus,
    queryClient,
  ]);

  return {
    editingPointId,
    showManualAdd,
    manualName,
    setManualName,
    manualNameTouched,
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
  };
};
