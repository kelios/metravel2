// hooks/useAddressListItemActions.ts
// E7: Action handlers + state extracted from AddressListItem.tsx

import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/context/AuthContext';
import { useSavedPointToggle } from '@/hooks/map/useSavedPointToggle';
import { PointStatus } from '@/types/userPoints';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { openExternalUrlInNewTab, openExternalUrl } from '@/utils/externalLinks';
import { getSiteBaseUrl } from '@/utils/seo';
import { showToast } from '@/utils/toast';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { TravelCoords } from '@/types/types';
import { translate as i18nT } from '@/i18n'


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
    const opened = await openExternalUrlInNewTab(url ?? '', {
      allowRelative: true,
      baseUrl: getSiteBaseUrl(),
    });
    if (!opened) await showToast({ type: 'info', text1: i18nT('shared:hooks.useAddressListItemActions.ne_udalos_otkryt_ssylku_e0811744'), position: 'bottom' });
  } catch {
    await showToast({ type: 'info', text1: i18nT('shared:hooks.useAddressListItemActions.ne_udalos_otkryt_ssylku_e0811744'), position: 'bottom' });
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

  const { isAuthenticated, authReady } = useAuth();

  // #334 — saved-state shared with «Мои точки» через кэш userPointsAll, матч по
  // координате (у POI нет user-point id). Даёт настоящий toggle без дублей и
  // переживает ремоунт карточки (раньше pointAdded был локальным и сбрасывался).
  const toggleCoord = useMemo(() => {
    const lat = Number(travel.lat);
    const lng = Number(travel.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [travel.lat, travel.lng]);
  const { isSaved, removeSaved, createPoint } = useSavedPointToggle({ coord: toggleCoord });

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
      showToastInfo(i18nT('shared:hooks.useAddressListItemActions.koordinaty_skopirovany_406138ef'));
    } catch { showToastInfo(i18nT('shared:hooks.useAddressListItemActions.ne_udalos_skopirovat_571f0817')); }
  }, [coord, showToastInfo]);

  const openTelegram = useCallback(async () => {
    if (!coord) return;
    const mapUrl = buildMapUrl(coord);
    const text = i18nT('shared:hooks.useAddressListItemActions.koordinaty_value1_f527619f', { value1: coord });
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
    if (!isAuthenticated) { void showToast({ type: 'info', text1: i18nT('shared:hooks.useAddressListItemActions.voydite_chtoby_sohranit_tochku_990d6c7e'), position: 'bottom' }); return; }
    if (isAddingPoint) return;
    const lat = Number(travel.lat);
    const lng = Number(travel.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { void showToast({ type: 'info', text1: i18nT('shared:hooks.useAddressListItemActions.ne_udalos_raspoznat_koordinaty_1da8464d'), position: 'bottom' }); return; }

    const cleanedCategory = stripCountryFromCategoryString(rawCategoryName, address) || undefined;
    const payload: Record<string, unknown> = {
      name: address || i18nT('sharedStatic:route.pointFallback'), address, latitude: lat, longitude: lng,
      color: DEFAULT_TRAVEL_POINT_COLOR, status: DEFAULT_TRAVEL_POINT_STATUS,
      category: cleanedCategory, categoryName: cleanedCategory,
    };
    if (travelImageThumbUrl) payload.photo = travelImageThumbUrl;
    const tags: Record<string, unknown> = {};
    if (urlTravel) tags.travelUrl = urlTravel;
    if (articleUrl) tags.articleUrl = articleUrl;
    if (Object.keys(tags).length > 0) payload.tags = tags;

    setIsAddingPoint(true);
    try {
      if (isSaved) {
        await removeSaved();
        void showToast({ type: 'info', text1: i18nT('shared:hooks.useAddressListItemActions.tochka_ubrana_iz_moi_tochki_b104d947'), position: 'bottom' });
        return;
      }
      await createPoint(payload);
      void showToast({ type: 'success', text1: i18nT('shared:hooks.useAddressListItemActions.tochka_dobavlena_v_moi_tochki_000bc83b'), position: 'bottom' });
    } catch {
      void showToast({ type: 'error', text1: i18nT('shared:hooks.useAddressListItemActions.ne_udalos_sohranit_tochku_3c69cb31'), position: 'bottom' });
    } finally { setIsAddingPoint(false); }
  }, [address, articleUrl, authReady, rawCategoryName, isAddingPoint, isAuthenticated, isSaved, removeSaved, createPoint, travel.lat, travel.lng, travelImageThumbUrl, urlTravel]);

  return {
    rawCategoryName, categories, isAddingPoint, pointAdded: isSaved, isAuthenticated, authReady,
    copyCoords, openTelegram, openMap, openArticle, handleAddPoint,
  };
}
