// leafletFix is imported by individual map components (Map.web.tsx, WebMapComponent.tsx, etc.)
// and useLeafletLoader.ts — no need to load Leaflet eagerly on every page.

const RootLayout = require('./_layout.tsx').default

export default RootLayout
