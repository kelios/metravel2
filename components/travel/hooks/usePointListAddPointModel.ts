import { useCallback, useState } from 'react';
import * as ReactQuery from '@tanstack/react-query';

import { userPointsApi } from '@/api/userPoints';
import { queryKeys } from '@/api/queryKeys';
import { markPointsCollectionComplete } from '@/api/userPointsCollectionCache';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { useAuth } from '@/context/AuthContext';
import type { ImportedPoint } from '@/types/userPoints';
import { PointStatus } from '@/types/userPoints';
import { showToast } from '@/utils/toast';
import { queueAnalyticsEvent } from '@/utils/analytics';
import { resolveCategoryIdsByNames as mapResolveCategoryIds } from '@/utils/userPointsCategories';
import { getPointCategoryIds, getPointCategoryNames } from '@/utils/travelPointMeta';
import { translate as i18nT } from '@/i18n'


type PointLike = {
  id: string;
  address: string;
  coord: string;
  description?: string;
  articleUrl?: string;
  travelImageThumbUrl?: string;
  categoryName?: string | { name?: string } | Array<string | { name?: string }>;
};

// Сырой hex, а НЕ `DESIGN_TOKENS.colors.travelPoint`: на web токен разворачивается
// в `var(--color-travelPoint, #ff922b)` (33 символа), а у поля `color` на бэке
// `max_length=16` — сохранение падало 400. Соседние места сохранения точки
// (`createMapPopupComponent`, `useAddressListItemActions`) шлют именно hex.
const DEFAULT_TRAVEL_POINT_COLOR = DESIGN_COLORS.travelPoint;
const DEFAULT_TRAVEL_POINT_STATUS = PointStatus.PLANNING;

export function usePointListAddPointModel({
  baseUrl,
  categoryIdToName,
  categoryNameToIds,
  isPointSaved,
  travelName,
}: {
  baseUrl?: string;
  categoryIdToName: Map<string, string>;
  categoryNameToIds: Map<string, string[]>;
  isPointSaved?: (coordStr?: string) => boolean;
  travelName?: string;
}) {
  const [addingPointId, setAddingPointId] = useState<string | null>(null);
  const { isAuthenticated, authReady } = useAuth();
  const queryClient = ReactQuery.useQueryClient();

  const handleAddPoint = useCallback(
    async (point: PointLike) => {
      if (!authReady) return;
      if (addingPointId === point.id) return;
      if (!isAuthenticated) {
        void showToast({
          type: 'info',
          text1: i18nT('travel:components.travel.hooks.usePointListAddPointModel.avtorizuytes_chtoby_sohranyat_tochki_96471933'),
          position: 'bottom',
        });
        return;
      }

      if (!point.coord) {
        void showToast({
          type: 'info',
          text1: i18nT('travel:components.travel.hooks.usePointListAddPointModel.u_tochki_net_koordinat_1d3df1ef'),
          position: 'bottom',
        });
        return;
      }

      // #839: точка уже в «Мои точки» — не плодим дубль (у бэка нет remove-by-coord),
      // просто подтверждаем состояние.
      if (isPointSaved?.(point.coord)) {
        void showToast({
          type: 'info',
          text1: i18nT('travel:components.travel.hooks.usePointListAddPointModel.tochka_uzhe_v_moi_tochki_fa7659b5'),
          position: 'bottom',
        });
        return;
      }

      const coords = parseCoord(point.coord);
      if (!coords) {
        void showToast({
          type: 'info',
          text1: i18nT('travel:components.travel.hooks.usePointListAddPointModel.nevozmozhno_raspoznat_koordinaty_4d8a632c'),
          position: 'bottom',
        });
        return;
      }

      const categoryIdsFromPoint = getPointCategoryIds(point as any);
      const rawNames = getPointCategoryNames(point as any);
      const cleanedNames = stripCountryFromCategoryNames(rawNames, point.address);
      const categoryIdsFromNames = mapResolveCategoryIds(cleanedNames, categoryNameToIds);
      const combinedIds = Array.from(new Set<string>([...categoryIdsFromPoint, ...categoryIdsFromNames]));
      const filteredIds = stripCountryFromCategoryIds(combinedIds, point.address, categoryIdToName);

      const rawCategoryName = Array.isArray(point.categoryName)
        ? point.categoryName.join(', ')
        : typeof point.categoryName === 'object'
          ? String((point.categoryName as any).name ?? '')
          : String(point.categoryName ?? '').trim();
      const cleanedCategoryName = stripCountryFromCategoryNames(
        rawCategoryName
          ? rawCategoryName
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
          : [],
        point.address
      ).join(', ');
      const categoryNameString = cleanedCategoryName || undefined;

      const payload: Partial<ImportedPoint> = {
        name: point.address || travelName || i18nT('travel:components.travel.hooks.usePointListAddPointModel.routePointFallback'),
        address: point.address,
        description: point.description,
        latitude: coords.lat,
        longitude: coords.lon,
        color: DEFAULT_TRAVEL_POINT_COLOR,
        status: DEFAULT_TRAVEL_POINT_STATUS,
        category: categoryNameString,
      };

      if (point.travelImageThumbUrl) {
        payload.photo = point.travelImageThumbUrl;
      }

      if (filteredIds.length > 0) {
        payload.categoryIds = filteredIds;
      }

      const tags: Record<string, unknown> = {};
      if (baseUrl) {
        tags.travelUrl = baseUrl;
      }
      if (point.articleUrl) {
        tags.articleUrl = point.articleUrl;
      }
      if (travelName) {
        tags.travelName = travelName;
      }
      if (Object.keys(tags).length > 0) {
        payload.tags = tags;
      }

      setAddingPointId(point.id);
      try {
        const created = await userPointsApi.createPoint(payload);
        // Летящее постраничное чтение коллекции (#1706) резолвится долго и
        // затёрло бы оптимистичную запись ниже — отменяем его заранее. Только
        // если коллекция уже прочитана: `cancelQueries` откатывает данные к
        // предыдущему состоянию, и на первом чтении это `undefined` — в кэше
        // осталась бы одна точка, свежая на весь staleTime.
        let collectionReady =
          queryClient.getQueryData(queryKeys.userPointsAll()) !== undefined;
        if (collectionReady) {
          await queryClient.cancelQueries({ queryKey: queryKeys.userPointsAll() });
        } else {
          // Коллекция ещё читается: дожидаемся того же самого чтения (запрос
          // дедуплицируется), иначе запись ниже была бы затёрта его ответом, а
          // инвалидация во время летящего чтения теряется. Падение чтения не
          // должно превращать УЖЕ созданную точку в «не удалось сохранить»,
          // поэтому ошибка гасится, а кэш остаётся нетронутым.
          try {
            await queryClient.ensureQueryData({
              queryKey: queryKeys.userPointsAll(),
              queryFn: () => userPointsApi.getAllPoints(),
            });
            // Коллекция прочитана целиком в обход `useSavedPointsCollection` —
            // отметку полноты (#1709) ставим сами, иначе прерванный ранее стрим
            // так и держал бы кэш «частичным».
            markPointsCollectionComplete(queryClient);
            collectionReady = true;
          } catch {
            collectionReady = false;
          }
        }
        // #839: оптимистично добавляем созданную точку в общий кэш `userPointsAll`,
        // чтобы координатный матчер (isPointSaved) сразу отдал true и карточка
        // переключилась в «Сохранено» без перезагрузки.
        const cachedOptimistically =
          collectionReady && !!created && Number.isFinite(Number((created as any).latitude));
        if (cachedOptimistically) {
          queryClient.setQueryData<ImportedPoint[]>(queryKeys.userPointsAll(), (old) => {
            const arr = Array.isArray(old) ? old : [];
            if (arr.some((p) => p?.id === created.id)) return arr;
            return [...arr, created];
          });
        }
        queueAnalyticsEvent('Place_Added', {
          source: 'travel_route',
          travelName: travelName || undefined,
        });
        void showToast({
          type: 'success',
          text1: i18nT('travel:components.travel.hooks.usePointListAddPointModel.tochka_dobavlena_v_moi_tochki_6e103965'),
          position: 'bottom',
        });
        // Рефетч только если оптимистичной записи не случилось (сервер не вернул
        // координаты). #1706: коллекция читается постранично, и безусловный
        // рефетч стоил бы ceil(count/200) запросов на каждое добавление — серия
        // сохранений упиралась бы в клиентский лимитер `/user-points/`.
        if (!cachedOptimistically) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.userPointsAll() });
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Не удалось добавить точку из маршрута в мои точки', error);
        }
        void showToast({
          type: 'error',
          text1: i18nT('travel:components.travel.hooks.usePointListAddPointModel.ne_udalos_sohranit_tochku_a149afe7'),
          position: 'bottom',
        });
      } finally {
        setAddingPointId(null);
      }
    },
    [addingPointId, authReady, baseUrl, categoryIdToName, categoryNameToIds, isAuthenticated, isPointSaved, queryClient, travelName]
  );

  return {
    addingPointId,
    handleAddPoint,
  };
}

const parseCoord = (coordStr: string): { lat: number; lon: number } | null => {
  if (!coordStr) return null;
  const cleaned = coordStr.replace(/;/g, ',').replace(/\s+/g, '');
  const [latStr, lonStr] = cleaned.split(',').map((s) => s.trim());
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
};

const getCountryFromAddress = (address?: string | null) => {
  const addr = String(address ?? '').trim();
  if (!addr) return '';
  return addr
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(-1)[0] ?? '';
};

const stripCountryFromCategoryNames = (names: string[], address?: string | null) => {
  const countryCandidate = getCountryFromAddress(address);
  if (!countryCandidate) return names;
  return names.filter((p) => p.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0);
};

const stripCountryFromCategoryIds = (
  ids: string[],
  address: string | null | undefined,
  idToNameMap: Map<string, string>
) => {
  const countryCandidate = getCountryFromAddress(address);
  if (!countryCandidate) return ids;
  return ids.filter((id) => {
    const idText = String(id ?? '').trim();
    const name = String(idToNameMap.get(idText) ?? '').trim();
    if (!name) {
      if (!idText) return true;
      return idText.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0;
    }
    return name.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0;
  });
};
