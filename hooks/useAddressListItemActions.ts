// hooks/useAddressListItemActions.ts
// E7: Action handlers + state extracted from AddressListItem.tsx

import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { userPointsApi } from '@/api/userPoints';
import { PointStatus } from '@/types/userPoints';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { openExternalUrlInNewTab, openExternalUrl } from '@/utils/externalLinks';
import { showToast } from '@/utils/toast';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { TravelCoords } from '@/types/types';

const DEFAULT_TRAVEL_POINT_COLOR = DESIGN_COLORS.travelPoint;
const DEFAULT_TRAVEL_POINT_STATUS = PointStatus.PLANNING;

// --- Pure URL builders ---

const parseCoord = (coord?: string) => {
  if (!coord) return null;
  const parsed = CoordinateConverter.fromLooseString(coord);
  return parsed ? { lat: parsed.lat, lon: parsed.lng } : null;
};

export const buildMapUrl = (coord?: string) => {
  const p = parseCoord(coord);
  return p ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}` : '';
};

export const buildAppleMapsUrl = (coord?: string) => {
  const p = parseCoord(coord);
  return p ? `https://maps.apple.com/?q=${encodeURIComponent(`${p.lat},${p.lon}`)}` : '';
};

export const buildYandexMapsUrl = (coord?: string) => {
  const p = parseCoord(coord);
  return p ? `https://yandex.ru/maps/?pt=${encodeURIComponent(`${p.lon},${p.lat}`)}&z=16&l=map` : '';
};

export const buildOsmUrl = (coord?: string) => {
  const p = parseCoord(coord);
  if (!p) return '';
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(p.lat))}&mlon=${encodeURIComponent(String(p.lon))}#map=16/${encodeURIComponent(String(p.lat))}/${encodeURIComponent(String(p.lon))}`;
};

export const openExternal = async (url?: string) => {
  try {
    const opened = await openExternalUrlInNewTab(url ?? '');
    if (!opened) await showToast({ type: 'info', text1: 'Не удалось открыть ссылку', position: 'bottom' });
  } catch {
    await showToast({ type: 'info', text1: 'Не удалось открыть ссылку', position: 'bottom' });
  }
};

export const stripCountryFromCategoryString = (raw: string | null | undefined, address?: string | null) => {
  const category = String(raw ?? '').trim();
  if (!category) return '';
  const addr = String(address ?? '').trim();
  const countryCandidate = addr ? addr.split(',').map((p) => p.trim()).filter(Boolean).slice(-1)[0] : '';
  if (!countryCandidate) return category;
  return category.split(',').map((p) => p.trim()).filter(Boolean)
    .filter((p) => p.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0)
    .join(', ');
};

// --- Hook ---

export function useAddressListItemActions(travel: TravelCoords) {
  const { address, categoryName, coord, travelImageThumbUrl, articleUrl, urlTravel } = travel;
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [pointAdded, setPointAdded] = useState(false);

  const { isAuthenticated, authReady } = useAuth();
  const queryClient = useQueryClient();

  const rawCategoryName = useMemo(() => {
    if (categoryName) return String(categoryName);
    const legacy = (travel as Record<string, unknown>).category_name ?? (travel as Record<string, unknown>).category ?? (travel as Record<string, unknown>).categories;
    if (Array.isArray(legacy)) {
      return legacy.map((item) => (typeof item === 'object' ? String((item as Record<string, unknown>)?.name ?? '') : String(item ?? ''))).map((s) => s.trim()).filter(Boolean).join(', ');
    }
    if (legacy && typeof legacy === 'object') return String((legacy as Record<string, unknown>).name ?? '');
    return String(legacy ?? '').trim();
  }, [categoryName, travel]);

  const categories = useMemo(() => {
    const cleaned = stripCountryFromCategoryString(rawCategoryName, address);
    return cleaned ? cleaned.split(',').map((c) => c.trim()).filter(Boolean) : [];
  }, [address, rawCategoryName]);

  const showToastInfo = useCallback((msg: string) => {
    void showToast({ type: 'info', text1: msg, position: 'bottom' });
  }, []);

  const copyCoords = useCallback(async () => {
    if (!coord) return;
    try {
      if (Platform.OS === 'web' && (navigator as unknown as Record<string, unknown>)?.clipboard) {
        await (navigator as unknown as { clipboard: { writeText: (s: string) => Promise<void> } }).clipboard.writeText(coord);
      } else {
        await Clipboard.setStringAsync(coord);
      }
      showToastInfo('Координаты скопированы');
    } catch { showToastInfo('Не удалось скопировать'); }
  }, [coord, showToastInfo]);

  const openTelegram = useCallback(async () => {
    if (!coord) return;
    const mapUrl = buildMapUrl(coord);
    const text = `Координаты: ${coord}`;
    const deeplinks = [
      `tg://msg_url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`,
      `tg://share?text=${encodeURIComponent(`${text}\n${mapUrl}`)}`,
    ];
    if (Platform.OS !== 'web') {
      for (const dl of deeplinks) {
        try { const opened = await openExternalUrl(dl, { allowedProtocols: ['http:', 'https:', 'tg:'] }); if (opened) return; } catch { /* next */ }
      }
    }
    await openExternal(`https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`);
  }, [coord]);

  const openMap = useCallback((e?: { stopPropagation?: () => void }) => { e?.stopPropagation?.(); void openExternal(buildMapUrl(coord)); }, [coord]);

  const openArticle = useCallback((e?: { stopPropagation?: () => void }) => { e?.stopPropagation?.(); void openExternal(articleUrl || urlTravel); }, [articleUrl, urlTravel]);

  const handleAddPoint = useCallback(async () => {
    if (!authReady) return;
    if (!isAuthenticated) { void showToast({ type: 'info', text1: 'Войдите, чтобы сохранить точку', position: 'bottom' }); return; }
    if (isAddingPoint) return;
    const lat = Number(travel.lat);
    const lng = Number(travel.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { void showToast({ type: 'info', text1: 'Не удалось распознать координаты', position: 'bottom' }); return; }

    const cleanedCategory = stripCountryFromCategoryString(rawCategoryName, address) || undefined;
    const payload: Record<string, unknown> = {
      name: address || 'Точка маршрута', address, latitude: lat, longitude: lng,
      color: DEFAULT_TRAVEL_POINT_COLOR, status: DEFAULT_TRAVEL_POINT_STATUS,
      category: cleanedCategory, categoryName: cleanedCategory,
    };
    if (travelImageThumbUrl) payload.photo = travelImageThumbUrl;
    const tags: Record<string, unknown> = {};
    if (urlTravel) tags.travelUrl = urlTravel;
    if (articleUrl) tags.articleUrl = articleUrl;
    if (Object.keys(tags).length > 0) payload.tags = tags;

    if (pointAdded) { void showToast({ type: 'info', text1: 'Точка уже добавлена', position: 'bottom' }); return; }
    setIsAddingPoint(true);
    try {
      await userPointsApi.createPoint(payload);
      setPointAdded(true);
      void showToast({ type: 'success', text1: 'Точка добавлена в «Мои точки»', position: 'bottom' });
      void queryClient.invalidateQueries({ queryKey: ['userPointsAll'] });
      setTimeout(() => setPointAdded(false), 1000);
    } catch {
      void showToast({ type: 'error', text1: 'Не удалось сохранить точку', position: 'bottom' });
    } finally { setIsAddingPoint(false); }
  }, [address, articleUrl, authReady, rawCategoryName, isAddingPoint, isAuthenticated, pointAdded, queryClient, travel.lat, travel.lng, travelImageThumbUrl, urlTravel]);

  return {
    rawCategoryName, categories, isAddingPoint, pointAdded, isAuthenticated, authReady,
    copyCoords, openTelegram, openMap, openArticle, handleAddPoint,
  };
}
