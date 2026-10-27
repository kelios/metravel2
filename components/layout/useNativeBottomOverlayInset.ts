import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, useWindowDimensions, type ViewInstance } from 'react-native';

import { useDockReservePx, useNativeBottomChromeOcclusion } from './bottomChromeInset';
import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe';

/** Bottom overlays share the measured dock/sticky chrome boundary, in host coordinates. */
export function useNativeBottomOverlayInset(overDock = true) {
  const dockReservePx = useDockReservePx();
  const insets = useSafeAreaInsetsSafe();
  const { top } = useNativeBottomChromeOcclusion();
  const { width, height } = useWindowDimensions();
  const layerRef = useRef<ViewInstance>(null);
  const generation = useRef(0);
  const [layerBottom, setLayerBottom] = useState<number | null>(null);
  const measureLayer = useCallback(() => {
    if (Platform.OS === 'web') return;
    const request = ++generation.current;
    layerRef.current?.measureInWindow((_x, y, _width, measuredHeight) => {
      if (request !== generation.current || !Number.isFinite(y + measuredHeight) || measuredHeight <= 0) return;
      setLayerBottom(y + measuredHeight);
    });
  }, []);
  useEffect(() => {
    measureLayer();
    return () => { generation.current += 1; };
  }, [measureLayer, width, height]);

  const footerReserve = layerBottom !== null && top !== null ? Math.max(0, layerBottom - top) : 0;
  const safeBottom = Math.max(0, insets.bottom || 0);
  const reserve = Math.max(overDock ? Math.max(dockReservePx, footerReserve) : 0, safeBottom);
  return { layerRef, measureLayer, reserve, safeBottom };
}
