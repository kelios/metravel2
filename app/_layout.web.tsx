// leafletFix is imported by individual map components (Map.web.tsx, WebMapComponent.tsx, etc.)
// and useLeafletLoader.ts — no need to load Leaflet eagerly on every page.

import { captureExportHead } from '@/utils/webHeadManager'

// #2756: снимок head экспорта до первого SPA-перехода — его теги снимет первая
// же страница с другим путём, даже если стартовая страница SEO не пишет.
captureExportHead()

const RootLayout = require('./_layout.tsx').default

export default RootLayout
