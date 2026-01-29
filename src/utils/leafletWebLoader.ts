export type LeafletNS = any;
export type ReactLeafletNS = typeof import('react-leaflet');

const LEAFLET_CSS_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_SRC = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

let leafletPromise: Promise<LeafletNS> | null = null;
let reactLeafletPromise: Promise<ReactLeafletNS> | null = null;
let reactLeafletModule: ReactLeafletNS | null = null;

const isTestEnv = () =>
  typeof process !== 'undefined' &&
  (process as any).env &&
  (process as any).env.NODE_ENV === 'test';

const patchLeafletLatLngGuards = (L: any) => {
   if (!L) return;
   if ((L as any).__metravelCirclePatched) return;

   const patchCtor = (Ctor: any) => {
     const proto = Ctor?.prototype;
     const originalProject = proto?._project;
     if (!proto || typeof originalProject !== 'function') return;

     const originalUpdatePath = proto?._updatePath;
     const originalUpdateCircle = proto?._updateCircle;
     const originalUpdateBounds = proto?._updateBounds;

     proto._project = function patchedProject(this: any) {
       const ll = this?._latlng;
       const lat = ll?.lat;
       const lng = ll?.lng;
       const map = this?._map;
       const zoom =
         typeof map?.getZoom === 'function'
           ? map.getZoom()
           : map?._zoom;
       const valid =
         Number.isFinite(lat) &&
         Number.isFinite(lng) &&
         lat >= -90 &&
         lat <= 90 &&
         lng >= -180 &&
         lng <= 180;

       const mRadius = this?._mRadius;
       const pxRadius = this?._radius;
       const hasInvalidRadius =
         (mRadius != null && !Number.isFinite(mRadius)) ||
         (pxRadius != null && !Number.isFinite(pxRadius));

       if (!valid || hasInvalidRadius) {
         try {
           this?._map?.removeLayer?.(this);
         } catch {
           // noop
         }
         return;
       }

       if (!map || map?._loaded === false || !Number.isFinite(zoom)) {
         return;
       }

       try {
         return originalProject.apply(this, arguments as any);
       } catch {
         try {
           this?._map?.removeLayer?.(this);
         } catch {
           // noop
         }
         return;
       }
     };

     if (typeof originalUpdatePath === 'function') {
       proto._updatePath = function patchedUpdatePath(this: any) {
         if (!this?._point) return;
         try {
           return originalUpdatePath.apply(this, arguments as any);
         } catch {
           return;
         }
       };
     }

     if (typeof originalUpdateCircle === 'function') {
       proto._updateCircle = function patchedUpdateCircle(this: any) {
         if (!this?._point) return;
         try {
           return originalUpdateCircle.apply(this, arguments as any);
         } catch {
           return;
         }
       };
     }

     if (typeof originalUpdateBounds === 'function') {
       proto._updateBounds = function patchedUpdateBounds(this: any) {
         const pt = this?._point;
         if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
         try {
           return originalUpdateBounds.apply(this, arguments as any);
         } catch {
           return;
         }
       };
     }
   };

   try {
     patchCtor((L as any).Circle);
     patchCtor((L as any).CircleMarker);
   } catch {
     // noop
   }

   (L as any).__metravelCirclePatched = true;
 };

export const ensureLeafletCSS = () => {
  if (typeof document === 'undefined') return;

  // Prefer a stable marker attribute so repeated callers don't add duplicates.
  if (document.querySelector('link[data-leaflet-css="1"]')) return;

  const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((l) =>
    (l as HTMLLinkElement).href.includes(LEAFLET_CSS_HREF)
  );

  if (exists) {
    // If Leaflet CSS is present but not marked, mark the first match.
    const link = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find((l) =>
      (l as HTMLLinkElement).href.includes(LEAFLET_CSS_HREF)
    ) as HTMLLinkElement | undefined;
    if (link) link.setAttribute('data-leaflet-css', '1');
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS_HREF;
  link.setAttribute('data-leaflet-css', '1');
  document.head.appendChild(link);
};

export const preconnectLeafletOrigins = () => {
  if (typeof document === 'undefined') return;

  const origins = ['https://unpkg.com', 'https://esm.sh'];
  origins.forEach((origin) => {
    if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
};

export const ensureLeaflet = async (): Promise<LeafletNS> => {
  if (typeof window === 'undefined') return null;

  const w = window as any;
  if (w.L) {
    patchLeafletLatLngGuards(w.L);
    return w.L;
  }

  // In tests we mock/alias Leaflet; avoid waiting for CDN.
  if (isTestEnv()) {
    try {
      const req: NodeRequire = eval('require');
      const leafletMod = req('leaflet');
      w.L = leafletMod?.default ?? leafletMod;
      return w.L;
    } catch {
      return null;
    }
  }

  ensureLeafletCSS();
  preconnectLeafletOrigins();

  if (!leafletPromise) {
    // NOTE: In this repo Metro aliases 'leaflet' to a stub for web. Importing it here
    // would resolve to the stub and produce an incomplete Leaflet namespace.
    // Load the real Leaflet UMD build via script tag and expose it as window.L.
    leafletPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[data-leaflet-js="1"]`) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e));
        return;
      }

      const script = document.createElement('script');
      script.src = LEAFLET_JS_SRC;
      script.async = true;
      script.setAttribute('data-leaflet-js', '1');
      script.onload = () => resolve();
      script.onerror = (err) => {
        leafletPromise = null;
        reject(err);
      };
      document.body.appendChild(script);
    }).then(() => {
      const L = (window as any).L;
      w.L = L;
      patchLeafletLatLngGuards(L);
      return L;
    });
  }

  return leafletPromise;
};

export const ensureReactLeaflet = async (): Promise<ReactLeafletNS> => {
  if (reactLeafletModule) return reactLeafletModule;
  
  // Check if already loaded on window
  if (typeof window !== 'undefined' && (window as any).__reactLeaflet) {
    reactLeafletModule = (window as any).__reactLeaflet;
    return reactLeafletModule;
  }
  
  if (reactLeafletPromise) return reactLeafletPromise;
  
  reactLeafletPromise = (async () => {
    // Ensure Leaflet is loaded first (from CDN)
    const L = await ensureLeaflet();

    // Double-check after await in case another call completed
    if (reactLeafletModule) return reactLeafletModule;

    const w = window as any;
    if (w.__reactLeaflet) {
      reactLeafletModule = w.__reactLeaflet;
      return reactLeafletModule;
    }

    // Expose Leaflet on window (required by react-leaflet)
    if (!w.L && L) {
      w.L = L;
    }

    // Load react-leaflet via Metro dynamic import
    // Handle "Cannot redefine property: default" error during hot-reload
    try {
      let rlModule: any;

      try {
        rlModule = await import('react-leaflet');
      } catch (importErr: any) {
        const errMsg = importErr?.message || String(importErr);

        // If it's the "Cannot redefine property: default" error, the module might
        // already be cached on window from a previous load attempt
        if (errMsg.includes('Cannot redefine property')) {
          // Check if module was actually loaded despite the error
          if (w.__reactLeaflet && w.__reactLeaflet.MapContainer) {
            console.warn('[Leaflet] Recovered from redefine error using cached module');
            reactLeafletModule = w.__reactLeaflet;
            return reactLeafletModule;
          }

          // Try to get it from Metro's module cache via require
          try {
            const requireMod = require('react-leaflet');
            if (requireMod && requireMod.MapContainer) {
              rlModule = requireMod;
            }
          } catch {
            // Ignore require error
          }
        }

        // If we still don't have a module, rethrow
        if (!rlModule) {
          throw importErr;
        }
      }

      // Ensure we have a valid module
      if (!rlModule || typeof rlModule !== 'object') {
        reactLeafletPromise = null;
        throw new Error('Invalid react-leaflet module received');
      }
      
      // Check for essential exports
      if (!rlModule.MapContainer) {
        reactLeafletPromise = null;
        throw new Error('Missing react-leaflet MapContainer export');
      }
      
      reactLeafletModule = rlModule as ReactLeafletNS;
      w.__reactLeaflet = rlModule;

      return rlModule as ReactLeafletNS;
    } catch (err) {
      console.error('[Leaflet] Failed to load react-leaflet:', err);
      reactLeafletPromise = null;
      throw err;
    }
  })();
  
  return reactLeafletPromise;
};

export const ensureLeafletAndReactLeaflet = async (): Promise<{ L: LeafletNS; rl: ReactLeafletNS }> => {
  const L = await ensureLeaflet();
  const rl = await ensureReactLeaflet();
  return { L, rl };
};
