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
  searchMarker?: { lat: number; lng: number; label?: string } | null;
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

const WebMapInstanceBinder = ({ useMap, onMapReady }: { useMap: any; onMapReady: (map: any) => void }) => {
  const map = useMap?.();
  React.useEffect(() => {
    if (!map) return;
    onMapReady(map);
  }, [map, onMapReady]);
  return null;
};

const PointMarkerWeb = React.memo(
  ({
    mods,
    point,
    isActive,
    colors,
    mapInstance,
    centerOverride,
    driveInfo,
    getMarkerIconCached,
    onPointPress,
    onEditPoint,
    onDeletePoint,
    requestDriveInfo,
    onMarkerReady,
  }: {
    mods: any;
    point: ImportedPoint;
    isActive: boolean;
    colors: ReturnType<typeof useThemedColors>;
    mapInstance: any;
    centerOverride?: { lat: number; lng: number };
    driveInfo?:
      | { status: 'loading' }
      | { status: 'ok'; distanceKm: number; durationMin: number }
      | { status: 'error' };
    getMarkerIconCached: (color: any, opts?: { active?: boolean }) => any;
    onPointPress?: (point: ImportedPoint) => void;
    onEditPoint?: (point: ImportedPoint) => void;
    onDeletePoint?: (point: ImportedPoint) => void;
    requestDriveInfo: (args: { pointId: number; pointLat: number; pointLng: number }) => void;
    onMarkerReady?: (args: { pointId: number; marker: any | null }) => void;
  }) => {
    const hasCoords =
      Number.isFinite((point as any)?.latitude) &&
      Number.isFinite((point as any)?.longitude);
    const lat = Number((point as any)?.latitude);
    const lng = Number((point as any)?.longitude);

    const coordsText = React.useMemo(() => {
      return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '';
    }, [lat, lng]);

    const countryLabel = React.useMemo(() => {
      try {
        const direct = String((point as any)?.country ?? '').trim();
        if (direct) return direct;
        const address = String((point as any)?.address ?? '').trim();
        if (!address) return '';
        const parts = address
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.length >= 2) return parts[parts.length - 1];
        return '';
      } catch {
        return '';
      }
    }, [point]);

    const categoryLabel = React.useMemo(() => {
      const names = (point as any)?.categoryNames;
      if (Array.isArray(names) && names.length > 0) {
        return names.map((v: any) => String(v).trim()).filter(Boolean).join(', ');
      }
      const ids = (point as any)?.categoryIds;
      if (Array.isArray(ids) && ids.length > 0) {
        return ids.map((v: any) => String(v).trim()).filter(Boolean).join(', ');
      }
      return String((point as any)?.category ?? '').trim();
    }, [point]);
    const colorLabel = React.useMemo(() => String((point as any)?.color ?? '').trim(), [point]);
    const markerAccentColor = React.useMemo(
      () => String((point as any)?.color ?? '').trim() || colors.backgroundTertiary,
      [colors.backgroundTertiary, point]
    );
    const badgeLabel = hasCoords && categoryLabel ? categoryLabel : colorLabel;
    const statusLabel = React.useMemo(() => String((STATUS_LABELS as any)?.[(point as any)?.status] ?? '').trim(), [point]);

    const mapLinks = React.useMemo(
      () =>
        ([
          { key: 'Google', url: `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}` },
          { key: 'Apple', url: `https://maps.apple.com/?q=${encodeURIComponent(`${lat},${lng}`)}` },
          { key: 'Яндекс', url: `https://yandex.ru/maps/?pt=${encodeURIComponent(`${lng},${lat}`)}&z=16&l=map` },
          {
            key: 'OSM',
            url: `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lng))}#map=16/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`,
          },
        ] as const),
      [lat, lng]
    );

    const handleMarkerClick = React.useCallback(() => {
      try {
        const map = mapInstance;
        if (map && typeof map.getZoom === 'function' && typeof map.setView === 'function') {
          const currentZoom = map.getZoom();
          const nextZoom = Math.max(14, Number.isFinite(currentZoom) ? currentZoom : 14);
          map.setView([lat, lng], nextZoom, { animate: true } as any);
        }
      } catch {
        // noop
      }

      try {
        const pointId = Number((point as any)?.id);
        const userLat = Number(centerOverride?.lat);
        const userLng = Number(centerOverride?.lng);
        if (!Number.isFinite(pointId)) return;
        if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return;
        if (driveInfo?.status === 'ok' || driveInfo?.status === 'loading') return;
        requestDriveInfo({ pointId, pointLat: lat, pointLng: lng });
      } catch {
        // noop
      }

      onPointPress?.(point);
    }, [centerOverride?.lat, centerOverride?.lng, driveInfo?.status, lat, lng, mapInstance, onPointPress, point, requestDriveInfo]);

    const markerPosition = React.useMemo(() => {
      return [lat, lng] as [number, number];
    }, [lat, lng]);

    const markerIcon = React.useMemo(() => {
      return getMarkerIconCached((point as any)?.color, { active: isActive });
    }, [getMarkerIconCached, isActive, point]);

    const markerEventHandlers = React.useMemo(() => {
      return { click: handleMarkerClick } as any;
    }, [handleMarkerClick]);

    const pointId = React.useMemo(() => Number((point as any)?.id), [point]);
    const markerRefCb = React.useCallback(
      (marker: any | null) => {
        if (!Number.isFinite(pointId)) return;
        onMarkerReady?.({ pointId, marker });
      },
      [onMarkerReady, pointId]
    );

    return (
      <mods.Marker
        ref={markerRefCb as any}
        position={markerPosition}
        icon={markerIcon}
        eventHandlers={markerEventHandlers}
      >
        <mods.Popup>
          <div
            style={{
              width: 300,
              maxWidth: '74vw',
              maxHeight: '44vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: 6,
              paddingLeft: 10,
              boxSizing: 'border-box',
              borderLeft: `4px solid ${markerAccentColor}`,
              borderTopLeftRadius: 10,
              borderBottomLeftRadius: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    lineHeight: '20px',
                    color: colors.text,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {(point as any)?.name}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {statusLabel ? (
                    <div
                      style={{
                        background: colors.primarySoft,
                        border: `1px solid ${colors.borderAccent}`,
                        borderRadius: 999,
                        padding: '6px 10px',
                        fontSize: 12,
                        lineHeight: '14px',
                        color: colors.text,
                        fontWeight: 600,
                      }}
                    >
                      {statusLabel}
                    </div>
                  ) : null}
                  {badgeLabel ? (
                    <div
                      style={{
                        background: colors.backgroundTertiary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 999,
                        padding: '6px 10px',
                        fontSize: 12,
                        lineHeight: '14px',
                        color: colors.textMuted,
                        fontWeight: 600,
                      }}
                    >
                      {badgeLabel}
                    </div>
                  ) : null}
                  {countryLabel ? (
                    <div
                      style={{
                        background: colors.backgroundTertiary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 999,
                        padding: '6px 10px',
                        fontSize: 12,
                        lineHeight: '14px',
                        color: colors.textMuted,
                        fontWeight: 600,
                      }}
                    >
                      {countryLabel}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {typeof onEditPoint === 'function' ? (
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
                      onEditPoint(point);
                    }}
                    onKeyDown={(e: any) => {
                      if (e?.key !== 'Enter' && e?.key !== ' ') return;
                      try {
                        e?.preventDefault?.();
                        e?.stopPropagation?.();
                      } catch {
                        // noop
                      }
                      onEditPoint(point);
                    }}
                    style={{
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      color: colors.text,
                      borderRadius: 12,
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
                ) : null}

                {typeof onDeletePoint === 'function' ? (
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
                      onDeletePoint(point);
                    }}
                    onKeyDown={(e: any) => {
                      if (e?.key !== 'Enter' && e?.key !== ' ') return;
                      try {
                        e?.preventDefault?.();
                        e?.stopPropagation?.();
                      } catch {
                        // noop
                      }
                      onDeletePoint(point);
                    }}
                    style={{
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      color: colors.text,
                      borderRadius: 12,
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
                ) : null}
              </div>
            </div>

            {(point as any)?.description ? (
              <div style={{ marginTop: 10, color: colors.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {(point as any)?.description}
              </div>
            ) : null}

            {(point as any)?.address ? (
              <div style={{ marginTop: 10, color: colors.textMuted, overflowWrap: 'anywhere' }}>
                <span style={{ fontSize: 12, lineHeight: '16px' }}>{(point as any)?.address}</span>
              </div>
            ) : null}

            {(Boolean((point as any)?.address) || Boolean(coordsText)) ? (
              <div
                style={{
                  height: 1,
                  background: colors.border,
                  opacity: 0.8,
                  marginTop: 12,
                  marginBottom: 12,
                }}
              />
            ) : null}

            {coordsText ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div
                    style={{
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      borderRadius: 12,
                      padding: '10px 12px',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: colors.textMuted,
                        lineHeight: 1.2,
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
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
                        borderRadius: 12,
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
                          const text = String((point as any)?.name ?? '') || coordsText;
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
                          const text = String((point as any)?.name ?? '') || coordsText;
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
                        borderRadius: 12,
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

                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                    {mapLinks.map((p) => (
                      <div
                        key={p.key}
                        role="button"
                        tabIndex={0}
                        title={p.key}
                        aria-label={p.key}
                        data-card-action="true"
                        onClick={(e: any) => {
                          try {
                            e?.preventDefault?.();
                            e?.stopPropagation?.();
                          } catch {
                            // noop
                          }
                          try {
                            window.open(p.url, '_blank', 'noopener,noreferrer');
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
                            window.open(p.url, '_blank', 'noopener,noreferrer');
                          } catch {
                            // noop
                          }
                        }}
                        style={{
                          border: `1px solid ${colors.border}`,
                          background: colors.surface,
                          color: colors.text,
                          borderRadius: 999,
                          padding: '4px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: 11,
                          lineHeight: '13px',
                          flexShrink: 0,
                        }}
                      >
                        {p.key}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {Number.isFinite((driveInfo as any)?.distanceKm) ? (
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    height: 1,
                    background: colors.border,
                    opacity: 0.8,
                    marginBottom: 10,
                  }}
                />
                <div style={{ fontSize: 12, color: colors.textMuted }}>
                  На машине: {(driveInfo as any).distanceKm} км · ~{(driveInfo as any).durationMin} мин
                </div>
              </div>
            ) : driveInfo?.status === 'loading' ? (
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    height: 1,
                    background: colors.border,
                    opacity: 0.8,
                    marginBottom: 10,
                  }}
                />
                <div style={{ fontSize: 12, color: colors.textMuted }}>Считаю маршрут…</div>
              </div>
            ) : null}
          </div>
        </mods.Popup>
      </mods.Marker>
    );
  }
);

const WebMapFixSize = ({ useMap }: { useMap: any }) => {
  const map = useMap?.();
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

const WebMapClickHandler = ({ useMapEvents, onMapPress }: { useMapEvents: any; onMapPress?: (c: any) => void }) => {
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

const WebMapCenterReporter = ({
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

export const PointsMap: React.FC<PointsMapProps> = ({
  points,
  center,
  searchMarker,
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
        searchMarker={searchMarker}
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
      searchMarker={searchMarker}
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
  searchMarker,
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

  const driveAbortByIdRef = React.useRef<Map<number, AbortController>>(new Map());
  React.useEffect(() => {
    const controllersById = driveAbortByIdRef.current;
    return () => {
      try {
        for (const c of controllersById.values()) c.abort();
      } catch {
        // noop
      }
      controllersById.clear();
    };
  }, []);

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

  const markerIconCacheRef = React.useRef<Map<string, any>>(new Map());
  React.useEffect(() => {
    markerIconCacheRef.current.clear();
  }, [colors.border, colors.primary, colors.surface, mods?.L]);

  const getMarkerIconCached = React.useCallback(
    (color: PointColor | string | undefined, opts?: { active?: boolean }) => {
      const fill = String(color || '').trim() || colors.primary;
      const active = Boolean(opts?.active);
      const key = `${fill}|${active ? '1' : '0'}`;
      const cached = markerIconCacheRef.current.get(key);
      if (cached) return cached;
      const icon = getMarkerIcon(color, opts);
      if (icon) markerIconCacheRef.current.set(key, icon);
      return icon;
    },
    [colors.primary, getMarkerIcon]
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

  const markerByIdRef = React.useRef<Map<number, any>>(new Map());
  const handleMarkerReady = React.useCallback(({ pointId, marker }: { pointId: number; marker: any | null }) => {
    try {
      if (!Number.isFinite(pointId)) return;
      if (marker) {
        markerByIdRef.current.set(pointId, marker);
      } else {
        markerByIdRef.current.delete(pointId);
      }
    } catch {
      // noop
    }
  }, []);

  const travelData = React.useMemo(() => {
    return (safePoints ?? []).map((p: any) => ({
      id: Number(p?.id),
      coord: `${Number(p?.latitude)},${Number(p?.longitude)}`,
      address: String(p?.address ?? ''),
    }));
  }, [safePoints]);

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
    travelData,
    userLocation: centerOverride ? { lat: centerOverride.lat, lng: centerOverride.lng } : null,
    routePoints: [],
    leafletBaseLayerRef,
    leafletOverlayLayersRef,
    leafletControlRef,
  });

  const effectiveCenterOverride = centerOverride;

  React.useEffect(() => {
    if (!mapInstance) return;
    if (!effectiveCenterOverride) return;
    if (Number.isFinite(Number(activePointId))) return;
    if (safePoints.length > 0) return;
    const lat = effectiveCenterOverride?.lat;
    const lng = effectiveCenterOverride?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    try {
      const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 10;
      const targetZoom = Math.max(12, Number.isFinite(currentZoom) ? currentZoom : 12);
      mapInstance.setView([lat, lng], targetZoom, { animate: true } as any);
    } catch {
      // noop
    }
  }, [activePointId, effectiveCenterOverride, mapInstance, safePoints.length]);

  React.useEffect(() => {
    if (!mapInstance) return;
    const id = Number(activePointId);
    if (!Number.isFinite(id)) return;
    const target = safePoints.find((p: any) => Number(p?.id) === id);
    if (!target) return;

    try {
      const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 12;
      const nextZoom = Math.max(14, Number.isFinite(currentZoom) ? currentZoom : 14);
      mapInstance.setView([target.latitude, target.longitude], nextZoom, { animate: true } as any);
    } catch {
      // noop
    }
  }, [activePointId, mapInstance, safePoints]);

  React.useEffect(() => {
    const id = Number(activePointId);
    if (!Number.isFinite(id)) return;
    const marker = markerByIdRef.current.get(id);
    if (!marker || typeof marker.openPopup !== 'function') return;

    const t = setTimeout(() => {
      try {
        marker.openPopup();
      } catch {
        // noop
      }
    }, 0);

    return () => clearTimeout(t);
  }, [activePointId]);

  React.useEffect(() => {
    if (!mapInstance) return;
    const L = mods?.L;
    if (!L) return;
    if (Number.isFinite(Number(activePointId))) return;
    if (!safePoints.length) return;

    try {
      if (safePoints.length === 1) {
        const p = safePoints[0];
        mapInstance.setView([p.latitude, p.longitude], 14, { animate: true } as any);
      } else {
        const bounds = L.latLngBounds(safePoints.map((p: any) => [p.latitude, p.longitude]));
        mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true } as any);
      }
    } catch {
      // noop
    }
  }, [activePointId, mapInstance, mods?.L, safePoints]);

  // Hooks must run unconditionally (before any return).
  const center = React.useMemo(() => {
    if (effectiveCenterOverride) return effectiveCenterOverride;
    if (safePoints.length > 0) {
      const sum = safePoints.reduce(
        (acc, p) => {
          acc.lat += p.latitude;
          acc.lng += p.longitude;
          return acc;
        },
        { lat: 0, lng: 0 }
      );
      return { lat: sum.lat / safePoints.length, lng: sum.lng / safePoints.length };
    }
    return { lat: 55.7558, lng: 37.6173 };
  }, [effectiveCenterOverride, safePoints]);

  const handleMapReady = React.useCallback(
    (map: any) => {
      setMapInstance((prev: any) => (prev === map ? prev : map));
    },
    [setMapInstance]
  );

  const polylinePathOptions = React.useMemo(() => {
    return { color: colors.primary, weight: 4, opacity: 0.85 } as any;
  }, [colors.primary]);

  const requestDriveInfo = React.useCallback(
    ({ pointId, pointLat, pointLng }: { pointId: number; pointLat: number; pointLng: number }) => {
      try {
        const userLat = Number(centerOverride?.lat);
        const userLng = Number(centerOverride?.lng);
        if (!Number.isFinite(pointId)) return;
        if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return;
        if (!Number.isFinite(pointLat) || !Number.isFinite(pointLng)) return;

        setDriveInfoById((prev) => ({ ...prev, [pointId]: { status: 'loading' } }));

        const url = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${pointLng},${pointLat}?overview=false`;

        try {
          driveAbortByIdRef.current.get(pointId)?.abort();
        } catch {
          // noop
        }
        const controller = new AbortController();
        driveAbortByIdRef.current.set(pointId, controller);

        fetch(url, { signal: controller.signal })
          .then((r) => r.json())
          .then((data) => {
            const route = Array.isArray(data?.routes) ? data.routes[0] : null;
            const distanceM = Number(route?.distance);
            const durationS = Number(route?.duration);
            if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) {
              setDriveInfoById((prev) => ({ ...prev, [pointId]: { status: 'error' } }));
              return;
            }

            const distanceKm = Math.round((distanceM / 1000) * 10) / 10;
            const durationMin = Math.max(1, Math.round(durationS / 60));
            setDriveInfoById((prev) => ({
              ...prev,
              [pointId]: { status: 'ok', distanceKm, durationMin },
            }));
          })
          .catch((e) => {
            if ((e as any)?.name === 'AbortError') return;
            setDriveInfoById((prev) => ({ ...prev, [pointId]: { status: 'error' } }));
          })
          .finally(() => {
            try {
              if (driveAbortByIdRef.current.get(pointId) === controller) {
                driveAbortByIdRef.current.delete(pointId);
              }
            } catch {
              // noop
            }
          });
      } catch {
        // noop
      }
    },
    [centerOverride?.lat, centerOverride?.lng]
  );

  if (!mods?.MapContainer) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <mods.MapContainer
        center={[center.lat, center.lng]}
        zoom={safePoints.length > 0 ? 10 : 5}
        whenCreated={handleMapReady as any}
        style={{ height: '100%', width: '100%' }}
      >
        <WebMapInstanceBinder useMap={mods.useMap} onMapReady={handleMapReady} />
        <WebMapFixSize useMap={mods.useMap} />
        <WebMapClickHandler useMapEvents={mods.useMapEvents} onMapPress={onMapPress} />
        <WebMapCenterReporter useMap={mods.useMap} useMapEvents={mods.useMapEvents} onCenterChange={onCenterChange} />

        {centerOverride && Number.isFinite(centerOverride.lat) && Number.isFinite(centerOverride.lng) ? (
          <mods.Marker
            key="__user__"
            position={[centerOverride.lat, centerOverride.lng]}
            icon={getMarkerIconCached(colors.primary, { active: true })}
          >
            <mods.Popup>
              <div style={{ fontSize: 12, color: colors.text }}>
                <strong>Моё местоположение</strong>
              </div>
            </mods.Popup>
          </mods.Marker>
        ) : null}

        {searchMarker && Number.isFinite(searchMarker.lat) && Number.isFinite(searchMarker.lng) ? (
          <mods.Marker
            key="__search__"
            position={[searchMarker.lat, searchMarker.lng]}
            icon={getMarkerIconCached(colors.primarySoft, { active: true })}
          >
            {String(searchMarker.label || '').trim() ? (
              <mods.Popup>
                <div style={{ fontSize: 12, color: colors.text }}>
                  <strong>{String(searchMarker.label)}</strong>
                </div>
              </mods.Popup>
            ) : null}
          </mods.Marker>
        ) : null}

        {(routeLines ?? []).map((r) => {
          if (!mods?.Polyline) return null;
          if (!Array.isArray(r?.line) || r.line.length < 2) return null;
          return (
            <mods.Polyline
              key={`route-${r.id}`}
              positions={r.line}
              pathOptions={polylinePathOptions}
            />
          );
        })}

        {pendingMarker && (
          <mods.Marker
            key="__pending__"
            position={[pendingMarker.lat, pendingMarker.lng]}
            icon={getMarkerIconCached(pendingMarkerColor)}
          />
        )}

        {safePoints.map((point) => {
          const id = Number((point as any)?.id);
          const driveInfo = Number.isFinite(id) ? driveInfoById[id] : undefined;
          return (
            <PointMarkerWeb
              key={String((point as any)?.id)}
              mods={mods}
              point={point}
              isActive={Number(activePointId) === Number((point as any)?.id)}
              colors={colors}
              mapInstance={mapInstance}
              centerOverride={centerOverride}
              driveInfo={driveInfo}
              getMarkerIconCached={getMarkerIconCached}
              onPointPress={onPointPress}
              onEditPoint={onEditPoint}
              onDeletePoint={onDeletePoint}
              requestDriveInfo={requestDriveInfo}
              onMarkerReady={handleMarkerReady}
            />
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
  searchMarker,
  activePointId,
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

    const activeId = Number(activePointId);
    if (Number.isFinite(activeId)) {
      const target = safePoints.find((p: any) => Number(p?.id) === activeId);
      if (!target) return;
      try {
        map.animateToRegion(
          {
            latitude: target.latitude,
            longitude: target.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          },
          450
        );
      } catch {
        // noop
      }
      return;
    }

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
  }, [activePointId, center, safePoints]);

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

          {center && Number.isFinite(center.lat) && Number.isFinite(center.lng) ? (
            <Marker
              key="__user__"
              coordinate={{ latitude: center.lat, longitude: center.lng }}
              pinColor={colors.primary}
              title="Моё местоположение"
              description="Текущее положение"
            />
          ) : null}

          {searchMarker && Number.isFinite(searchMarker.lat) && Number.isFinite(searchMarker.lng) ? (
            <Marker
              key="__search__"
              coordinate={{ latitude: Number(searchMarker.lat), longitude: Number(searchMarker.lng) }}
              pinColor={colors.primary}
              title={String(searchMarker.label || 'Результат поиска')}
            />
          ) : null}

          {safePoints.map((p) => {
            const isActive = Number(activePointId) === Number(p.id);
            const coordsText =
              Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
                ? `${Number(p.latitude).toFixed(6)}, ${Number(p.longitude).toFixed(6)}`
                : '';
            return (
              <Marker
                key={String(p.id)}
                coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                pinColor={isActive ? colors.primary : String(p.color || colors.backgroundTertiary)}
                title={String(p?.name ?? '')}
                description={coordsText}
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
