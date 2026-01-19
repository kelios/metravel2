import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import type { ImportedPoint } from '@/types/userPoints';
import { COLOR_CATEGORIES, PointColor } from '@/types/userPoints';
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

  const getMarkerColorName = React.useCallback((color: PointColor | undefined): string => {
    switch (color) {
      case PointColor.GREEN:
        return 'green';
      case PointColor.PURPLE:
        return 'violet';
      case PointColor.BROWN:
        return 'orange';
      case PointColor.BLUE:
        return 'blue';
      case PointColor.RED:
        return 'red';
      case PointColor.YELLOW:
        return 'gold';
      case PointColor.GRAY:
        return 'grey';
      default:
        return 'blue';
    }
  }, []);

  const getMarkerIcon = React.useCallback(
    (color: PointColor | undefined) => {
      const L = mods?.L;
      if (!L) return undefined;
      const markerColor = getMarkerColorName(color);
      return new L.Icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
    },
    [getMarkerColorName, mods?.L]
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
          const colorInfo = COLOR_CATEGORIES[point.color];
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
                    paddingRight: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ display: 'block', lineHeight: 1.2 }}>{point.name}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        title="Редактировать"
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
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          lineHeight: '14px',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                        }}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        title="Удалить"
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
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          lineHeight: '14px',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>

                  {point.description ? (
                    <p style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>{point.description}</p>
                  ) : null}

                  {point.address ? (
                    <p style={{ margin: '8px 0 0 0' }}>
                      <small>{point.address}</small>
                    </p>
                  ) : null}

                  <div
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: colorInfo.color,
                      color: colors.textOnPrimary,
                      fontSize: '12px',
                      marginTop: 8,
                    }}
                  >
                    {colorInfo.label}
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
