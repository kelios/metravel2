// components/map-core/MapPopup.tsx
// C2.2: Unified popup component used by both map stacks
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlacePopupCard from '@/components/MapPage/Map/PlacePopupCard';
import { buildGoogleMapsUrl, buildOrganicMapsUrl, buildTelegramShareUrl, buildWazeUrl, buildYandexNaviUrl } from '@/components/MapPage/Map/mapLinks';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/utils/toast';
import { userPointsApi } from '@/api/userPoints';
import { useQueryClient } from '@tanstack/react-query';
import { PointStatus } from '@/types/userPoints';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { getSiteBaseUrl } from '@/utils/seo';
import type { LegacyMapPoint } from './types';
import { useThemedColors } from '@/hooks/useTheme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getCountryFromAddress = (address?: string | null) => {
  const addr = String(address ?? '').trim();
  if (!addr) return '';
  return (
    addr
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(-1)[0] ?? ''
  );
};

const stripCountryFromCategoryString = (raw: unknown, address?: string | null) => {
  const category = String(raw ?? '').trim();
  if (!category) return '';
  const countryCandidate = getCountryFromAddress(address);
  if (!countryCandidate) return category;
  const filtered = category
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => p.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0);
  return filtered.join(', ');
};

const parseCoord = (coord: string) => {
  if (!coord) return null;
  const parts = coord.replace(/;/g, ',').split(',').map((v) => v.trim());
  if (parts.length < 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MapPopupConfig {
  /** Point data */
  point: LegacyMapPoint;
  /** Called when popup should close (e.g. map.closePopup()) */
  onClose?: () => void;
  /** User's current location for driving distance calculation (MapPage only) */
  userLocation?: { lat: number; lng: number } | null;
  /**
   * Extra category resolution for travel detail map.
   * Returns resolved category IDs from the site dictionary.
   */
  resolveCategoryInfo?: (point: LegacyMapPoint) => {
    categoryLabel: string;
    categoryIds: string[];
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MapPopup: React.FC<MapPopupConfig> = ({
  point,
  onClose,
  userLocation,
  resolveCategoryInfo,
}) => {
  const colors = useThemedColors();
  const [isAdding, setIsAdding] = useState(false);
  const [isDrivingLoading, setIsDrivingLoading] = useState(false);
  const [drivingDistanceMeters, setDrivingDistanceMeters] = useState<number | null>(null);
  const [drivingDurationSeconds, setDrivingDurationSeconds] = useState<number | null>(null);

  const coord = String(point.coord ?? '').trim();
  const { isAuthenticated, authReady } = useAuth();
  const queryClient = useQueryClient();

  const normalizedCoord = useMemo(() => parseCoord(coord), [coord]);

  // ---------------------------------------------------------------------------
  // Category label
  // ---------------------------------------------------------------------------

  const { categoryLabel, categoryIds: resolvedIds } = useMemo(() => {
    if (resolveCategoryInfo) {
      return resolveCategoryInfo(point);
    }
    // Fallback: simple categoryName extraction (used by MapPage)
    let rawCategoryName: string;
    if (Array.isArray(point.categoryName)) {
      rawCategoryName = (point.categoryName as string[]).join(', ');
    } else if (typeof point.categoryName === 'object' && point.categoryName !== null) {
      rawCategoryName = String((point.categoryName as { name?: string }).name ?? '');
    } else {
      rawCategoryName = String(point.categoryName ?? '').trim();
    }
    return {
      categoryLabel: stripCountryFromCategoryString(rawCategoryName, point.address),
      categoryIds: [] as string[],
    };
  }, [point, resolveCategoryInfo]);

  // ---------------------------------------------------------------------------
  // Driving distance (only when userLocation is provided)
  // ---------------------------------------------------------------------------

  const userLat = userLocation?.lat;
  const userLng = userLocation?.lng;
  const lastDriveKeyRef = useRef<string | null>(null);
  const abortDriveRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!normalizedCoord) return;
    const uLat = typeof userLat === 'number' ? userLat : null;
    const uLng = typeof userLng === 'number' ? userLng : null;
    if (uLat === null || uLng === null) return;

    const driveKey = `${uLat.toFixed(6)},${uLng.toFixed(6)}->${normalizedCoord.lat.toFixed(6)},${normalizedCoord.lng.toFixed(6)}`;
    if (lastDriveKeyRef.current === driveKey) return;
    lastDriveKeyRef.current = driveKey;

    abortDriveRef.current?.abort();
    const abortController = new AbortController();
    abortDriveRef.current = abortController;

    setIsDrivingLoading(true);
    setDrivingDistanceMeters(null);
    setDrivingDurationSeconds(null);

    const fetchDrive = async () => {
      try {
        const coordsStr = `${uLng.toFixed(6)},${uLat.toFixed(6)};${normalizedCoord.lng.toFixed(6)},${normalizedCoord.lat.toFixed(6)}`;
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=false`;
        const res = await fetch(url, { signal: abortController.signal });
        if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
        const data = await res.json();
        const route = data?.routes?.[0];
        const dist = Number(route?.distance);
        const dur = Number(route?.duration);
        if (!Number.isFinite(dist) || !Number.isFinite(dur)) throw new Error('Invalid OSRM payload');
        setDrivingDistanceMeters(dist);
        setDrivingDurationSeconds(dur);
      } catch {
        // noop
      } finally {
        if (!abortController.signal.aborted) {
          setIsDrivingLoading(false);
        }
      }
    };

    void fetchDrive();

    return () => {
      abortController.abort();
    };
  }, [normalizedCoord, userLat, userLng]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleOpenArticle = useCallback(() => {
    const url = String(point.articleUrl || point.urlTravel || '').trim();
    if (!url) return;
    void openExternalUrlInNewTab(url, {
      allowRelative: true,
      baseUrl: getSiteBaseUrl(),
    });
  }, [point.articleUrl, point.urlTravel]);

  const handleCopyCoord = useCallback(async () => {
    if (!coord) return;
    try {
      if ((navigator as any)?.clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(coord);
      }
    } catch {
      // noop
    }
  }, [coord]);

  const handleOpenGoogleMaps = useCallback(() => {
    if (!coord) return;
    const url = buildGoogleMapsUrl(coord);
    if (!url) return;
    void openExternalUrlInNewTab(url);
  }, [coord]);

  const handleOpenOrganicMaps = useCallback(() => {
    if (!coord) return;
    const url = buildOrganicMapsUrl(coord);
    if (!url) return;
    void openExternalUrlInNewTab(url);
  }, [coord]);

  const handleOpenWaze = useCallback(() => {
    if (!coord) return;
    const url = buildWazeUrl(coord);
    if (!url) return;
    void openExternalUrlInNewTab(url);
  }, [coord]);

  const handleOpenYandexNavi = useCallback(() => {
    if (!coord) return;
    const url = buildYandexNaviUrl(coord);
    if (!url) return;
    void openExternalUrlInNewTab(url);
  }, [coord]);

  const handleShareTelegram = useCallback(() => {
    if (!coord) return;
    const telegramUrl = buildTelegramShareUrl(coord);
    if (!telegramUrl) return;
    void openExternalUrlInNewTab(telegramUrl);
  }, [coord]);

  const handleAddPoint = useCallback(async () => {
    if (!authReady) return;
    if (!isAuthenticated) {
      void showToast({ type: 'info', text1: 'Войдите, чтобы сохранить точку', position: 'bottom' });
      return;
    }
    if (isAdding) return;
    if (!normalizedCoord) {
      void showToast({ type: 'info', text1: 'Не удалось распознать координаты', position: 'bottom' });
      return;
    }

    const categoryNameString = categoryLabel || undefined;
    const payload: Record<string, unknown> = {
      name: point.address || 'Точка маршрута',
      address: point.address,
      latitude: normalizedCoord.lat,
      longitude: normalizedCoord.lng,
      color: DESIGN_COLORS.travelPoint,
      status: PointStatus.PLANNING,
      category: categoryNameString,
      categoryName: categoryNameString,
    };

    const photoCandidate =
      (point as unknown as Record<string, unknown>)?.travelImageThumbUrl ??
      (point as unknown as Record<string, unknown>)?.travel_image_thumb_url ??
      (point as unknown as Record<string, unknown>)?.image;
    if (typeof photoCandidate === 'string' && photoCandidate.trim()) {
      payload.photo = photoCandidate.trim();
    }

    // Category IDs: prefer resolved IDs (from travel detail dictionary), fallback to point's own
    const idsFromResolve = resolvedIds;
    const idsFromPoint = [
      point.categoryId,
      ...(Array.isArray(point.category_ids) ? point.category_ids : []),
    ].filter(Boolean).map((v) => String(v));
    const combinedIds = Array.from(new Set([...idsFromResolve, ...idsFromPoint]));
    if (combinedIds.length > 0) {
      payload.categoryIds = combinedIds;
    }

    const tags: Record<string, unknown> = {};
    if (point.urlTravel) tags.travelUrl = point.urlTravel;
    if (point.articleUrl) tags.articleUrl = point.articleUrl;
    if (Object.keys(tags).length > 0) payload.tags = tags;

    setIsAdding(true);
    try {
      await userPointsApi.createPoint(payload);
      void showToast({ type: 'success', text1: 'Точка добавлена в «Мои точки»', position: 'bottom' });
      void queryClient.invalidateQueries({ queryKey: ['userPointsAll'] });
      handleClose();
    } catch {
      void showToast({ type: 'error', text1: 'Не удалось сохранить точку', position: 'bottom' });
    } finally {
      setIsAdding(false);
    }
  }, [
    authReady,
    categoryLabel,
    handleClose,
    isAdding,
    isAuthenticated,
    normalizedCoord,
    point,
    queryClient,
    resolvedIds,
  ]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PlacePopupCard
      colors={colors}
      title={point.address || ''}
      imageUrl={point.imageUrl || point.travelImageThumbUrl}
      categoryLabel={categoryLabel}
      coord={coord}
      drivingDistanceMeters={drivingDistanceMeters}
      drivingDurationSeconds={drivingDurationSeconds}
      isDrivingLoading={isDrivingLoading}
      onOpenArticle={handleOpenArticle}
      onCopyCoord={handleCopyCoord}
      onShareTelegram={handleShareTelegram}
      onOpenGoogleMaps={handleOpenGoogleMaps}
      onOpenOrganicMaps={handleOpenOrganicMaps}
      onOpenWaze={handleOpenWaze}
      onOpenYandexNavi={handleOpenYandexNavi}
      onAddPoint={handleAddPoint}
      addDisabled={!authReady || !isAuthenticated || !normalizedCoord || isAdding}
      isAdding={isAdding}
      fullscreenOnMobile
      onClose={handleClose}
    />
  );
};

export default React.memo(MapPopup);
