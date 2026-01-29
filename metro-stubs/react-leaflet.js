/**
 * Stub for react-leaflet on web platform.
 *
 * react-leaflet v5 is loaded via CDN (esm.sh) in leafletWebLoader.ts
 * to avoid Metro bundling issues with ESM modules that cause:
 * "TypeError: Cannot redefine property: default" during hot-reload.
 *
 * This stub throws an error if imported directly (which shouldn't happen).
 * All react-leaflet usage should go through ensureReactLeaflet() from leafletWebLoader.ts.
 */

const STUB_ERROR = new Error(
  '[react-leaflet stub] Direct import of react-leaflet is not supported on web. ' +
  'Use ensureReactLeaflet() from @/src/utils/leafletWebLoader instead.'
);

// Check if react-leaflet was already loaded via CDN
const getFromWindow = () => {
  if (typeof window !== 'undefined' && window.__reactLeaflet) {
    return window.__reactLeaflet;
  }
  return null;
};

// Proxy that returns cached module or throws
const createProxy = () => {
  const cached = getFromWindow();
  if (cached) return cached;

  // Return empty object with getters that check window cache
  return new Proxy({}, {
    get(target, prop) {
      const mod = getFromWindow();
      if (mod && prop in mod) {
        return mod[prop];
      }
      // Common exports that might be accessed before CDN load
      if (prop === 'MapContainer' || prop === 'TileLayer' || prop === 'Marker' ||
          prop === 'Popup' || prop === 'useMap' || prop === 'useMapEvents' ||
          prop === 'Circle' || prop === 'Polyline' || prop === 'Polygon' ||
          prop === 'GeoJSON' || prop === 'LayerGroup' || prop === 'FeatureGroup' ||
          prop === 'ZoomControl' || prop === 'AttributionControl') {
        // Return a placeholder component that will be replaced after CDN load
        return function ReactLeafletPlaceholder() {
          console.warn(`[react-leaflet stub] ${String(prop)} accessed before CDN load`);
          return null;
        };
      }
      if (prop === '__esModule') return true;
      if (prop === 'default') return createProxy();
      if (typeof prop === 'symbol') return undefined;
      return undefined;
    },
    has(target, prop) {
      const mod = getFromWindow();
      if (mod) return prop in mod;
      return false;
    }
  });
};

module.exports = createProxy();
module.exports.default = module.exports;
module.exports.__esModule = true;

// Named exports as proxies
module.exports.MapContainer = function MapContainerStub() { return null; };
module.exports.TileLayer = function TileLayerStub() { return null; };
module.exports.Marker = function MarkerStub() { return null; };
module.exports.Popup = function PopupStub() { return null; };
module.exports.useMap = function useMapStub() { return null; };
module.exports.useMapEvents = function useMapEventsStub() { return null; };
module.exports.Circle = function CircleStub() { return null; };
module.exports.Polyline = function PolylineStub() { return null; };
module.exports.Polygon = function PolygonStub() { return null; };
module.exports.GeoJSON = function GeoJSONStub() { return null; };
module.exports.LayerGroup = function LayerGroupStub() { return null; };
module.exports.FeatureGroup = function FeatureGroupStub() { return null; };
module.exports.ZoomControl = function ZoomControlStub() { return null; };
module.exports.AttributionControl = function AttributionControlStub() { return null; };
