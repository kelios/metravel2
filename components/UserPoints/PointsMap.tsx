import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ImportedPoint } from '@/types/userPoints';
import type { PointColor } from '@/types/userPoints';
import { STATUS_LABELS } from '@/types/userPoints';
import { ensureLeafletAndReactLeaflet } from '@/src/utils/leafletWebLoader';
import { useThemedColors } from '@/hooks/useTheme';

interface PointsMapProps {
  points: ImportedPoint[];
  center?: { lat: number; lng: number };
  onPointPress?: (point: ImportedPoint) => void;
  onEditPoint?: (point: ImportedPoint) => void;
  onDeletePoint?: (point: ImportedPoint) => void;
  onMapPress?: (coords: { lat: number; lng: number }) => void;
  pendingMarker?: { lat: number; lng: number } | null;
  pendingMarkerColor?: PointColor;
}

export const PointsMap: React.FC<PointsMapProps> = ({
  points,
  center,
  onPointPress,
  onEditPoint,
  onDeletePoint,
  onMapPress,
  pendingMarker,
  pendingMarkerColor,
}) => {
  // Для web используем react-leaflet, для mobile - react-native-maps
  if (Platform.OS === 'web') {
    return (
      <PointsMapWeb
        points={points}
        center={center}
        onPointPress={onPointPress}
        onEditPoint={onEditPoint}
        onDeletePoint={onDeletePoint}
        onMapPress={onMapPress}
        pendingMarker={pendingMarker}
        pendingMarkerColor={pendingMarkerColor}
      />
    );
  }
  
  return (
    <PointsMapNative
      points={points}
      center={center}
      onPointPress={onPointPress}
      onEditPoint={onEditPoint}
      onDeletePoint={onDeletePoint}
      onMapPress={onMapPress}
      pendingMarker={pendingMarker}
      pendingMarkerColor={pendingMarkerColor}
    />
  );
};

// Web версия с Leaflet
const PointsMapWeb: React.FC<PointsMapProps> = ({
  points,
  center: centerOverride,
  onPointPress,
  onEditPoint,
  onDeletePoint,
  onMapPress,
  pendingMarker,
  pendingMarkerColor,
}) => {
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [mods, setMods] = React.useState<{
    L: any;
    MapContainer: any;
    TileLayer: any;
    Marker: any;
    Popup: any;
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
        TileLayer: (rl as any).TileLayer,
        Marker: (rl as any).Marker,
        Popup: (rl as any).Popup,
        useMap: (rl as any).useMap,
        useMapEvents: (rl as any).useMapEvents,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const getMarkerIcon = React.useCallback(
    (color: PointColor | string | undefined) => {
      const L = mods?.L;
      if (!L) return undefined;

      const fill = String(color || '').trim() || colors.primary;

      const html = `
        <div style="width:28px;height:28px;position:relative;transform:translate(-14px,-28px);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 22s7-4.5 7-12a7 7 0 0 0-14 0c0 7.5 7 12 7 12Z" fill="${fill}" stroke="${colors.border}" stroke-width="1" />
            <circle cx="12" cy="10" r="3" fill="${colors.surface}" opacity="0.95" />
          </svg>
        </div>
      `;

      return L.divIcon({
        html,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -26],
      });
    },
    [colors.border, colors.primary, colors.surface, mods?.L]
  );

  if (!mods?.MapContainer || !mods?.TileLayer) {
    return <View style={styles.container} />;
  }

  // Вычисляем центр карты
  const center = centerOverride
    ? centerOverride
    : points.length > 0
      ? {
          lat: points.reduce((sum, p) => sum + p.latitude, 0) / points.length,
          lng: points.reduce((sum, p) => sum + p.longitude, 0) / points.length,
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
        zoom={points.length > 0 ? 10 : 5}
        style={{ height: '100%', width: '100%' }}
      >
        <FixSize />
        <CenterOn nextCenter={centerOverride} />
        <FitOnPoints nextPoints={points} centerOverride={centerOverride} />
        <MapClickHandler />
        <mods.TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {pendingMarker && (
          <mods.Marker
            key="__pending__"
            position={[pendingMarker.lat, pendingMarker.lng]}
            icon={getMarkerIcon(pendingMarkerColor)}
          />
        )}

        {points.map((point) => {
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
              icon={getMarkerIcon(point.color)}
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
                      <button
                        type="button"
                        title="Редактировать"
                        aria-label="Редактировать"
                        onClick={(e: any) => {
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
                      </button>
                      <button
                        type="button"
                        title="Удалить"
                        aria-label="Удалить"
                        onClick={(e: any) => {
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
                      </button>
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
