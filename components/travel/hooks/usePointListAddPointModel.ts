import { useCallback, useState } from 'react';
import * as ReactQuery from '@tanstack/react-query';

import { userPointsApi } from '@/api/userPoints';
import { useAuth } from '@/context/AuthContext';
import type { ImportedPoint } from '@/types/userPoints';
import { PointStatus } from '@/types/userPoints';
import { showToast } from '@/utils/toast';
import { resolveCategoryIdsByNames as mapResolveCategoryIds } from '@/utils/userPointsCategories';
import { getPointCategoryIds, getPointCategoryNames } from '@/utils/travelPointMeta';

type PointLike = {
  id: string;
  address: string;
  coord: string;
  description?: string;
  articleUrl?: string;
  travelImageThumbUrl?: string;
  categoryName?: string | { name?: string } | Array<string | { name?: string }>;
};

const DEFAULT_TRAVEL_POINT_COLOR = '#4F46E5';
const DEFAULT_TRAVEL_POINT_STATUS = PointStatus.PLANNING;

export function usePointListAddPointModel({
  baseUrl,
  categoryIdToName,
  categoryNameToIds,
  travelName,
}: {
  baseUrl?: string;
  categoryIdToName: Map<string, string>;
  categoryNameToIds: Map<string, string[]>;
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
          text1: 'Авторизуйтесь, чтобы сохранять точки',
          position: 'bottom',
        });
        return;
      }

      if (!point.coord) {
        void showToast({
          type: 'info',
          text1: 'У точки нет координат',
          position: 'bottom',
        });
        return;
      }

      const coords = parseCoord(point.coord);
      if (!coords) {
        void showToast({
          type: 'info',
          text1: 'Невозможно распознать координаты',
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
        name: point.address || travelName || 'Точка маршрута',
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
        await userPointsApi.createPoint(payload);
        void showToast({
          type: 'success',
          text1: 'Точка добавлена в «Мои точки»',
          position: 'bottom',
        });
        void queryClient.invalidateQueries({ queryKey: ['userPointsAll'] });
      } catch (error) {
        if (__DEV__) {
          console.error('Не удалось добавить точку из маршрута в мои точки', error);
        }
        void showToast({
          type: 'error',
          text1: 'Не удалось сохранить точку',
          position: 'bottom',
        });
      } finally {
        setAddingPointId(null);
      }
    },
    [addingPointId, authReady, baseUrl, categoryIdToName, categoryNameToIds, isAuthenticated, queryClient, travelName]
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
