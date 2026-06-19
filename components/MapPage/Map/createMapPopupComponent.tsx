import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import PlacePopupCard from './PlacePopupCard';
import type { Point } from './types';
import { buildGoogleMapsUrl, buildOrganicMapsUrl, buildTelegramShareUrl, buildWazeUrl, buildYandexNaviUrl } from './mapLinks';
import { showToast } from '@/utils/toast';
import { userPointsApi } from '@/api/userPoints';
import { PointStatus } from '@/types/userPoints';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { getSiteBaseUrl } from '@/utils/seo';
import { useAuthStore } from '@/stores/authStore';
import { useRouteStore } from '@/stores/routeStore';
import { ThemeContext, type ThemeContextType, type ThemedColors } from '@/hooks/useTheme';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { osrmRoute } from '@/api/external/osrm';
import { buildPlaceTitleParts, stripCountryFromCategoryString } from './placeTitle';

interface CreatePopupComponentArgs {
  userLocation?: { lat: number; lng: number } | null;
  /**
   * Optional ref-based userLocation source. When provided, PopupComponent reads
   * the live value from the ref on each render so that the parent can update
   * GPS coordinates without recreating the component factory. This keeps the
   * PopupComponent identity stable across GPS updates and avoids unmount/remount
   * which would reset internal state (e.g. fullscreen image viewer visibility).
   */
  userLocationRef?: React.MutableRefObject<{ lat: number; lng: number } | null | undefined>;
  compactLayout?: boolean;
  fullscreenOnMobile?: boolean;
  /** Web mobile bottom-sheet split: fixed hero photo + scrollable caption/actions. */
  bottomSheetSplit?: boolean;
  /** Web desktop popup split: fixed natural-height hero photo + scrollable body. */
  popupSplit?: boolean;
  invalidateUserPoints?: () => void;
  colors: ThemedColors;
  themeContextValue: ThemeContextType;
}

export const createMapPopupComponent = ({
  userLocation,
  userLocationRef,
  compactLayout = false,
  fullscreenOnMobile = false,
  bottomSheetSplit = false,
  popupSplit = false,
  invalidateUserPoints,
  colors,
  themeContextValue,
}: CreatePopupComponentArgs) => {
  const PopupComponent: React.FC<{ point: Point; closePopup?: () => void }> = ({ point, closePopup }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [isDrivingLoading, setIsDrivingLoading] = useState(false);
    const [drivingDistanceMeters, setDrivingDistanceMeters] = useState<number | null>(null);
    const [drivingDurationSeconds, setDrivingDurationSeconds] = useState<number | null>(null);
    const coord = String(point.coord ?? '').trim();
    const pointRecord = point as unknown as Record<string, unknown>
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const authReady = useAuthStore((s) => s.authReady);

    // Prefer the live ref value when provided (ref keeps the factory identity
    // stable across GPS updates); fall back to the static closure value.
    const liveUserLocation = userLocationRef?.current ?? userLocation;
    const userLat = liveUserLocation?.lat;
    const userLng = liveUserLocation?.lng;

    const lastDriveKeyRef = useRef<string | null>(null);
    const abortDriveRef = useRef<AbortController | null>(null);

    const handlePress = useCallback(() => {
      closePopup?.();
    }, [closePopup]);

    const handleOpenArticle = useCallback(() => {
      const url = String(point.articleUrl || point.urlTravel || '').trim();
      if (!url) return;
      void openExternalUrlInNewTab(url, {
        allowRelative: true,
        baseUrl: getSiteBaseUrl(),
      });
    }, [point.articleUrl, point.urlTravel]);

    const articleHref = useMemo(() => {
      const rawUrl = String(point.articleUrl || point.urlTravel || '').trim();
      if (!rawUrl) return null;
      return rawUrl;
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

    const handleShareTelegram = useCallback(() => {
      if (!coord) return;
      const telegramUrl = buildTelegramShareUrl(coord);
      if (!telegramUrl) return;
      void openExternalUrlInNewTab(telegramUrl);
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

    const normalizedCoord = useMemo(() => {
      if (!coord) return null;
      const parts = coord.replace(/;/g, ',').split(',').map((v) => v.trim());
      if (parts.length < 2) return null;
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    }, [coord]);

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
          const res = await osrmRoute(
            {
              coords: [
                [Number(uLng.toFixed(6)), Number(uLat.toFixed(6))],
                [Number(normalizedCoord.lng.toFixed(6)), Number(normalizedCoord.lat.toFixed(6))],
              ],
            },
            { signal: abortController.signal },
          );
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

    const rawCategoryName = useMemo(() => {
      if (Array.isArray(point.categoryName)) return point.categoryName.join(', ');
      if (typeof point.categoryName === 'object' && point.categoryName !== null) {
        return String((point.categoryName as any).name ?? '');
      }
      return String(point.categoryName ?? '').trim();
    }, [point.categoryName]);

    const categoryLabel = useMemo(
      () => stripCountryFromCategoryString(rawCategoryName, point.address),
      [rawCategoryName, point.address],
    );
    const popupTitle = useMemo(() => buildPlaceTitleParts(point), [point]);
    const canBuildRoute = normalizedCoord != null && typeof userLat === 'number' && typeof userLng === 'number';

    const handleBuildRoute = useCallback(() => {
      if (!normalizedCoord || typeof userLat !== 'number' || typeof userLng !== 'number') return;

      const routeStore = useRouteStore.getState();
      const destinationLabel = String(point.address ?? popupTitle.title ?? '').trim() ||
        CoordinateConverter.formatCoordinates({ lat: normalizedCoord.lat, lng: normalizedCoord.lng });

      routeStore.clearRouteAndSetMode('route');
      routeStore.addPoint({ lat: userLat, lng: userLng }, 'Моё местоположение');
      routeStore.addPoint({ lat: normalizedCoord.lat, lng: normalizedCoord.lng }, destinationLabel);
      handlePress();
    }, [handlePress, normalizedCoord, point.address, popupTitle.title, userLat, userLng]);

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

      const payload: Partial<{ [key: string]: any }> = {
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
        (point as any)?.travelImageThumbUrl ??
        (point as any)?.travel_image_thumb_url ??
        (point as any)?.image;
      if (typeof photoCandidate === 'string' && photoCandidate.trim()) {
        payload.photo = photoCandidate.trim();
      }
      if (point.categoryId || point.category_ids) {
        const ids = [
          point.categoryId,
          ...(Array.isArray(point.category_ids) ? point.category_ids : []),
        ]
          .filter(Boolean)
          .map((v) => String(v));
        if (ids.length > 0) {
          payload.categoryIds = ids;
        }
      }

      setIsAdding(true);
      try {
        await userPointsApi.createPoint(payload);
        void showToast({ type: 'success', text1: 'Точка добавлена в мои точки', position: 'bottom' });
        invalidateUserPoints?.();
        handlePress();
      } catch {
        void showToast({ type: 'error', text1: 'Не удалось сохранить точку', position: 'bottom' });
      } finally {
        setIsAdding(false);
      }
    }, [
      authReady,
      isAuthenticated,
      isAdding,
      categoryLabel,
      normalizedCoord,
      point,
      handlePress,
    ]);

    const questMeta = point.questMeta;
    const isQuest = !!questMeta;

    const questSubtitle = useMemo(() => {
      if (!questMeta) return undefined;
      const stepCount = typeof questMeta.points === 'number' ? questMeta.points : 0;
      const stepWord = stepCount === 1 ? 'шаг' : stepCount >= 2 && stepCount <= 4 ? 'шага' : 'шагов';
      const difficultyLabel =
        questMeta.difficulty === 'easy'
          ? 'лёгкий'
          : questMeta.difficulty === 'medium'
            ? 'средний'
            : questMeta.difficulty === 'hard'
              ? 'сложный'
              : null;
      const parts = [
        [questMeta.cityName, questMeta.countryName].filter(Boolean).join(', ') || null,
        questMeta.durationMin ? `${questMeta.durationMin} мин` : null,
        stepCount > 0 ? `${stepCount} ${stepWord}` : null,
        difficultyLabel,
      ].filter(Boolean);
      return parts.length ? parts.join(' · ') : undefined;
    }, [questMeta]);

    const handleStartQuest = useCallback(() => {
      if (!questMeta) return;
      const cityId = String(questMeta.cityId ?? '').trim();
      const id = String(questMeta.id ?? '').trim();
      if (!cityId || !id) {
        void showToast({ type: 'error', text1: 'Не удалось открыть квест', position: 'bottom' });
        return;
      }
      handlePress();
      router.push(
        `/quests/${encodeURIComponent(cityId)}/${encodeURIComponent(id)}` as any,
      );
    }, [handlePress, questMeta]);

    return (
      <ThemeContext.Provider value={themeContextValue}>
        <PlacePopupCard
          colors={colors}
          title={isQuest ? questMeta!.title : popupTitle.title}
          subtitle={isQuest ? questSubtitle : popupTitle.subtitle}
          imageUrl={isQuest ? questMeta!.cover : point.imageUrl || point.travelImageThumbUrl}
          articleHref={isQuest ? null : articleHref}
          relatedTravelUrl={isQuest ? null : point.urlTravel}
          relatedTravelCountry={!isQuest && typeof pointRecord.countryName === 'string'
            ? String(pointRecord.countryName)
            : null}
          relatedTravelCity={!isQuest && typeof pointRecord.cityName === 'string'
            ? String(pointRecord.cityName)
            : null}
          categoryLabel={isQuest ? null : categoryLabel}
          coord={isQuest ? null : coord}
          drivingDistanceMeters={isQuest ? null : drivingDistanceMeters}
          drivingDurationSeconds={isQuest ? null : drivingDurationSeconds}
          isDrivingLoading={isQuest ? false : isDrivingLoading}
          onOpenArticle={isQuest ? undefined : handleOpenArticle}
          onCopyCoord={isQuest ? undefined : handleCopyCoord}
          onShareTelegram={isQuest ? undefined : handleShareTelegram}
          onOpenGoogleMaps={isQuest ? undefined : handleOpenGoogleMaps}
          onOpenOrganicMaps={isQuest ? undefined : handleOpenOrganicMaps}
          onOpenWaze={isQuest ? undefined : handleOpenWaze}
          onOpenYandexNavi={isQuest ? undefined : handleOpenYandexNavi}
          onAddPoint={isQuest ? undefined : handleAddPoint}
          onBuildRoute={isQuest || !canBuildRoute ? undefined : handleBuildRoute}
          primaryActionOverride={
            isQuest
              ? {
                  label: 'Начать квест',
                  icon: 'play',
                  onPress: handleStartQuest,
                  accessibilityLabel: 'Начать квест',
                  tooltip: 'Перейти к прохождению квеста',
                }
              : undefined
          }
          addDisabled={!authReady || !normalizedCoord || isAdding}
          addTooltip={
            !authReady
              ? 'Загрузка…'
              : !isAuthenticated
                ? 'Войдите, чтобы сохранить точку'
                : !normalizedCoord
                  ? 'Координаты точки недоступны'
                  : 'Сохранить в мои точки'
          }
          isAdding={isAdding}
          compactLayout={compactLayout}
          fullscreenOnMobile={fullscreenOnMobile}
          bottomSheetSplit={bottomSheetSplit}
          popupSplit={popupSplit}
          onClose={handlePress}
        />
      </ThemeContext.Provider>
    );
  };

  return PopupComponent;
};
