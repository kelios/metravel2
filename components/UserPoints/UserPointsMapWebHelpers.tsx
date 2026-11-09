import React from 'react';

/**
 * Служебные компоненты web-карты «Моих точек» внутри `MapContainer` react-leaflet
 * (#3135: вынесены из `UserPointsMap.tsx`, поведение без изменений): привязка
 * экземпляра карты, `invalidateSize` после раскладки, клик по карте и отчёт о
 * центре. Хуки react-leaflet приходят параметрами (`useMap`, `useMapEvents`),
 * потому что модуль карты грузится лениво (`useUserPointsMapWebRuntime`).
 */
export const WebMapInstanceBinder = ({ useMap, onMapReady }: { useMap: any; onMapReady: (map: any) => void }) => {
  const map = useMap?.();
  React.useEffect(() => {
    if (!map) return;
    onMapReady(map);
  }, [map, onMapReady]);
  return null;
};

export const WebMapAutoResize = ({ useMap }: { useMap: any }) => {
  const map = useMap?.();

  React.useEffect(() => {
    if (!map) return;

    let raf: number | null = null;
    const invalidate = () => {
      try {
        if (raf != null && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(raf);
        }
      } catch {
        // noop
      }

      try {
        if (typeof requestAnimationFrame === 'function') {
          raf = requestAnimationFrame(() => {
            try {
              map.invalidateSize?.();
            } catch {
              // noop
            }
          }) as any;
        } else {
          map.invalidateSize?.();
        }
      } catch {
        // noop
      }
    };

    // Initial + post-layout invalidations (fonts/header can shift layout on web).
    invalidate();
    const t1 = setTimeout(invalidate, 50);
    const t2 = setTimeout(invalidate, 250);

    const canUseWindow = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
    const onWindowResize = () => invalidate();
    if (canUseWindow) {
      try {
        window.addEventListener('resize', onWindowResize);
      } catch {
        // noop
      }
    }

    let ro: any = null;
    try {
      const container = map.getContainer?.();
      if (container && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => invalidate());
        ro.observe(container);
      }
    } catch {
      // noop
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (canUseWindow) {
        try {
          window.removeEventListener('resize', onWindowResize);
        } catch {
          // noop
        }
      }
      try {
        ro?.disconnect();
      } catch {
        // noop
      }
      try {
        if (raf != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      } catch {
        // noop
      }
    };
  }, [map]);

  return null;
};

export const WebMapClickHandler = ({ useMapEvents, onMapPress }: { useMapEvents: any; onMapPress?: (c: any) => void }) => {
  useMapEvents?.({
    click: (e: any) => {
      const lat = e?.latlng?.lat;
      const lng = e?.latlng?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      onMapPress?.({ lat, lng });
    },
  });
  return null;
};

export const WebMapCenterReporter = ({
  useMap,
  useMapEvents,
  onCenterChange,
}: {
  useMap: any;
  useMapEvents: any;
  onCenterChange?: (c: any) => void;
}) => {
  const map = useMap?.();

  useMapEvents?.({
    moveend: () => {
      try {
        const c = map?.getCenter?.();
        const lat = c?.lat;
        const lng = c?.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onCenterChange?.({ lat, lng });
      } catch {
        // noop
      }
    },
    zoomend: () => {
      try {
        const c = map?.getCenter?.();
        const lat = c?.lat;
        const lng = c?.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onCenterChange?.({ lat, lng });
      } catch {
        // noop
      }
    },
  });

  React.useEffect(() => {
    try {
      const c = map?.getCenter?.();
      const lat = c?.lat;
      const lng = c?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      onCenterChange?.({ lat, lng });
    } catch {
      // noop
    }
  }, [map, onCenterChange]);

  return null;
};
