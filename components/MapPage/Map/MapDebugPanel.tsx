import React from 'react';

import { DESIGN_COLORS } from '@/constants/designSystem';

type MapDebugPanelProps = {
  mode: 'radius' | 'route';
  debugOpen: boolean;
  debugSnapshot: any;
  onRefresh: (reason?: string) => void;
  onCopyJson: () => void;
  onOpen: () => void;
  onClose: () => void;
};

export default function MapDebugPanel({
  mode,
  debugOpen,
  debugSnapshot,
  onRefresh,
  onCopyJson,
  onOpen,
  onClose,
}: MapDebugPanelProps) {
  const payload = debugSnapshot?.payload;
  const mapDump = payload?.map;
  const routeDump = payload?.route;
  const overlaysDump = payload?.overlays;

  const overlayItems: any[] = Array.isArray(overlaysDump?.overlays)
    ? overlaysDump.overlays
    : [];
  const overlayItemsShort = overlayItems.slice(0, 12);

  if (!debugOpen) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 10000,
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          onClick={onOpen}
          style={{
            fontSize: 12,
            padding: '6px 8px',
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.15)',
            backgroundColor: 'rgba(255,255,255,0.92)',
            color: `var(--color-text, ${DESIGN_COLORS.criticalTextLight})`,
          }}
        >
          Map debug
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 10000,
        width: 360,
        maxWidth: 'calc(100vw - 20px)',
        maxHeight: '60vh',
        overflow: 'auto',
        padding: 10,
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.15)',
        backgroundColor: 'rgba(255,255,255,0.92)',
        color: `var(--color-text, ${DESIGN_COLORS.criticalTextLight})`,
        fontSize: 12,
        lineHeight: 1.3,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Map debug</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => onRefresh('manual')}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.15)',
              backgroundColor: 'rgba(255,255,255,0.95)',
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={onCopyJson}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.15)',
              backgroundColor: 'rgba(255,255,255,0.95)',
            }}
          >
            Copy JSON
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.15)',
              backgroundColor: 'rgba(255,255,255,0.95)',
            }}
          >
            Hide
          </button>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <div>
          <b>Mode:</b> {String(mode)}
        </div>
        <div>
          <b>Center/zoom:</b>{' '}
          {mapDump?.center ? `${mapDump.center.lat.toFixed?.(5)}, ${mapDump.center.lng.toFixed?.(5)}` : 'n/a'} @{' '}
          {mapDump?.zoom ?? 'n/a'}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Route</div>
        <div>
          <b>ok:</b> {String(Boolean(routeDump?.ok))}
        </div>
        <div>
          <b>dLength:</b> {routeDump?.attrs?.dLength ?? 'n/a'}
        </div>
        <div>
          <b>rect:</b>{' '}
          {routeDump?.rect ? `${Math.round(routeDump.rect.width)}x${Math.round(routeDump.rect.height)}` : 'n/a'}
        </div>
        <div>
          <b>computed:</b>{' '}
          {routeDump?.computed
            ? `display=${routeDump.computed.display} visibility=${routeDump.computed.visibility} opacity=${routeDump.computed.opacity} strokeWidth=${routeDump.computed.strokeWidth}`
            : 'n/a'}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Panes</div>
        <div>
          <b>tilePane z:</b> {mapDump?.panes?.tilePane?.computedZIndex ?? 'n/a'}
        </div>
        <div>
          <b>overlayPane z:</b> {mapDump?.panes?.overlayPane?.computedZIndex ?? 'n/a'}
        </div>
        <div>
          <b>markerPane z:</b> {mapDump?.panes?.markerPane?.computedZIndex ?? 'n/a'}
        </div>
        <div>
          <b>metravelRoutePane z:</b> {mapDump?.panes?.metravelRoutePane?.computedZIndex ?? 'n/a'}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Overlays</div>
        <div>
          <b>count:</b> {overlaysDump?.count ?? overlayItems.length}
        </div>
        <div style={{ marginTop: 6 }}>
          {overlayItemsShort.map((o) => (
            <div key={String(o?.id)} style={{ marginBottom: 4 }}>
              <b>{String(o?.id)}:</b> hasLayer={String(o?.hasLayer)}{' '}
              {o?.tileStats
                ? `tiles=${o.tileStats.loadedCount ?? 'n/a'}/${o.tileStats.imgCount ?? 'n/a'} z=${o.tileStats.containerZIndex ?? 'n/a'} op=${o.tileStats.containerOpacity ?? 'n/a'}`
                : ''}
            </div>
          ))}
          {overlayItems.length > overlayItemsShort.length && (
            <div style={{ opacity: 0.7 }}>… +{overlayItems.length - overlayItemsShort.length} more</div>
          )}
        </div>
      </div>
    </div>
  );
}
