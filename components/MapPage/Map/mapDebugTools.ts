export function installMapDebugTools(map: any, overlayLayersRef: React.MutableRefObject<Map<string, any>>) {
  try {
    const ac = (map as any).attributionControl;
    if (ac && typeof ac.setPrefix === 'function') {
      const prefix = '<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>';
      ac.setPrefix(prefix);
    }
    if (ac && typeof ac.setPosition === 'function') {
      ac.setPosition('bottomright');
    }
  } catch {
    // noop
  }

  try {
    const paneName = 'metravelRoutePane';
    const existing = typeof (map as any).getPane === 'function' ? (map as any).getPane(paneName) : null;
    const pane = existing || (typeof (map as any).createPane === 'function' ? (map as any).createPane(paneName) : null);
    if (pane && pane.style) {
      pane.style.zIndex = '590';
      pane.style.pointerEvents = 'none';
    }
  } catch {
    // noop
  }

  try {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && typeof window !== 'undefined') {
      const dumpRoute = () => {
        try {
          if (typeof document === 'undefined') return { ok: false, reason: 'no-document' };
          const el = document.querySelector('path.metravel-route-line') as SVGPathElement | null;
          const overlayPane = document.querySelector('.leaflet-overlay-pane') as HTMLElement | null;
          const overlaySvg = overlayPane?.querySelector('svg') as SVGSVGElement | null;

          if (!el) {
            return {
              ok: false,
              reason: 'no-path',
              overlayPaneExists: !!overlayPane,
              overlaySvgExists: !!overlaySvg,
              overlayPathCount: overlayPane?.querySelectorAll('path')?.length ?? null,
            };
          }

          const rect = el.getBoundingClientRect();
          let bbox: any = null;
          let totalLength: number | null = null;

          try {
            bbox = typeof el.getBBox === 'function' ? el.getBBox() : null;
          } catch {
            bbox = null;
          }

          try {
            totalLength = typeof el.getTotalLength === 'function' ? Number(el.getTotalLength()) : null;
          } catch {
            totalLength = null;
          }

          let computed: any = null;
          try {
            const s = window.getComputedStyle(el);
            computed = {
              stroke: s.stroke,
              strokeWidth: s.strokeWidth,
              strokeOpacity: (s as any).strokeOpacity,
              opacity: s.opacity,
              display: s.display,
              visibility: s.visibility,
              pointerEvents: (s as any).pointerEvents,
            };
          } catch {
            computed = null;
          }

          return {
            ok: true,
            attrs: {
              class: el.getAttribute('class'),
              dLength: el.getAttribute('d')?.length ?? null,
              stroke: el.getAttribute('stroke'),
              strokeWidth: el.getAttribute('stroke-width'),
              strokeOpacity: el.getAttribute('stroke-opacity'),
              opacity: el.getAttribute('opacity'),
            },
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            bbox,
            totalLength,
            computed,
            overlay: {
              overlayPaneExists: !!overlayPane,
              overlaySvgExists: !!overlaySvg,
              overlayPathCount: overlayPane?.querySelectorAll('path')?.length ?? null,
            },
          };
        } catch (e: any) {
          return { ok: false, reason: 'exception', message: String(e?.message ?? e) };
        }
      };

      const dumpOverlays = () => {
        try {
          const out: any[] = [];
          const entries = Array.from(overlayLayersRef?.current?.entries?.() ?? []);

          for (const [id, layer] of entries) {
            let hasLayer: boolean | null = null;
            try {
              hasLayer = typeof map.hasLayer === 'function' ? Boolean(map.hasLayer(layer)) : null;
            } catch {
              hasLayer = null;
            }

            let tileStats: any = null;
            try {
              const container = layer?.getContainer?.() as HTMLElement | undefined;
              if (container && typeof container.querySelectorAll === 'function') {
                const imgs = container.querySelectorAll('img.leaflet-tile');
                const loaded = container.querySelectorAll('img.leaflet-tile-loaded');
                tileStats = {
                  imgCount: imgs.length,
                  loadedCount: loaded.length,
                  containerZIndex: typeof window.getComputedStyle === 'function' ? window.getComputedStyle(container).zIndex : null,
                  containerOpacity: typeof window.getComputedStyle === 'function'
                    ? window.getComputedStyle(container).opacity
                    : null,
                };
              }
            } catch {
              tileStats = null;
            }

            out.push({
              id,
              hasLayer,
              kindHints: {
                isTileLayer: Boolean(layer?.getTileUrl || layer?._url || layer?.getContainer),
                url: layer?._url ?? null,
                zIndexOption: layer?.options?.zIndex ?? null,
                opacityOption: layer?.options?.opacity ?? null,
              },
              tileStats,
            });
          }

          return { ok: true, count: out.length, overlays: out };
        } catch (e: any) {
          return { ok: false, reason: 'exception', message: String(e?.message ?? e) };
        }
      };

      const dumpMap = () => {
        try {
          const center = map.getCenter?.();
          const zoom = map.getZoom?.();
          const size = map.getSize?.();

          const paneNames = [
            'mapPane',
            'tilePane',
            'overlayPane',
            'shadowPane',
            'markerPane',
            'tooltipPane',
            'popupPane',
            'metravelRoutePane',
          ];
          const panes: Record<string, any> = {};

          for (const name of paneNames) {
            try {
              const p = map.getPane?.(name) as HTMLElement | null | undefined;
              if (!p) {
                panes[name] = null;
                continue;
              }
              const cs = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(p) : null;
              panes[name] = {
                exists: true,
                styleZIndex: (p as any).style?.zIndex ?? null,
                computedZIndex: cs ? cs.zIndex : null,
                pointerEvents: cs ? (cs as any).pointerEvents : null,
                display: cs ? cs.display : null,
                visibility: cs ? cs.visibility : null,
              };
            } catch {
              panes[name] = { exists: false, error: true };
            }
          }

          return {
            ok: true,
            center: center ? { lat: center.lat, lng: center.lng } : null,
            zoom: Number.isFinite(zoom) ? zoom : null,
            size: size ? { x: size.x, y: size.y } : null,
            panes,
          };
        } catch (e: any) {
          return { ok: false, reason: 'exception', message: String(e?.message ?? e) };
        }
      };

      (window as any).__metravelMapDebug = {
        dumpRoute,
        dumpOverlays,
        dumpMap,
        dump: () => ({ map: dumpMap(), route: dumpRoute(), overlays: dumpOverlays() }),
        dumpJson: () => {
          try {
            const payload = { map: dumpMap(), route: dumpRoute(), overlays: dumpOverlays() };
            const seen = new WeakSet<object>();
            return JSON.stringify(
              payload,
              (_k, v) => {
                try {
                  if (v && typeof v === 'object') {
                    if (seen.has(v as object)) return '[Circular]';
                    seen.add(v as object);
                  }
                  if (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement) {
                    const el = v as HTMLElement;
                    return `[HTMLElement ${el.tagName}${el.id ? `#${el.id}` : ''}${el.className ? `.${String(el.className).toString().split(' ').join('.')}` : ''}]`;
                  }
                  if (typeof SVGElement !== 'undefined' && v instanceof SVGElement) {
                    const el = v as SVGElement;
                    return `[SVGElement ${el.tagName}${(el as any).id ? `#${String((el as any).id)}` : ''}]`;
                  }
                  if (typeof v === 'function') return '[Function]';
                  return v;
                } catch {
                  return '[Unserializable]';
                }
              },
              2
            );
          } catch (e: any) {
            return JSON.stringify({ ok: false, reason: 'stringify-failed', message: String(e?.message ?? e) });
          }
        },
        copyDump: async () => {
          try {
            const text = (window as any).__metravelMapDebug?.dumpJson?.();
            if (!text) return { ok: false, reason: 'no-text' };
            if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
              await (navigator as any).clipboard.writeText(text);
              return { ok: true, copied: true, length: String(text).length };
            }
            return { ok: true, copied: false, length: String(text).length, text };
          } catch (e: any) {
            return { ok: false, reason: 'copy-failed', message: String(e?.message ?? e) };
          }
        },
      };
    }
  } catch {
    // noop
  }
}
