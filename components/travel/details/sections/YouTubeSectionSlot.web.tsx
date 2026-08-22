import React from 'react'

import type { LazyYouTube as LazyYouTubeComponent } from './LazyYouTubeSection'

// #1499: в `TravelDetailsContentSection.tsx` стоял `Platform.OS === 'web' ? Lazy
// : Static` — статический импорт для native-ветки держал секцию YouTube в
// стартовом графе web-бандла. См. шапку `../TravelHeroSlots.web.tsx`.
export default React.lazy(() =>
  Promise.resolve(import('./LazyYouTubeSection')).then((module) => ({
    default: module.LazyYouTube,
  })),
) as unknown as typeof LazyYouTubeComponent
