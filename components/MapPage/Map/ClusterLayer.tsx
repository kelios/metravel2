// components/MapPage/map/ClusterLayer.tsx
import React, { useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { strToLatLng, buildClusterKey } from './utils';
import type { Point, ClusterData } from './types';

interface ClusterLayerProps {
  points: Point[];
  Marker: React.ComponentType<any>;
  Popup: React.ComponentType<any>;
  PopupContent: React.ComponentType<{ point: Point }>;
  onMarkerClick?: (point: Point, coords: { lat: number; lng: number }) => void;
  onClusterZoom: (payload: {
    center: [number, number];
    bounds: [[number, number], [number, number]];
    key: string;
    items: Point[];
  }) => void;
  expandedClusterKey?: string | null;
  expandedClusterItems?: Point[] | null;
  markerIcon?: any;
  markerOpacity?: number;
  grid: number;
  renderer?: any;
}

const sanitizeCssValue = (val: string | undefined) => {
  if (!val) return '';
  return val.replace(/[^\w\s#(),.-]/g, '').slice(0, 100);
};

const ClusterLayer: React.FC<ClusterLayerProps> = ({
  points,
  Marker,
  Popup,
  PopupContent,
  onMarkerClick,
  onClusterZoom,
  expandedClusterKey,
  expandedClusterItems,
  markerIcon,
  markerOpacity = 1,
  grid,
  renderer,
}) => {
  const colors = useThemedColors();

  const clusters = useMemo(() => {
    const byCell: Record<string, {
      items: Point[];
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    }> = {};

    points.forEach((p) => {
      const ll = strToLatLng(p.coord);
      if (!ll) return;
      const [lng, lat] = ll;
      const cellLat = Math.floor(lat / grid) * grid;
      const cellLng = Math.floor(lng / grid) * grid;
      const key = `${cellLat.toFixed(3)}|${cellLng.toFixed(3)}`;

      if (!byCell[key]) {
        byCell[key] = { items: [], minLat: lat, maxLat: lat, minLng: lng, maxLng: lng };
      }
      byCell[key].items.push(p);
      byCell[key].minLat = Math.min(byCell[key].minLat, lat);
      byCell[key].maxLat = Math.max(byCell[key].maxLat, lat);
      byCell[key].minLng = Math.min(byCell[key].minLng, lng);
      byCell[key].maxLng = Math.max(byCell[key].maxLng, lng);
    });

    return Object.values(byCell).map((cell): ClusterData => {
      const count = cell.items.length;
      const centerLat = (cell.minLat + cell.maxLat) / 2;
      const centerLng = (cell.minLng + cell.maxLng) / 2;
      if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
        return {
          key: `invalid|${String(count)}`,
          count: 0,
          center: [0, 0],
          bounds: [
            [0, 0],
            [0, 0],
          ],
          items: [],
        };
      }
      const key = buildClusterKey([centerLat, centerLng], count);
      return {
        key,
        count,
        center: [centerLat, centerLng],
        bounds: [
          [cell.minLat, cell.minLng],
          [cell.maxLat, cell.maxLng],
        ],
        items: cell.items,
      };
    });
  }, [points, grid]);

  const clusterIconsCache = useMemo(() => {
    if (!(window as any)?.L?.divIcon) return new Map();

    const cache = new Map();
    const root = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const primary = sanitizeCssValue(
      root?.getPropertyValue('--color-primary')?.trim() || colors.primary
    );
    const textOnDark = sanitizeCssValue(
      root?.getPropertyValue('--color-textOnDark')?.trim() || colors.textOnDark
    );
    const shadow = sanitizeCssValue(
      root?.getPropertyValue('--shadow-medium')?.trim() || colors.boxShadows.medium
    );
    const border = sanitizeCssValue(
      root?.getPropertyValue('--color-border')?.trim() || colors.border
    );
    const boxShadow = shadow || '0 4px 16px rgba(0,0,0,0.35)';
    const borderColor = border || 'rgba(0,0,0,0.1)';
    const badgeColor = primary || '#7a9d8a';
    const badgeTextColor = textOnDark || '#FFFFFF';

    [2, 5, 10, 20, 50, 100, 200].forEach(count => {
      const icon = (window as any).L.divIcon({
        className: 'metravel-cluster-icon',
        html: `
          <div style="
            position: relative;
            width: 56px;
            height: 56px;
            background: #FFFFFF;
            border-radius: 50%;
            border: 1px solid ${borderColor};
            box-shadow: ${boxShadow};
          ">
            <div style="
              position: absolute;
              top: 4px;
              left: 4px;
              width: 48px;
              height: 48px;
              background: ${badgeColor};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                position: absolute;
                width: 40px;
                height: 40px;
                background: rgba(255,255,255,0.15);
                border-radius: 50%;
              "></div>
              <span style="
                position: relative;
                color: ${badgeTextColor};
                font-weight: 800;
                font-size: 18px;
                text-shadow: 0 1px 3px rgba(0,0,0,0.3);
                z-index: 1;
              ">${count}</span>
            </div>
          </div>
        `,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });
      cache.set(count, icon);
    });

    return cache;
  }, [colors]);

  const clusterIcon = useCallback(
    (count: number) => {
      if (!(window as any)?.L?.divIcon) return undefined;

      if (!Number.isFinite(count) || count < 0 || count > 10000) {
        console.warn('[Map] Invalid cluster count:', count);
        return undefined;
      }

      if (clusterIconsCache.has(count)) {
        return clusterIconsCache.get(count);
      }

      const root = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;

      const primary = sanitizeCssValue(
        root?.getPropertyValue('--color-primary')?.trim() || colors.primary
      );
      const textOnDark = sanitizeCssValue(
        root?.getPropertyValue('--color-textOnDark')?.trim() || colors.textOnDark
      );
      const shadow = sanitizeCssValue(
        root?.getPropertyValue('--shadow-medium')?.trim() || colors.boxShadows.medium
      );
      const border = sanitizeCssValue(
        root?.getPropertyValue('--color-border')?.trim() || colors.border
      );
      const boxShadow = shadow || '0 4px 16px rgba(0,0,0,0.35)';
      const borderColor = border || 'rgba(0,0,0,0.1)';
      const badgeColor = primary || '#7a9d8a';
      const badgeTextColor = textOnDark || '#FFFFFF';

      const safeCount = Math.floor(count);

      return (window as any).L.divIcon({
        className: 'metravel-cluster-icon',
        html: `
          <div style="
            position: relative;
            width: 56px;
            height: 56px;
            background: #FFFFFF;
            border-radius: 50%;
            border: 1px solid ${borderColor};
            box-shadow: ${boxShadow};
          ">
            <div style="
              position: absolute;
              top: 4px;
              left: 4px;
              width: 48px;
              height: 48px;
              background: ${badgeColor};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                position: absolute;
                width: 40px;
                height: 40px;
                background: rgba(255,255,255,0.15);
                border-radius: 50%;
              "></div>
              <span style="
                position: relative;
                color: ${badgeTextColor};
                font-weight: 800;
                font-size: 18px;
                text-shadow: 0 1px 3px rgba(0,0,0,0.3);
                z-index: 1;
              ">${safeCount}</span>
            </div>
          </div>
        `,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });
    },
    [colors, clusterIconsCache]
  );

  const handleMarkerClick = useCallback(
    (e: any, point: Point, coords: { lat: number; lng: number }) => {
      // Prevent marker click from being treated as a map click (important in route mode).
      // Leaflet passes the DOM event via `originalEvent`.
      e?.originalEvent?.preventDefault?.();
      e?.originalEvent?.stopPropagation?.();

      onMarkerClick?.(point, coords);
      if (e?.target?.openPopup) {
        setTimeout(() => {
          try {
            e.target.openPopup();
          } catch {
            // noop
          }
        }, 360);
      }
    },
    [onMarkerClick]
  );

  return (
    <>
      {clusters.map((cluster, idx) => {
        if (!Number.isFinite(cluster.center[0]) || !Number.isFinite(cluster.center[1])) return null;

        // Expanded cluster: render individual markers
        if (expandedClusterKey && cluster.key === expandedClusterKey) {
          const items = expandedClusterItems ?? cluster.items;
          return (
            <React.Fragment key={`expanded-${cluster.key}-${idx}`}>
              {items.map((item, itemIdx) => {
                const ll = strToLatLng(item.coord);
                if (!ll) return null;
                if (!Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null;
                const markerKey = item.id
                  ? `cluster-expanded-${cluster.key}-${item.id}`
                  : `cluster-expanded-${cluster.key}-${item.coord.replace(/,/g, '-')}-${itemIdx}`;

                const markerProps: any = {
                  position: [ll[1], ll[0]],
                  icon: markerIcon,
                  opacity: markerOpacity,
                  eventHandlers: {
                    click: (e: any) => handleMarkerClick(e, item, { lat: ll[1], lng: ll[0] }),
                  },
                };
                if (renderer) markerProps.renderer = renderer;

                return (
                  <Marker key={markerKey} {...markerProps}>
                    <Popup>
                      <PopupContent point={item} />
                    </Popup>
                  </Marker>
                );
              })}
            </React.Fragment>
          );
        }

        const icon = clusterIcon(cluster.count);
        if (cluster.count === 1 && cluster.items[0]) {
          const item = cluster.items[0];
          const ll = strToLatLng(item.coord);
          if (!ll) return null;
          if (!Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null;

          const singleMarkerProps: any = {
            position: [ll[1], ll[0]],
            icon: markerIcon,
            opacity: markerOpacity,
            eventHandlers: {
              click: (e: any) => handleMarkerClick(e, item, { lat: ll[1], lng: ll[0] }),
            },
          };
          if (renderer) singleMarkerProps.renderer = renderer;

          return (
            <Marker key={`cluster-single-${idx}`} {...singleMarkerProps}>
              <Popup>
                <PopupContent point={item} />
              </Popup>
            </Marker>
          );
        }

        return (
          <Marker
            key={`cluster-${idx}`}
            position={[cluster.center[0], cluster.center[1]]}
            icon={icon as any}
            eventHandlers={{
              click: (e: any) => {
                e?.originalEvent?.preventDefault?.();
                e?.originalEvent?.stopPropagation?.();
                if (
                  !Number.isFinite(cluster.bounds?.[0]?.[0]) ||
                  !Number.isFinite(cluster.bounds?.[0]?.[1]) ||
                  !Number.isFinite(cluster.bounds?.[1]?.[0]) ||
                  !Number.isFinite(cluster.bounds?.[1]?.[1])
                ) {
                  return;
                }
                onClusterZoom({
                  center: [cluster.center[0], cluster.center[1]],
                  bounds: [
                    [cluster.bounds[0][0], cluster.bounds[0][1]],
                    [cluster.bounds[1][0], cluster.bounds[1][1]],
                  ],
                  key: cluster.key,
                  items: cluster.items,
                });
              },
            }}
          >
            <Popup>
              <View style={{ gap: 6, maxWidth: 260 }}>
                <Text style={{ fontWeight: '800' }}>{cluster.count} мест поблизости</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  Нажмите, чтобы приблизить и раскрыть маркеры
                </Text>
                {cluster.items.slice(0, 6).map((p, i) => (
                  <Text key={`${cluster.key}-item-${i}`} numberOfLines={1} style={{ fontSize: 12 }}>
                    {p.categoryName ? `${p.categoryName}: ` : ''}{p.address || 'Без названия'}
                  </Text>
                ))}
                {cluster.items.length > 6 && (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    …и ещё {cluster.items.length - 6}
                  </Text>
                )}
              </View>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

export default ClusterLayer;
