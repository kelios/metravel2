import React from 'react'

import type TravelStickyActionsComponent from './TravelStickyActions'

// #1499: см. шапку `TravelHeroSlots.web.tsx`. В `TravelDetailsScrollRuntime.tsx`
// стоял тот же `Platform.OS === 'web' ? Lazy : Static`, из-за которого
// `TravelStickyActions` со всем поддеревом (ActionListSheet, FullscreenGallery,
// expo-clipboard) оставался в стартовом графе travel-детали.
// `import()` внутри фабрики: момент загрузки чанка тот же, что был у
// `React.lazy(() => import('./TravelStickyActions'))` в потребителе.
export default React.lazy(() =>
  import('./TravelStickyActions'),
) as unknown as typeof TravelStickyActionsComponent
