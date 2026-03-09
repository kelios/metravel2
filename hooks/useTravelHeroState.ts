// hooks/useTravelHeroState.ts
// E11: LCP hero swap + favorite + gallery state extracted from TravelDetailsHero.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useResponsive } from '@/hooks/useResponsive';
import { showToast } from '@/utils/toast';
import { useTdTrace } from '@/hooks/useTdTrace';
import type { Travel } from '@/types/types';

type ImgLike = { url: string; width?: number; height?: number; updated_at?: string | null; id?: number | string };

export function useTravelHeroState(travel: Travel, isMobile: boolean, onFirstImageLoad: () => void, deferExtras: boolean) {
  const { width: winW, height: winH } = useResponsive();
  const tdTrace = useTdTrace();
  const { isAuthenticated } = useAuth();
  const { requireAuth } = useRequireAuth({ intent: 'favorite' });
  const { addFavorite, removeFavorite, isFavorite: checkIsFavorite } = useFavorites();
  const isFavorite = checkIsFavorite(travel.id, 'travel');

  const [heroContainerWidth, setHeroContainerWidth] = useState<number | null>(null);
  const [extrasReady, setExtrasReady] = useState(!deferExtras || Platform.OS !== 'web');

  // --- Favorite toggle ---
  const handleFavoriteToggle = useCallback(async () => {
    if (!isAuthenticated) { requireAuth(); return; }
    try {
      if (isFavorite) {
        await removeFavorite(travel.id, 'travel');
        showToast({ type: 'success', text1: 'Удалено из избранного', visibilityTime: 2000 });
      } else {
        await addFavorite({
          id: travel.id, type: 'travel', title: travel.name,
          imageUrl: travel.travel_image_thumb_url,
          url: `/travels/${(travel as Record<string, unknown>).slug || travel.id}`,
          country: (travel as Record<string, unknown>).countryName as string | undefined,
        });
        showToast({ type: 'success', text1: 'Добавлено в избранное', visibilityTime: 2000 });
      }
    } catch {
      showToast({ type: 'error', text1: 'Не удалось обновить избранное', visibilityTime: 3000 });
    }
  }, [isAuthenticated, requireAuth, isFavorite, travel, addFavorite, removeFavorite]);

  // --- First image ---
  const firstRaw = travel?.travel_image_thumb_url || travel?.gallery?.[0];
  const firstImg = useMemo(() => {
    if (!firstRaw) return null;
    if (typeof firstRaw === 'string') return { url: firstRaw };
    return firstRaw;
  }, [firstRaw]) as ImgLike | null;

  // --- Hero height ---
  const aspectRatio = (firstImg?.width && firstImg?.height ? firstImg.width / firstImg.height : undefined) || 16 / 9;
  const resolvedWidth = heroContainerWidth ?? winW;
  const heroHeight = useMemo(() => {
    if (Platform.OS === 'web' && !isMobile) {
      const target = winH * 0.7;
      return Math.max(360, Math.min(target, 750));
    }
    const minViewportHeight = Math.round(winH * 0.7);
    const arHeight = resolvedWidth ? Math.round(resolvedWidth / aspectRatio) : winH * 0.6;
    const boundedAspectHeight = Math.max(280, Math.min(arHeight, Math.round(winH * 0.85)));
    return Math.max(minViewportHeight, boundedAspectHeight);
  }, [isMobile, winH, resolvedWidth, aspectRatio]);

  // --- Gallery images ---
  const galleryImages = useMemo(() => {
    const gallery = Array.isArray(travel.gallery) ? travel.gallery : [];
    const mapped = gallery.map((item: unknown, index: number) =>
      typeof item === 'string' ? { url: item, id: index } : { ...(item as Record<string, unknown>), id: (item as Record<string, unknown>).id || index }
    );
    const coverUrl = typeof travel.travel_image_thumb_url === 'string' ? travel.travel_image_thumb_url.trim() : '';

    if (!coverUrl) return mapped;
    if (mapped.length === 0) return [{ url: coverUrl, id: 0 }];

    const normalizedCover = coverUrl.replace(/[?#].*$/, '');
    const hasSameAsCover = mapped.some((item) => {
      const raw = typeof item?.url === 'string' ? item.url.trim() : '';
      return raw.replace(/[?#].*$/, '') === normalizedCover;
    });

    if (hasSameAsCover) return mapped;
    return [{ url: coverUrl, id: `cover-${travel.id}` }, ...mapped];
  }, [travel.gallery, travel.travel_image_thumb_url, travel.id]);

  const heroAlt = travel?.name ? `Фотография маршрута «${travel.name}»` : 'Фото путешествия';

  // --- Web LCP hero swap ---
  const isJSDOM = Platform.OS === 'web' && typeof navigator !== 'undefined' && String((navigator as unknown as Record<string, unknown>).userAgent || '').toLowerCase().includes('jsdom');
  const [webHeroLoaded, setWebHeroLoaded] = useState(Platform.OS !== 'web' || isJSDOM);
  const [overlayUnmounted, setOverlayUnmounted] = useState(false);
  const [isOverlayFading, setIsOverlayFading] = useState(false);
  const [sliderImageReady, setSliderImageReady] = useState(false);
  const webHeroLoadNotifiedRef = useRef(false);
  const sliderLoadNotifiedRef = useRef(false);
  const lastTravelIdRef = useRef<number | string | null>(travel?.id ?? null);

  useEffect(() => { tdTrace('hero:mount', { travelId: travel?.id }); return () => tdTrace('hero:unmount', { travelId: travel?.id }); }, [tdTrace, travel?.id]);
  useEffect(() => { if (firstImg?.url) tdTrace('hero:firstImgReady'); }, [firstImg?.url, tdTrace]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const nextId = travel?.id ?? null;
    const prevId = lastTravelIdRef.current;
    if (prevId !== null && prevId !== nextId) {
      setWebHeroLoaded(false); setOverlayUnmounted(false); setIsOverlayFading(false); setSliderImageReady(false);
      webHeroLoadNotifiedRef.current = false; sliderLoadNotifiedRef.current = false;
      tdTrace('hero:swapReset');
    }
    lastTravelIdRef.current = nextId;
  }, [travel?.id, tdTrace]);

  // Fallback: if LCP image doesn't load within 8s
  useEffect(() => {
    if (Platform.OS !== 'web' || webHeroLoaded || !firstImg) return;
    const fallback = setTimeout(() => {
      if (!webHeroLoadNotifiedRef.current) {
        webHeroLoadNotifiedRef.current = true; setWebHeroLoaded(true);
        tdTrace('hero:lcpImg:fallbackTimeout'); onFirstImageLoad();
      }
    }, 8000);
    return () => clearTimeout(fallback);
  }, [webHeroLoaded, firstImg, onFirstImageLoad, tdTrace]);

  // After Slider's first image loads, hide the LCP overlay
  useEffect(() => {
    if (!webHeroLoaded || Platform.OS !== 'web') return;
    if (sliderImageReady) {
      setIsOverlayFading(true);
      const t = setTimeout(() => setOverlayUnmounted(true), 340);
      return () => clearTimeout(t);
    }
    const fallback = setTimeout(() => { setIsOverlayFading(true); setOverlayUnmounted(true); }, 6000);
    return () => clearTimeout(fallback);
  }, [webHeroLoaded, sliderImageReady]);

  useEffect(() => { if (Platform.OS === 'web' && webHeroLoaded) tdTrace('hero:webHeroLoaded'); }, [webHeroLoaded, tdTrace]);
  useEffect(() => { if (Platform.OS === 'web' && overlayUnmounted) tdTrace('hero:overlayHidden'); }, [overlayUnmounted, tdTrace]);

  const handleWebHeroLoad = useCallback(() => {
    if (webHeroLoadNotifiedRef.current) return;
    webHeroLoadNotifiedRef.current = true;
    if (Platform.OS === 'web') setWebHeroLoaded(true);
    tdTrace('hero:lcpImg:onLoad'); onFirstImageLoad();
  }, [onFirstImageLoad, tdTrace]);

  const handleSliderImageLoad = useCallback(() => {
    if (sliderLoadNotifiedRef.current) return;
    sliderLoadNotifiedRef.current = true;
    setSliderImageReady(true); tdTrace('hero:sliderImgLoaded');
  }, [tdTrace]);

  // Defer extras
  useEffect(() => {
    if (Platform.OS !== 'web') { setExtrasReady(true); return; }
    if (!deferExtras) { setExtrasReady(true); return; }
    let cancelled = false;
    const kick = () => { if (!cancelled) setExtrasReady(true); };
    if (typeof (window as unknown as Record<string, unknown>)?.requestIdleCallback === 'function') {
      (window as unknown as { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => void }).requestIdleCallback(kick, { timeout: 1200 });
    } else { setTimeout(kick, 800); }
    return () => { cancelled = true; };
  }, [deferExtras]);

  return {
    isFavorite, handleFavoriteToggle,
    firstImg, heroHeight, galleryImages, heroAlt, aspectRatio,
    heroContainerWidth, setHeroContainerWidth,
    webHeroLoaded, overlayUnmounted, isOverlayFading,
    handleWebHeroLoad, handleSliderImageLoad,
    extrasReady, isAuthenticated,
  };
}
