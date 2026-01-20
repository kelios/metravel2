import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import type { Region } from 'react-native-maps';
import Feather from '@expo/vector-icons/Feather';
import type { ImportedPoint } from '@/types/userPoints';
import type { PointColor } from '@/types/userPoints';
import { STATUS_LABELS } from '@/types/userPoints';
import { ensureLeafletAndReactLeaflet } from '@/src/utils/leafletWebLoader';
import { useThemedColors } from '@/hooks/useTheme';
import type { MapUiApi } from '@/src/types/mapUi';
import { useMapInstance } from '@/components/MapPage/Map/useMapInstance';
import { useMapApi } from '@/components/MapPage/Map/useMapApi';
import { WEB_MAP_BASE_LAYERS } from '@/src/config/mapWebLayers';
import { createLeafletLayer } from '@/src/utils/mapWebLayers';

interface PointsMapProps {
  points: ImportedPoint[];
  center?: { lat: number; lng: number };
  activePointId?: number | null;
  onPointPress?: (point: ImportedPoint) => void;
  onEditPoint?: (point: ImportedPoint) => void;
  onDeletePoint?: (point: ImportedPoint) => void;
  onMapPress?: (coords: { lat: number; lng: number }) => void;
  onCenterChange?: (coords: { lat: number; lng: number }) => void;
  pendingMarker?: { lat: number; lng: number } | null;
  pendingMarkerColor?: PointColor;
  onMapUiApiReady?: (api: MapUiApi | null) => void;
  routeLines?: Array<{ id: number; line: Array<[number, number]> }>;
}

export const PointsMap: React.FC<PointsMapProps> = ({
  points,
  center,
  activePointId,
  onPointPress,
  onEditPoint,
  onDeletePoint,
  onMapPress,
  onCenterChange,
  pendingMarker,
  pendingMarkerColor,
  onMapUiApiReady,
  routeLines,
}) => {
  // Для web используем react-leaflet, для mobile - react-native-maps
  if (Platform.OS === 'web') {
    return (
      <PointsMapWeb
        points={points}
        center={center}
        activePointId={activePointId}
        onPointPress={onPointPress}
        onEditPoint={onEditPoint}
        onDeletePoint={onDeletePoint}
        onMapPress={onMapPress}
        onCenterChange={onCenterChange}
        pendingMarker={pendingMarker}
        pendingMarkerColor={pendingMarkerColor}
        onMapUiApiReady={onMapUiApiReady}
        routeLines={routeLines}
      />
    );
  }
  
  return (
    <PointsMapNative
      points={points}
      center={center}
      activePointId={activePointId}
      onPointPress={onPointPress}
      onEditPoint={onEditPoint}
      onDeletePoint={onDeletePoint}
      onMapPress={onMapPress}
      onCenterChange={onCenterChange}
      pendingMarker={pendingMarker}
      pendingMarkerColor={pendingMarkerColor}
      onMapUiApiReady={onMapUiApiReady}
      routeLines={routeLines}
    />
  );
};

// Web версия с Leaflet
const PointsMapWeb: React.FC<PointsMapProps> = ({
  points,
  center: centerOverride,
  activePointId,
  onPointPress,
  onEditPoint,
  onDeletePoint,
  onMapPress,
  onCenterChange,
  pendingMarker,
  pendingMarkerColor,
  onMapUiApiReady,
  routeLines,
}) => {
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [mapInstance, setMapInstance] = React.useState<any>(null);
  const baseLayerFallbackIndexRef = React.useRef(0);
  const baseLayerFallbackSwitchingRef = React.useRef(false);

  const [driveInfoById, setDriveInfoById] = React.useState<
    Record<
      number,
      | { status: 'loading' }
      | { status: 'ok'; distanceKm: number; durationMin: number }
      | { status: 'error' }
    >
  >({});

  const [mods, setMods] = React.useState<{
    L: any;
    MapContainer: any;
    Marker: any;
    Popup: any;
    Polyline: any;
    useMap: any;
    useMapEvents: any;
  } | null>(null);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;
    (async () => {
      const { L, rl } = await ensureLeafletAndReactLeaflet();
      if (cancelled) return;

      try {
        if (L?.Icon?.Default?.prototype) {
          // @ts-ignore
          delete L.Icon.Default.prototype._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          });
        }
      } catch {
        // noop
      }

      setMods({
        L,
        MapContainer: (rl as any).MapContainer,
        Marker: (rl as any).Marker,
        Popup: (rl as any).Popup,
        Polyline: (rl as any).Polyline,
        useMap: (rl as any).useMap,
        useMapEvents: (rl as any).useMapEvents,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const getMarkerIcon = React.useCallback(
    (color: PointColor | string | undefined, opts?: { active?: boolean }) => {
      const L = mods?.L;
      if (!L) return undefined;

      const fill = String(color || '').trim() || colors.primary;
      const isActive = Boolean(opts?.active);
      const size = isActive ? 34 : 28;
      const anchor = isActive ? 17 : 14;
      const strokeW = isActive ? 2 : 1;

      const html = `
        <div style="width:${size}px;height:${size}px;position:relative;transform:translate(-${anchor}px,-${size}px);">
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 22s7-4.5 7-12a7 7 0 0 0-14 0c0 7.5 7 12 7 12Z" fill="${fill}" stroke="${colors.border}" stroke-width="${strokeW}" />
            <circle cx="12" cy="10" r="3" fill="${colors.surface}" opacity="0.95" />
          </svg>
        </div>
      `;

      return L.divIcon({
        html,
        className: '',
        iconSize: [size, size],
        iconAnchor: [anchor, size],
        popupAnchor: [0, -(size - 2)],
      });
    },
    [colors.border, colors.primary, colors.surface, mods?.L]
  );

  const safePoints = React.useMemo(() => {
    return (points ?? [])
      .map((p: any) => {
        const lat = Number(p?.latitude);
        const lng = Number(p?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { ...(p as any), latitude: lat, longitude: lng } as ImportedPoint;
      })
      .filter((p: any): p is ImportedPoint => p != null);
  }, [points]);

  const { leafletBaseLayerRef, leafletOverlayLayersRef, leafletControlRef } = useMapInstance({
    map: mapInstance,
    L: mods?.L,
  });

  React.useEffect(() => {
    const map = mapInstance;
    const L = mods?.L;
    if (!map || !L) return;

    const canInitializeNow = () => {
      try {
        const center = map.getCenter?.();
        if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return false;

        const zoom = map.getZoom?.();
        if (!Number.isFinite(zoom)) return false;

        const size = map.getSize?.();
        const x = size?.x;
        const y = size?.y;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        if (x <= 0 || y <= 0) return false;

        return true;
      } catch {
        return false;
      }
    };

    const ensureBaseLayer = () => {
      try {
        if (!canInitializeNow()) return;

        const current = leafletBaseLayerRef.current;
        if (current && map.hasLayer?.(current)) return;

        const baseDef = WEB_MAP_BASE_LAYERS.find((l) => l.defaultEnabled) || WEB_MAP_BASE_LAYERS[0];
        if (!baseDef) return;

        const baseLayer = createLeafletLayer(L, baseDef);
        if (!baseLayer) return;

        leafletBaseLayerRef.current = baseLayer;
        baseLayer.addTo(map);
      } catch (e: any) {
        // noop
        try {
          if (typeof e?.message === 'string' && e.message.includes('infinite number of tiles')) {
            const current = leafletBaseLayerRef.current;
            if (current && map.hasLayer?.(current)) map.removeLayer(current);
            leafletBaseLayerRef.current = null;
          }
        } catch {
          // noop
        }
      }
    };

    ensureBaseLayer();

    const onTry = () => ensureBaseLayer();
    try {
      map.on?.('load', onTry);
      map.on?.('resize', onTry);
      map.on?.('moveend', onTry);
      map.on?.('zoomend', onTry);
    } catch {
      // noop
    }

    return () => {
      try {
        map.off?.('load', onTry);
        map.off?.('resize', onTry);
        map.off?.('moveend', onTry);
        map.off?.('zoomend', onTry);
      } catch {
        // noop
      }
    };
  }, [leafletBaseLayerRef, mapInstance, mods?.L]);

  React.useEffect(() => {
    const map = mapInstance;
    const L = mods?.L;
    if (!map || !L) return;

    const fallbackUrls = [
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
      'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      'https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png',
    ];

    const attachedLayerRef = { current: null as any };

    const attach = (layer: any) => {
      if (!layer || typeof layer.on !== 'function') return () => {};

      const onTileError = () => {
        try {
          if (baseLayerFallbackSwitchingRef.current) return;
          baseLayerFallbackSwitchingRef.current = true;

          const idx = baseLayerFallbackIndexRef.current;
          const nextUrl = fallbackUrls[idx];
          if (!nextUrl) {
            baseLayerFallbackSwitchingRef.current = false;
            return;
          }

          baseLayerFallbackIndexRef.current = idx + 1;

          const nextDef = {
            id: `__fallback_osm_${idx}`,
            title: 'OpenStreetMap (fallback)',
            kind: 'tile',
            url: nextUrl,
            attribution: '&copy; OpenStreetMap contributors',
            defaultEnabled: true,
          } as any;

          const nextLayer = createLeafletLayer(L, nextDef);
          if (!nextLayer) {
            baseLayerFallbackSwitchingRef.current = false;
            return;
          }

          const current = leafletBaseLayerRef.current as any;
          if (current && map.hasLayer?.(current)) {
            map.removeLayer(current);
          }

          leafletBaseLayerRef.current = nextLayer;
          nextLayer.addTo(map);

          try {
            layer.off?.('tileerror', onTileError);
          } catch {
            // noop
          }

          attach(nextLayer);
          baseLayerFallbackSwitchingRef.current = false;
        } catch {
          baseLayerFallbackSwitchingRef.current = false;
        }
      };

      layer.on('tileerror', onTileError);
      return () => {
        try {
          layer.off?.('tileerror', onTileError);
        } catch {
          // noop
        }
      };
    };

    let detach: (() => void) | null = null;

    const ensureAttached = () => {
      const nextLayer: any = leafletBaseLayerRef.current as any;
      if (!nextLayer || nextLayer === attachedLayerRef.current) return;

      try {
        detach?.();
      } catch {
        // noop
      }

      attachedLayerRef.current = nextLayer;
      detach = attach(nextLayer);
    };

    ensureAttached();

    const onTry = () => ensureAttached();
    try {
      map.on?.('layeradd', onTry);
      map.on?.('load', onTry);
      map.on?.('resize', onTry);
    } catch {
      // noop
    }

    return () => {
      try {
        map.off?.('layeradd', onTry);
        map.off?.('load', onTry);
        map.off?.('resize', onTry);
      } catch {
        // noop
      }

      try {
        detach?.();
      } catch {
        // noop
      }
    };
  }, [leafletBaseLayerRef, mapInstance, mods?.L]);

  useMapApi({
    map: mapInstance,
    L: mods?.L,
    onMapUiApiReady,
    travelData: (safePoints ?? []).map((p: any) => ({
      id: Number(p?.id),
      coord: `${Number(p?.latitude)},${Number(p?.longitude)}`,
      address: String(p?.address ?? ''),
    })),
    userLocation: centerOverride ? { lat: centerOverride.lat, lng: centerOverride.lng } : null,
    routePoints: [],
    leafletBaseLayerRef,
    leafletOverlayLayersRef,
    leafletControlRef,
  });

  if (!mods?.MapContainer) {
    return <View style={styles.container} />;
  }

  const effectiveCenterOverride = centerOverride;

  // Вычисляем центр карты
  const center = effectiveCenterOverride
    ? effectiveCenterOverride
    : safePoints.length > 0
      ? {
          lat: safePoints.reduce((sum, p) => sum + p.latitude, 0) / safePoints.length,
          lng: safePoints.reduce((sum, p) => sum + p.longitude, 0) / safePoints.length,
        }
      : { lat: 55.7558, lng: 37.6173 }; // Москва по умолчанию

  const FixSize = () => {
    const map = mods.useMap?.();
    React.useEffect(() => {
      if (!map) return;
      requestAnimationFrame(() => {
        try {
          map.invalidateSize();
        } catch {
          // noop
        }
      });
    }, [map]);
    return null;
  };

  const CenterOnActive = ({ activeId }: { activeId?: number | null }) => {
    const map = mods.useMap?.();

    React.useEffect(() => {
      if (!map) return;
      const id = Number(activeId);
      if (!Number.isFinite(id)) return;

      const target = safePoints.find((p: any) => Number(p?.id) === id);
      if (!target) return;

      try {
        const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 12;
        const nextZoom = Math.max(14, Number.isFinite(currentZoom) ? currentZoom : 14);
        map.setView([target.latitude, target.longitude], nextZoom, { animate: true } as any);
      } catch {
        // noop
      }
    }, [activeId, map]);

    return null;
  };

  const FitOnPoints = ({
    nextPoints,
    centerOverride,
  }: {
    nextPoints: ImportedPoint[]
    centerOverride?: { lat: number; lng: number }
  }) => {
    const map = mods.useMap?.();
    const L = mods.L;

    const key = React.useMemo(() => {
      return nextPoints
        .map((p) => `${p.id}:${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`)
        .join('|');
    }, [nextPoints]);

    React.useEffect(() => {
      if (!map) return;
      if (!L) return;
      if (centerOverride) return;
      if (!nextPoints.length) return;

      try {
        if (nextPoints.length === 1) {
          const p = nextPoints[0];
          map.setView([p.latitude, p.longitude], 14, { animate: true } as any);
        } else {
          const bounds = L.latLngBounds(nextPoints.map((p) => [p.latitude, p.longitude]));
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true } as any);
        }
      } catch {
        // noop
      }
    }, [L, centerOverride, key, map, nextPoints]);

    return null;
  };

  const MapClickHandler = () => {
    mods.useMapEvents?.({
      click: (e: any) => {
        const lat = e?.latlng?.lat;
        const lng = e?.latlng?.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onMapPress?.({ lat, lng });
      },
    });
    return null;
  };

  const MapCenterReporter = () => {
    const map = mods.useMap?.();
    mods.useMapEvents?.({
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
    }, [map]);

    return null;
  };

  const CenterOn = ({ nextCenter }: { nextCenter?: { lat: number; lng: number } }) => {
    const map = mods.useMap?.();

    const lat = nextCenter?.lat;
    const lng = nextCenter?.lng;

    React.useEffect(() => {
      if (!map) return;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      try {
        const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 10;
        const targetZoom = Math.max(12, Number.isFinite(currentZoom) ? currentZoom : 12);
        map.setView([lat, lng], targetZoom, { animate: true } as any);
      } catch {
        // noop
      }

      requestAnimationFrame(() => {
        try {
          map.invalidateSize();
        } catch {
          // noop
        }
      });
    }, [map, lat, lng]);

    return null;
  };

  const MapInstanceBinder = () => {
    const map = mods.useMap?.();
    React.useEffect(() => {
      if (!map) return;
      setMapInstance((prev: any) => (prev === map ? prev : map));
    }, [map]);
    return null;
  };

  return (
    <View style={styles.container}>
      <mods.MapContainer
        center={[center.lat, center.lng]}
        zoom={safePoints.length > 0 ? 10 : 5}
        style={{ height: '100%', width: '100%' }}
      >
        <MapInstanceBinder />
        <FixSize />
        <CenterOn nextCenter={effectiveCenterOverride} />
        <CenterOnActive activeId={activePointId} />
        <FitOnPoints nextPoints={safePoints} centerOverride={effectiveCenterOverride} />
        <MapClickHandler />
        <MapCenterReporter />

        {centerOverride && Number.isFinite(centerOverride.lat) && Number.isFinite(centerOverride.lng) ? (
          <mods.Marker
            key="__user__"
            position={[centerOverride.lat, centerOverride.lng]}
            icon={getMarkerIcon(colors.primary, { active: true })}
          />
        ) : null}

        {(routeLines ?? []).map((r) => {
          if (!mods?.Polyline) return null;
          if (!Array.isArray(r?.line) || r.line.length < 2) return null;
          return (
            <mods.Polyline
              key={`route-${r.id}`}
              positions={r.line}
              pathOptions={{ color: colors.primary, weight: 4, opacity: 0.85 } as any}
            />
          );
        })}

        {pendingMarker && (
          <mods.Marker
            key="__pending__"
            position={[pendingMarker.lat, pendingMarker.lng]}
            icon={getMarkerIcon(pendingMarkerColor)}
          />
        )}

        {safePoints.map((point) => {
          const badgeColor = String(point.color || '').trim() || colors.backgroundTertiary;
          const hasCoords =
            Number.isFinite((point as any)?.latitude) &&
            Number.isFinite((point as any)?.longitude);
          const lat = Number((point as any)?.latitude);
          const lng = Number((point as any)?.longitude);
          const coordsText =
            Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '';
          const categoryLabel = String((point as any)?.category ?? '').trim();
          const colorLabel = String((point as any)?.color ?? '').trim();
          const badgeLabel = hasCoords && categoryLabel ? categoryLabel : colorLabel;
          return (
            <mods.Marker
              key={point.id}
              position={[point.latitude, point.longitude]}
              icon={getMarkerIcon(point.color, { active: Number(activePointId) === Number(point.id) })}
              eventHandlers={{
                click: () => {
                  try {
                    const map = mapInstance;
                    if (map && typeof map.getZoom === 'function' && typeof map.setView === 'function') {
                      const currentZoom = map.getZoom();
                      const nextZoom = Math.max(14, Number.isFinite(currentZoom) ? currentZoom : 14);
                      map.setView([point.latitude, point.longitude], nextZoom, { animate: true } as any);
                    }
                  } catch {
                    // noop
                  }

                  try {
                    const id = Number(point.id);
                    const userLat = Number(centerOverride?.lat);
                    const userLng = Number(centerOverride?.lng);
                    if (!Number.isFinite(id)) return;
                    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return;

                    const cached = driveInfoById[id];
                    if (cached?.status === 'ok' || cached?.status === 'loading') return;

                    setDriveInfoById((prev) => ({ ...prev, [id]: { status: 'loading' } }));

                    const url = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${lng},${lat}?overview=false`;

                    fetch(url)
                      .then((r) => r.json())
                      .then((data) => {
                        const route = Array.isArray(data?.routes) ? data.routes[0] : null;
                        const distanceM = Number(route?.distance);
                        const durationS = Number(route?.duration);
                        if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) {
                          setDriveInfoById((prev) => ({ ...prev, [id]: { status: 'error' } }));
                          return;
                        }

                        const distanceKm = Math.round((distanceM / 1000) * 10) / 10;
                        const durationMin = Math.max(1, Math.round(durationS / 60));
                        setDriveInfoById((prev) => ({
                          ...prev,
                          [id]: { status: 'ok', distanceKm, durationMin },
                        }));
                      })
                      .catch(() => {
                        setDriveInfoById((prev) => ({ ...prev, [id]: { status: 'error' } }));
                      });
                  } catch {
                    // noop
                  }

                  onPointPress?.(point);
                },
              }}
            >
              <mods.Popup>
                <div
                  style={{
                    width: 280,
                    maxWidth: '70vw',
                    height: 220,
                    maxHeight: '40vh',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    paddingRight: 6,
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <strong
                      style={{
                        display: 'block',
                        lineHeight: 1.2,
                        flex: 1,
                        minWidth: 0,
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      {point.name}
                    </strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <div
                        role="button"
                        tabIndex={0}
                        title="Редактировать"
                        aria-label="Редактировать"
                        data-card-action="true"
                        onClick={(e: any) => {
                          try {
                            e?.preventDefault?.();
                            e?.stopPropagation?.();
                          } catch {
                            // noop
                          }
                          onEditPoint?.(point);
                        }}
                        onKeyDown={(e: any) => {
                          if (e?.key !== 'Enter' && e?.key !== ' ') return;
                          try {
                            e?.preventDefault?.();
                            e?.stopPropagation?.();
                          } catch {
                            // noop
                          }
                          onEditPoint?.(point);
                        }}
                        style={{
                          border: `1px solid ${colors.border}`,
                          background: colors.surface,
                          color: colors.text,
                          borderRadius: 10,
                          width: 34,
                          height: 34,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Feather name="edit-2" size={16} color={colors.text} />
                      </div>
                      <div
                        role="button"
                        tabIndex={0}
                        title="Удалить"
                        aria-label="Удалить"
                        data-card-action="true"
                        onClick={(e: any) => {
                          try {
                            e?.preventDefault?.();
                            e?.stopPropagation?.();
                          } catch {
                            // noop
                          }
                          onDeletePoint?.(point);
                        }}
                        onKeyDown={(e: any) => {
                          if (e?.key !== 'Enter' && e?.key !== ' ') return;
                          try {
                            e?.preventDefault?.();
                            e?.stopPropagation?.();
                          } catch {
                            // noop
                          }
                          onDeletePoint?.(point);
                        }}
                        style={{
                          border: `1px solid ${colors.border}`,
                          background: colors.surface,
                          color: colors.text,
                          borderRadius: 10,
                          width: 34,
                          height: 34,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Feather name="trash-2" size={16} color={colors.text} />
                      </div>
                    </div>
                  </div>

                  {point.description ? (
                    <p
                      style={{
                        margin: '8px 0 0 0',
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      {point.description}
                    </p>
                  ) : null}

                  {point.address ? (
                    <p
                      style={{
                        margin: '8px 0 0 0',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      <small>{point.address}</small>
                    </p>
                  ) : null}

                  {coordsText ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              color: colors.textMuted,
                              lineHeight: 1.2,
                              overflowWrap: 'anywhere',
                              wordBreak: 'break-word',
                            }}
                          >
                            {coordsText}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <div
                            role="button"
                            tabIndex={0}
                            title="Копировать координаты"
                            aria-label="Копировать координаты"
                            data-card-action="true"
                            onClick={(e: any) => {
                              try {
                                e?.preventDefault?.();
                                e?.stopPropagation?.();
                              } catch {
                                // noop
                              }
                              try {
                                ;(navigator as any)?.clipboard?.writeText?.(coordsText);
                              } catch {
                                // noop
                              }
                            }}
                            onKeyDown={(e: any) => {
                              if (e?.key !== 'Enter' && e?.key !== ' ') return;
                              try {
                                e?.preventDefault?.();
                                e?.stopPropagation?.();
                              } catch {
                                // noop
                              }
                              try {
                                ;(navigator as any)?.clipboard?.writeText?.(coordsText);
                              } catch {
                                // noop
                              }
                            }}
                            style={{
                              border: `1px solid ${colors.border}`,
                              background: colors.surface,
                              color: colors.text,
                              borderRadius: 10,
                              width: 34,
                              height: 34,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Feather name="copy" size={16} color={colors.text} />
                          </div>

                          <div
                            role="button"
                            tabIndex={0}
                            title="Открыть в картах"
                            aria-label="Открыть в картах"
                            data-card-action="true"
                            onClick={(e: any) => {
                              try {
                                e?.preventDefault?.();
                                e?.stopPropagation?.();
                              } catch {
                                // noop
                              }

                              try {
                                const apple = `https://maps.apple.com/?q=${encodeURIComponent(coordsText)}`;
                                const google = `https://www.google.com/maps?q=${encodeURIComponent(coordsText)}`;
                                const isApple = /Mac|iPhone|iPad|iPod/i.test((navigator as any)?.userAgent ?? '');
                                window.open(isApple ? apple : google, '_blank', 'noopener,noreferrer');
                              } catch {
                                // noop
                              }
                            }}
                            onKeyDown={(e: any) => {
                              if (e?.key !== 'Enter' && e?.key !== ' ') return;
                              try {
                                e?.preventDefault?.();
                                e?.stopPropagation?.();
                              } catch {
                                // noop
                              }
                              try {
                                const apple = `https://maps.apple.com/?q=${encodeURIComponent(coordsText)}`;
                                const google = `https://www.google.com/maps?q=${encodeURIComponent(coordsText)}`;
                                const isApple = /Mac|iPhone|iPad|iPod/i.test((navigator as any)?.userAgent ?? '');
                                window.open(isApple ? apple : google, '_blank', 'noopener,noreferrer');
                              } catch {
                                // noop
                              }
                            }}
                            style={{
                              border: `1px solid ${colors.border}`,
                              background: colors.surface,
                              color: colors.text,
                              borderRadius: 10,
                              width: 34,
                              height: 34,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Feather name="map" size={16} color={colors.text} />
                          </div>

                          <div
                            role="button"
                            tabIndex={0}
                            title="Поделиться в Telegram"
                            aria-label="Поделиться в Telegram"
                            data-card-action="true"
                            onClick={(e: any) => {
                              try {
                                e?.preventDefault?.();
                                e?.stopPropagation?.();
                              } catch {
                                // noop
                              }

                              try {
                                const text = String(point?.name ?? '') || coordsText;
                                const url = `https://www.google.com/maps?q=${encodeURIComponent(coordsText)}`;
                                const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
                                window.open(tg, '_blank', 'noopener,noreferrer');
                              } catch {
                                // noop
                              }
                            }}
                            onKeyDown={(e: any) => {
                              if (e?.key !== 'Enter' && e?.key !== ' ') return;
                              try {
                                e?.preventDefault?.();
                                e?.stopPropagation?.();
                              } catch {
                                // noop
                              }

                              try {
                                const text = String(point?.name ?? '') || coordsText;
                                const url = `https://www.google.com/maps?q=${encodeURIComponent(coordsText)}`;
                                const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
                                window.open(tg, '_blank', 'noopener,noreferrer');
                              } catch {
                                // noop
                              }
                            }}
                            style={{
                              border: `1px solid ${colors.border}`,
                              background: colors.surface,
                              color: colors.text,
                              borderRadius: 10,
                              width: 34,
                              height: 34,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Feather name="send" size={16} color={colors.text} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {(() => {
                    const id = Number(point.id);
                    const info = Number.isFinite(id) ? driveInfoById[id] : undefined;
                    if (!info) return null;

                    if (info.status === 'loading') {
                      return (
                        <div style={{ marginTop: 8, fontSize: 12, color: colors.textMuted }}>
                          На машине: расчёт...
                        </div>
                      );
                    }

                    if (info.status === 'error') {
                      return (
                        <div style={{ marginTop: 8, fontSize: 12, color: colors.textMuted }}>
                          На машине: не удалось рассчитать
                        </div>
                      );
                    }

                    return (
                      <div style={{ marginTop: 8, fontSize: 12, color: colors.textMuted }}>
                        На машине: {info.distanceKm} км · ~{info.durationMin} мин
                      </div>
                    );
                  })()}

                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}
                  >
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: badgeColor,
                        color: colors.textOnPrimary,
                        fontSize: '12px',
                      }}
                    >
                      {badgeLabel}
                    </div>
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: colors.backgroundTertiary,
                        color: colors.textMuted,
                        fontSize: '12px',
                      }}
                    >
                      {STATUS_LABELS[point.status]}
                    </div>
                  </div>
                </div>
              </mods.Popup>
            </mods.Marker>
          );
        })}
      </mods.MapContainer>
    </View>
  );
};

// Native версия (заглушка, можно добавить react-native-maps позже)
const PointsMapNative: React.FC<PointsMapProps> = ({
  points,
  center,
  activePointId,
  onPointPress,
  onMapPress,
  pendingMarker,
  pendingMarkerColor,
  routeLines,
}) => {
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const mapRef = React.useRef<any>(null);

  const nativeMaps = React.useMemo(() => {
    if (Platform.OS === 'web') return null;
    try {
      const m = require('react-native-maps');
      return {
        MapView: m?.default ?? m,
        Marker: m?.Marker,
        Polyline: m?.Polyline,
      } as any;
    } catch {
      return null;
    }
  }, []);

  const safePoints = React.useMemo(() => {
    return (points ?? [])
      .map((p: any) => {
        const lat = Number(p?.latitude);
        const lng = Number(p?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { ...(p as any), latitude: lat, longitude: lng } as ImportedPoint;
      })
      .filter((p: any): p is ImportedPoint => p != null);
  }, [points]);

  const defaultCenter = React.useMemo(() => {
    if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
      return { lat: center.lat, lng: center.lng };
    }

    if (safePoints.length > 0) {
      return {
        lat: safePoints.reduce((sum, p) => sum + p.latitude, 0) / safePoints.length,
        lng: safePoints.reduce((sum, p) => sum + p.longitude, 0) / safePoints.length,
      };
    }

    return { lat: 55.7558, lng: 37.6173 };
  }, [center, safePoints]);

  const initialRegion: Region = React.useMemo(
    () => ({
      latitude: defaultCenter.lat,
      longitude: defaultCenter.lng,
      latitudeDelta: 0.25,
      longitudeDelta: 0.25,
    }),
    [defaultCenter.lat, defaultCenter.lng]
  );

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
      map.animateToRegion(
        {
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: 0.2,
          longitudeDelta: 0.2,
        },
        400
      );
      return;
    }

    if (safePoints.length === 1) {
      const p = safePoints[0];
      map.animateToRegion(
        {
          latitude: p.latitude,
          longitude: p.longitude,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        },
        400
      );
      return;
    }

    if (safePoints.length > 1) {
      try {
        map.fitToCoordinates(
          safePoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
          {
            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
            animated: true,
          }
        );
      } catch {
        // noop
      }
    }
  }, [center, safePoints]);

  if (!nativeMaps?.MapView || !nativeMaps?.Marker || !nativeMaps?.Polyline) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholder} />
      </View>
    );
  }

  const MapView = nativeMaps.MapView as any;
  const Marker = nativeMaps.Marker as any;
  const Polyline = nativeMaps.Polyline as any;

  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <MapView
          ref={(r: any) => {
            mapRef.current = r;
          }}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          onPress={(e: any) => {
            const coord = e?.nativeEvent?.coordinate;
            const lat = coord?.latitude;
            const lng = coord?.longitude;
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            onMapPress?.({ lat, lng });
          }}
        >
          {(routeLines ?? []).map((r) => {
            const coords = Array.isArray(r?.line) ? r.line : [];
            if (coords.length < 2) return null;
            const line = coords
              .map((c: any) => {
                const lat = Number(c?.[0]);
                const lng = Number(c?.[1]);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                return { latitude: lat, longitude: lng };
              })
              .filter((v: any) => v != null);
            if (line.length < 2) return null;

            return (
              <Polyline
                key={`route-${r.id}`}
                coordinates={line as any}
                strokeColor={colors.primary}
                strokeWidth={4}
              />
            );
          })}

          {pendingMarker && Number.isFinite(pendingMarker.lat) && Number.isFinite(pendingMarker.lng) ? (
            <Marker
              key="__pending__"
              coordinate={{ latitude: pendingMarker.lat, longitude: pendingMarker.lng }}
              pinColor={String(pendingMarkerColor || colors.primary)}
            />
          ) : null}

          {safePoints.map((p) => {
            const isActive = Number(activePointId) === Number(p.id);
            return (
              <Marker
                key={String(p.id)}
                coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                pinColor={isActive ? colors.primary : String(p.color || colors.backgroundTertiary)}
                onPress={() => onPointPress?.(p)}
              />
            );
          })}
        </MapView>
      </View>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
