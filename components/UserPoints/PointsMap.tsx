import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
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

    try {
      const current = leafletBaseLayerRef.current;
      if (current && map.hasLayer?.(current)) return;

      const baseDef = WEB_MAP_BASE_LAYERS.find((l) => l.defaultEnabled) || WEB_MAP_BASE_LAYERS[0];
      if (!baseDef) return;

      const baseLayer = createLeafletLayer(L, baseDef);
      if (!baseLayer) return;

      leafletBaseLayerRef.current = baseLayer;
      baseLayer.addTo(map);
    } catch {
      // noop
    }
  }, [leafletBaseLayerRef, mapInstance, mods?.L]);

  React.useEffect(() => {
    const map = mapInstance;
    const L = mods?.L;
    if (!map || !L) return;

    const fallbackUrls = [
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    ];

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

    const initialLayer: any = leafletBaseLayerRef.current as any;
    const detach = attach(initialLayer);
    return () => {
      detach?.();
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

  const effectiveCenterOverride = safePoints.length > 0 ? undefined : centerOverride;

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

  return (
    <View style={styles.container}>
      <mods.MapContainer
        center={[center.lat, center.lng]}
        zoom={safePoints.length > 0 ? 10 : 5}
        style={{ height: '100%', width: '100%' }}
        whenCreated={(map: any) => {
          setMapInstance(map);
        }}
      >
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
          const categoryLabel = String((point as any)?.category ?? '').trim();
          const colorLabel = String((point as any)?.color ?? '').trim();
          const badgeLabel = hasCoords && categoryLabel ? categoryLabel : colorLabel;
          return (
            <mods.Marker
              key={point.id}
              position={[point.latitude, point.longitude]}
              icon={getMarkerIcon(point.color, { active: Number(activePointId) === Number(point.id) })}
              eventHandlers={{
                click: () => onPointPress?.(point),
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
const PointsMapNative: React.FC<PointsMapProps> = ({ points: _points }) => {
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        {/* Здесь можно добавить react-native-maps */}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
});
