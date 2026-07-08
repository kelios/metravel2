import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import PlacePopupCard from './PlacePopupCard';
import { isInternalArticleHref } from './PlacePopupCard/domEvents';
import type { Point } from './types';
import {
  buildAppleMapsUrl,
  buildGoogleMapsUrl,
  buildOpenStreetMapUrl,
  buildOrganicMapsUrl,
  buildTelegramShareUrl,
  buildWazeUrl,
  buildYandexMapsUrl,
  buildYandexNaviUrl,
} from './mapLinks';
import { showToast } from '@/utils/toast';
import { PointStatus } from '@/types/userPoints';
import { useSavedPointToggle } from '@/hooks/map/useSavedPointToggle';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { getSiteBaseUrl } from '@/utils/seo';
import { useAuthStore } from '@/stores/authStore';
import { useRouteStore } from '@/stores/routeStore';
import { ThemeContext, type ThemeContextType, type ThemedColors } from '@/hooks/useTheme';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { osrmRoute } from '@/api/external/osrm';
import { buildPlaceTitleParts, stripCountryFromCategoryString } from './placeTitle';
import { useHasUserLocation, type UserLocationSignal } from './userLocationSignal';

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
  /**
   * Subscribe-able location signal. Carries the SAME live coordinates as
   * `userLocationRef` (precise coords still read via `.current` at route-build
   * time, no per-tick render), plus a coarse `hasLocation()` boolean the popup
   * subscribes to. That boolean flips exactly once on the first fix (null→present),
   * which is what makes the «Маршрут» button + distance chip appear immediately —
   * without a re-render storm on every subsequent GPS update. Supersedes
   * `userLocationRef` when provided.
   */
  userLocationSignal?: UserLocationSignal;
  compactLayout?: boolean;
  fullscreenOnMobile?: boolean;
  /** Web mobile bottom-sheet split: fixed hero photo + scrollable caption/actions. */
  bottomSheetSplit?: boolean;
  /** Web desktop popup split: fixed natural-height hero photo + scrollable body. */
  popupSplit?: boolean;
  /**
   * Suppress the card's own top-right ✕. Set by wrappers that draw their own close
   * (e.g. `MapPlaceBottomCard`'s sheet header ✕) so the corner isn't doubled up.
   */
  suppressInlineClose?: boolean;
  /** Native bottom-card hero height, computed from visible app content height. */
  bottomCardImageHeight?: number;
  /**
   * #FIX-3 — surface «Поделиться в Telegram» as the title-row share icon instead of
   * inside the navigation sheet. Set by the native bottom card so Telegram (a share,
   * not a map-app) leaves the «Навигация и действия» list.
   */
  shareInActionRow?: boolean;
  fullscreenTopInset?: number;
  fullscreenBottomInset?: number;
  invalidateUserPoints?: () => void;
  colors: ThemedColors;
  themeContextValue: ThemeContextType;
}

export const createMapPopupComponent = ({
  userLocation,
  userLocationRef,
  userLocationSignal,
  compactLayout = false,
  fullscreenOnMobile = false,
  bottomSheetSplit = false,
  popupSplit = false,
  suppressInlineClose = false,
  bottomCardImageHeight,
  shareInActionRow = false,
  fullscreenTopInset = 0,
  fullscreenBottomInset = 0,
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

    // Subscribe to the coarse «есть ли локация» boolean so the popup re-renders
    // exactly once when the first fix arrives (null→present) — this is what makes
    // «Маршрут» + distance chip appear without any external state update. Precise
    // coordinates are still read from the signal/ref on each render (and at
    // route-build time), so frequent GPS ticks never re-render the popup.
    const hasLiveLocation = useHasUserLocation(userLocationSignal);

    // Prefer the live signal/ref value when provided (both keep the factory
    // identity stable across GPS updates); fall back to the static closure value.
    const liveUserLocation =
      userLocationSignal?.current ?? userLocationRef?.current ?? userLocation;
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
      const baseUrl = getSiteBaseUrl();

      // #501 — на native внутренние travel/article-маршруты открываем нативным
      // экраном (router.push), а не внешним Chrome. Внешние URL и web —
      // прежнее поведение (openExternalUrlInNewTab).
      if (Platform.OS !== 'web') {
        const baseHost = baseUrl.replace(/^https?:\/\//i, '').split('/')[0];
        let path: string | null = null;
        const abs = url.match(/^https?:\/\/([^/]+)(\/.*)?$/i);
        if (abs) {
          if (abs[1] === baseHost) path = abs[2] || '/';
        } else if (url.startsWith('/')) {
          path = url;
        }
        if (path && isInternalArticleHref(path.split('?')[0])) {
          handlePress();
          router.push(path as any);
          return;
        }
      }

      void openExternalUrlInNewTab(url, {
        allowRelative: true,
        baseUrl,
      });
    }, [point.articleUrl, point.urlTravel, handlePress]);

    const articleHref = useMemo(() => {
      const rawUrl = String(point.articleUrl || point.urlTravel || '').trim();
      if (!rawUrl) return null;
      return rawUrl;
    }, [point.articleUrl, point.urlTravel]);

    const handleCopyCoord = useCallback(async () => {
      if (!coord) return;
      // expo-clipboard работает кросс-платформенно (web + native). На native
      // navigator.clipboard отсутствовал → копирование было silent no-op (#502).
      try {
        await Clipboard.setStringAsync(coord);
        void showToast({ type: 'success', text1: 'Координаты скопированы', position: 'bottom' });
      } catch {
        void showToast({ type: 'error', text1: 'Не удалось скопировать координаты', position: 'bottom' });
      }
    }, [coord]);

    const handleOpenGoogleMaps = useCallback(() => {
      if (!coord) return;
      const url = buildGoogleMapsUrl(coord);
      if (!url) return;
      void openExternalUrlInNewTab(url);
    }, [coord]);

    const handleOpenAppleMaps = useCallback(() => {
      if (!coord) return;
      const url = buildAppleMapsUrl(coord);
      if (!url) return;
      void openExternalUrlInNewTab(url);
    }, [coord]);

    const handleOpenOrganicMaps = useCallback(() => {
      if (!coord) return;
      const url = buildOrganicMapsUrl(coord, point.address);
      if (!url) return;
      void openExternalUrlInNewTab(url);
    }, [coord, point.address]);

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

    const handleOpenYandexMaps = useCallback(() => {
      if (!coord) return;
      const url = buildYandexMapsUrl(coord);
      if (!url) return;
      void openExternalUrlInNewTab(url);
    }, [coord]);

    const handleOpenOpenStreetMap = useCallback(() => {
      if (!coord) return;
      const url = buildOpenStreetMapUrl(coord);
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

    // #334 — saved-state for the «Сохранить место» button. Reads the user's
    // collection (shared `userPointsAll` cache) and matches by coordinates so the
    // button shows «Сохранено» and a second tap removes the point (toggle).
    const { isSaved, removeSaved, createPoint } = useSavedPointToggle({
      coord: normalizedCoord,
      enabled: isAuthenticated,
    });

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

      // Defer the driving-distance work off the popup's first paint frame: the
      // loading-state churn + network kickoff run at idle so opening the card is
      // instant. The distance still renders when the response arrives.
      const startDrive = () => {
        if (abortController.signal.aborted) return;
        setIsDrivingLoading(true);
        setDrivingDistanceMeters(null);
        setDrivingDurationSeconds(null);
        void fetchDrive();
      };

      const w = typeof window !== 'undefined' ? (window as any) : null;
      let idleHandle: number | null = null;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      if (w && typeof w.requestIdleCallback === 'function') {
        idleHandle = w.requestIdleCallback(startDrive, { timeout: 400 });
      } else {
        timeoutHandle = setTimeout(startDrive, 0);
      }

      return () => {
        abortController.abort();
        if (idleHandle != null && w && typeof w.cancelIdleCallback === 'function') {
          w.cancelIdleCallback(idleHandle);
        }
        if (timeoutHandle != null) clearTimeout(timeoutHandle);
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
    // Gate on the reactive `hasLiveLocation` (flips once on the first fix) so the
    // button appears immediately when GPS arrives. When a signal is provided its
    // boolean is the source of truth; otherwise fall back to the raw coords read
    // (ref/closure path used by the native legacy caller). handleBuildRoute
    // re-validates finite coords from the ref before actually building the route.
    const hasUserLocation = userLocationSignal
      ? hasLiveLocation
      : typeof userLat === 'number' && typeof userLng === 'number';
    const canBuildRoute = normalizedCoord != null && hasUserLocation;

    const handleBuildRoute = useCallback(() => {
      if (
        !normalizedCoord ||
        typeof userLat !== 'number' ||
        typeof userLng !== 'number' ||
        !Number.isFinite(userLat) ||
        !Number.isFinite(userLng)
      ) {
        return;
      }

      // If the user is essentially standing on the destination, RouteValidator rejects
      // the 2nd point (< MIN_DISTANCE) and the store would be left in mode='route' with a
      // single point — route-capture active but no line drawn, trapping marker taps with
      // no escape. Bail with a hint instead of entering that half-built state.
      const originToDest = CoordinateConverter.distance(
        { lat: userLat, lng: userLng },
        { lat: normalizedCoord.lat, lng: normalizedCoord.lng },
      );
      if (!Number.isFinite(originToDest) || originToDest < 100) {
        void showToast({ type: 'info', text1: 'Вы уже на месте', position: 'bottom' });
        return;
      }

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

      // #334 — toggle: если точка уже в коллекции пользователя, второй тап её
      // убирает (un-save), а не плодит дубль.
      if (isSaved) {
        setIsAdding(true);
        try {
          await removeSaved();
          void showToast({ type: 'success', text1: 'Точка убрана из моих точек', position: 'bottom' });
          invalidateUserPoints?.();
        } catch {
          void showToast({ type: 'error', text1: 'Не удалось убрать точку', position: 'bottom' });
        } finally {
          setIsAdding(false);
        }
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
        await createPoint(payload);
        void showToast({ type: 'success', text1: 'Точка добавлена в мои точки', position: 'bottom' });
        invalidateUserPoints?.();
        // Не закрываем попап: пользователь должен увидеть, что кнопка стала
        // «Сохранено», чтобы понять про un-save (toggle, #334).
      } catch {
        void showToast({ type: 'error', text1: 'Не удалось сохранить точку', position: 'bottom' });
      } finally {
        setIsAdding(false);
      }
    }, [
      authReady,
      isAuthenticated,
      isAdding,
      isSaved,
      removeSaved,
      createPoint,
      categoryLabel,
      normalizedCoord,
      point,
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
          onOpenAppleMaps={isQuest ? undefined : handleOpenAppleMaps}
          onOpenOrganicMaps={isQuest ? undefined : handleOpenOrganicMaps}
          onOpenWaze={isQuest ? undefined : handleOpenWaze}
          onOpenYandexMaps={isQuest ? undefined : handleOpenYandexMaps}
          onOpenYandexNavi={isQuest ? undefined : handleOpenYandexNavi}
          onOpenOpenStreetMap={isQuest ? undefined : handleOpenOpenStreetMap}
          onAddPoint={isQuest ? undefined : handleAddPoint}
          onBuildRoute={isQuest || !canBuildRoute ? undefined : handleBuildRoute}
          shareInActionRow={isQuest ? false : shareInActionRow}
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
          isSaved={isQuest ? false : isSaved}
          addLabel={!isQuest && isSaved ? 'В точках' : 'Мои точки'}
          addTooltip={
            !authReady
              ? 'Загрузка…'
              : !isAuthenticated
                ? 'Войдите, чтобы сохранить точку'
                : !normalizedCoord
                  ? 'Координаты точки недоступны'
                  : isSaved
                    ? 'Убрать из моих точек'
                    : 'Сохранить в мои точки'
          }
          isAdding={isAdding}
          compactLayout={compactLayout}
          fullscreenOnMobile={fullscreenOnMobile}
          imageHeight={bottomCardImageHeight}
          bottomSheetSplit={bottomSheetSplit}
          popupSplit={popupSplit}
          suppressInlineClose={suppressInlineClose}
          fullscreenTopInset={fullscreenTopInset}
          fullscreenBottomInset={fullscreenBottomInset}
          onClose={handlePress}
        />
      </ThemeContext.Provider>
    );
  };

  return PopupComponent;
};
