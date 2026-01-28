// Stub for react-leaflet on web
// The real react-leaflet will be loaded dynamically at runtime via ensureReactLeaflet()
// This prevents Metro from bundling it and causing module conflicts with the leaflet stub

module.exports = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof window !== 'undefined' && window.__reactLeaflet) {
        return window.__reactLeaflet[prop];
      }
      // Return empty object for any property access before react-leaflet is loaded
      return undefined;
    },
    has(_target, prop) {
      if (typeof window !== 'undefined' && window.__reactLeaflet) {
        return prop in window.__reactLeaflet;
      }
      return false;
    },
  }
);
