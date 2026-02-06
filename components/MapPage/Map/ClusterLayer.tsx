// components/MapPage/map/ClusterLayer.tsx
import React, { useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { strToLatLng } from './utils';
import type { Point, ClusterData } from './types';

interface ClusterLayerProps {
  L?: any;
  clusters: ClusterData[];
  Marker: React.ComponentType<any>;
  Popup: React.ComponentType<any>;
  Tooltip?: React.ComponentType<any>;
  PopupContent: React.ComponentType<{ point: Point }>;
  popupProps?: Record<string, unknown>;
  onMarkerClick?: (point: Point, coords: { lat: number; lng: number }) => void;
  onMarkerInstance?: (coord: string, marker: any | null) => void;
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
  renderer?: any;
  hintCenter?: { lat: number; lng: number } | null;
}

const TOOLTIP_MAX_LEN = 30;

const sanitizeCssValue = (val: string | undefined) => {
  if (!val) return '';
  return val.replace(/[^\w\s#(),.-]/g, '').slice(0, 100);
};

const ClusterLayer: React.FC<ClusterLayerProps> = ({
  L,
  clusters,
  Marker,
  Popup,
  Tooltip,
  PopupContent,
  popupProps,
  onMarkerClick,
  onMarkerInstance,
  onClusterZoom,
  expandedClusterKey,
  expandedClusterItems,
  markerIcon,
  markerOpacity = 1,
  renderer,
  hintCenter,
}) => {
  const colors = useThemedColors();

  const safeClusters = useMemo(() => {
    return Array.isArray(clusters) ? clusters : [];
  }, [clusters]);

  const clusterIconsCache = useMemo(() => {
    const leaflet = L ?? (window as any)?.L;
    if (!leaflet?.divIcon) return new Map();

    const cache = new Map();
    const root = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const muted = sanitizeCssValue(
      root?.getPropertyValue('--color-textMuted')?.trim() || colors.textMuted
    );
    const surface = sanitizeCssValue(
      root?.getPropertyValue('--color-surface')?.trim() || colors.surface
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
    const badgeColor = muted || colors.textMuted;
    const badgeTextColor = textOnDark || colors.textOnDark;
    const surfaceColor = surface || colors.surface;

    [2, 5, 10, 20, 50, 100, 200].forEach(count => {
      const icon = leaflet.divIcon({
        className: 'metravel-cluster-icon',
        html: `
          <div style="
            position: relative;
            width: 56px;
            height: 56px;
            background: ${surfaceColor};
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
  }, [L, colors]);

  const clusterIcon = useCallback(
    (count: number, thumbUrl?: string) => {
      const leaflet = L ?? (window as any)?.L;
      if (!leaflet?.divIcon) return undefined;

      if (!Number.isFinite(count) || count < 0 || count > 10000) {
        console.warn('[Map] Invalid cluster count:', count);
        return undefined;
      }

      if (!thumbUrl && clusterIconsCache.has(count)) {
        return clusterIconsCache.get(count);
      }

      const root = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;

      const muted = sanitizeCssValue(
      root?.getPropertyValue('--color-textMuted')?.trim() || colors.textMuted
    );
      const surface = sanitizeCssValue(
        root?.getPropertyValue('--color-surface')?.trim() || colors.surface
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
      const badgeColor = muted || colors.textMuted;
      const badgeTextColor = textOnDark || colors.textOnDark;
      const surfaceColor = surface || colors.surface;

      const safeCount = Math.floor(count);

      const thumbHtml = thumbUrl
        ? `<img src="${thumbUrl}" style="
            position: absolute;
            top: 0; left: 0;
            width: 56px; height: 56px;
            border-radius: 50%;
            object-fit: cover;
          " loading="lazy" alt="" />
          <div style="
            position: absolute;
            top: 0; left: 0;
            width: 56px; height: 56px;
            border-radius: 50%;
            background: rgba(0,0,0,0.35);
          "></div>`
        : '';

      const bgStyle = thumbUrl
        ? `background: transparent;`
        : `background: ${surfaceColor};`;

      const innerBg = thumbUrl
        ? `background: rgba(0,0,0,0.55);`
        : `background: ${badgeColor};`;

      return leaflet.divIcon({
        className: 'metravel-cluster-icon',
        html: `
          <div style="
            position: relative;
            width: 56px;
            height: 56px;
            ${bgStyle}
            border-radius: 50%;
            border: 1px solid ${borderColor};
            box-shadow: ${boxShadow};
            overflow: hidden;
          ">
            ${thumbHtml}
            <div style="
              position: absolute;
              top: 4px;
              left: 4px;
              width: 48px;
              height: 48px;
              ${innerBg}
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
    [L, colors, clusterIconsCache]
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
      {safeClusters.map((cluster, idx) => {
        if (!Number.isFinite(cluster.center[0]) || !Number.isFinite(cluster.center[1])) return null;

        // Expanded cluster: render individual markers
        if (expandedClusterKey && cluster.key === expandedClusterKey) {
          const items = expandedClusterItems ?? cluster.items;
          return (
            <React.Fragment key={`expanded-${cluster.key}-${idx}`}>
              {items.map((item, itemIdx) => {
                const ll = strToLatLng(item.coord, hintCenter);
                if (!ll) return null;
                if (!Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null;
                const markerKey = item.id
                  ? `cluster-expanded-${cluster.key}-${item.id}`
                  : `cluster-expanded-${cluster.key}-${item.coord.replace(/,/g, '-')}-${itemIdx}`;

                const markerProps: any = {
                  position: [ll[1], ll[0]],
                  icon: markerIcon,
                  opacity: markerOpacity,
                  ref: (marker: any) => {
                    try {
                      onMarkerInstance?.(String(item.coord ?? ''), marker ?? null);
                    } catch {
                      // noop
                    }
                  },
                  eventHandlers: {
                    click: (e: any) => handleMarkerClick(e, item, { lat: ll[1], lng: ll[0] }),
                  },
                };
                if (renderer) markerProps.renderer = renderer;

                return (
                  <Marker key={markerKey} {...markerProps}>
                    {Tooltip && item.address && (
                      <Tooltip direction="top" offset={[0, -10]} opacity={0.95} className="metravel-marker-tooltip">
                        {item.address.length > TOOLTIP_MAX_LEN ? item.address.slice(0, TOOLTIP_MAX_LEN) + '…' : item.address}
                      </Tooltip>
                    )}
                    <Popup>
                      <PopupContent point={item} />
                    </Popup>
                  </Marker>
                );
              })}
            </React.Fragment>
          );
        }

        const thumbItem = cluster.items.find(p => p.travelImageThumbUrl);
        const icon = clusterIcon(cluster.count, thumbItem?.travelImageThumbUrl);
        if (cluster.count === 1 && cluster.items[0]) {
          const item = cluster.items[0];
          const ll = strToLatLng(item.coord, hintCenter);
          if (!ll) return null;
          if (!Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null;

          const singleMarkerProps: any = {
            position: [ll[1], ll[0]],
            icon: markerIcon,
            opacity: markerOpacity,
            ref: (marker: any) => {
              try {
                onMarkerInstance?.(String(item.coord ?? ''), marker ?? null);
              } catch {
                // noop
              }
            },
            eventHandlers: {
              click: (e: any) => handleMarkerClick(e, item, { lat: ll[1], lng: ll[0] }),
            },
          };
          if (renderer) singleMarkerProps.renderer = renderer;

          return (
            <Marker key={`cluster-single-${idx}`} {...singleMarkerProps}>
              {Tooltip && item.address && (
                <Tooltip direction="top" offset={[0, -10]} opacity={0.95} className="metravel-marker-tooltip">
                  {item.address.length > TOOLTIP_MAX_LEN ? item.address.slice(0, TOOLTIP_MAX_LEN) + '…' : item.address}
                </Tooltip>
              )}
              <Popup {...(popupProps || {})}>
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
