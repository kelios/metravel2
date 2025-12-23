export type LeafletNS = any;
export type ReactLeafletNS = typeof import('react-leaflet');

const LEAFLET_CSS_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_SRC = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

let leafletPromise: Promise<LeafletNS> | null = null;
let reactLeafletPromise: Promise<ReactLeafletNS> | null = null;

const isTestEnv = () =>
  typeof process !== 'undefined' &&
  (process as any).env &&
  (process as any).env.NODE_ENV === 'test';

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

  const origins = ['https://unpkg.com'];
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
  if (w.L) return w.L;

  // In tests we mock/alias Leaflet; avoid waiting for CDN.
  if (isTestEnv()) {
    try {
      const req = (0, eval)('require') as NodeRequire;
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
      return L;
    });
  }

  return leafletPromise;
};

export const ensureReactLeaflet = async (): Promise<ReactLeafletNS> => {
  if (reactLeafletPromise) return reactLeafletPromise;
  reactLeafletPromise = import('react-leaflet');
  return reactLeafletPromise;
};

export const ensureLeafletAndReactLeaflet = async (): Promise<{ L: LeafletNS; rl: ReactLeafletNS }> => {
  const L = await ensureLeaflet();
  const rl = await ensureReactLeaflet();
  return { L, rl };
};
