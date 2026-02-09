// leafletFix is imported by individual map components (Map.web.tsx, WebMapComponent.tsx, etc.)
// and useLeafletLoader.ts — no need to load Leaflet eagerly on every page.

// Anchor modules that are only used in async chunks so Metro's chunk splitter
// includes them in the entry bundle. Without this, Metro may drop them entirely
// from the production build, causing "Requiring unknown module" runtime errors.
import '@/hooks/useLeafletLoader';
import '@/hooks/useMapMarkers';

const RootLayout = require('./_layout.tsx').default

export default RootLayout
