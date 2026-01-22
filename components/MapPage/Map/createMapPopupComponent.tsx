import React, { useCallback, useMemo, useState } from 'react';
import PlacePopupCard from './PlacePopupCard';
import type { Point } from './types';
import { buildGoogleMapsUrl, buildOrganicMapsUrl, buildTelegramShareUrl } from './mapLinks';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/src/utils/toast';
import { userPointsApi } from '@/src/api/userPoints';
import { useQueryClient } from '@tanstack/react-query';
import { PointStatus } from '@/types/userPoints';

type UseMap = () => any;

interface CreatePopupComponentArgs {
  useMap: UseMap;
}

const stripCountryFromCategoryString = (raw: unknown, address?: string | null) => {
  const category = String(raw ?? '').trim();
  if (!category) return '';
  const addr = String(address ?? '').trim();
  const countryCandidate = addr
    ? addr
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(-1)[0]
    : '';
  if (!countryCandidate) return category;
  const filtered = category
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => p.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0);
  return filtered.join(', ');
};

export const createMapPopupComponent = ({ useMap }: CreatePopupComponentArgs) => {
  const PopupComponent: React.FC<{ point: Point }> = ({ point }) => {
    const [isAdding, setIsAdding] = useState(false);
    const map = useMap();
    const coord = String(point.coord ?? '').trim();
    const { isAuthenticated, authReady } = useAuth();
    const queryClient = useQueryClient();

    const handlePress = useCallback(() => {
      if (map) {
        map.closePopup();
      }
    }, [map]);

    const handleOpenArticle = useCallback(() => {
      const url = String(point.articleUrl || point.urlTravel || '').trim();
      if (!url) return;
      try {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
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
      try {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
    }, [coord]);

    const handleOpenOrganicMaps = useCallback(() => {
      if (!coord) return;
      const url = buildOrganicMapsUrl(coord);
      if (!url) return;
      try {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
    }, [coord]);

    const handleShareTelegram = useCallback(() => {
      if (!coord) return;
      const telegramUrl = buildTelegramShareUrl(coord);
      if (!telegramUrl) return;
      try {
        if (typeof window !== 'undefined') {
          window.open(telegramUrl, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
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
        color: '#ff922b',
        status: PointStatus.PLANNING,
        category: categoryNameString,
        categoryName: categoryNameString,
      };
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
        void queryClient.invalidateQueries({ queryKey: ['userPointsAll'] });
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
      point.address,
      point.category_ids,
      point.categoryId,
      queryClient,
      handlePress,
    ]);

    return (
      <PlacePopupCard
        title={point.address || ''}
        imageUrl={point.travelImageThumbUrl}
        categoryLabel={categoryLabel}
        coord={coord}
        onCardPress={handlePress}
        enableCardPress={true}
        onOpenArticle={handleOpenArticle}
        onCopyCoord={handleCopyCoord}
        onShareTelegram={handleShareTelegram}
        onOpenGoogleMaps={handleOpenGoogleMaps}
        onOpenOrganicMaps={handleOpenOrganicMaps}
        onAddPoint={handleAddPoint}
        addDisabled={!authReady || !isAuthenticated || !normalizedCoord || isAdding}
        isAdding={isAdding}
      />
    );
  };

  return PopupComponent;
};
