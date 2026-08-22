import React from 'react'

import type TravelHeroExtrasComponent from './TravelHeroExtras'
import type TravelHeroInteractiveSliderComponent from './TravelHeroInteractiveSlider'
import type { TravelHeroFavoriteToggle as TravelHeroFavoriteToggleComponent } from './TravelHeroFavoriteToggle'

// #1499: раньше эти три слота жили прямо в `TravelDetailsHero.tsx` как
// `Platform.OS === 'web' ? Lazy : Static`. Статический импорт для native-ветки
// остаётся ребром графа и в web-бандле, поэтому все три поддерева (extras →
// TravelStatusButton → MiniCalendar/OfflineSaveControl, слайдер → sliderParts →
// FullscreenGallery) грузились eager, сколько ни оборачивай их в `React.lazy`.
// Тот же вывод уже записан в шапке `sections/DeferredQuestForCitySection.web.tsx`
// после #1393 — здесь применён ровно тот приём: платформенная пара файлов, где
// динамический импорт видит только web.
//
// `import()` намеренно оставлен ВНУТРИ фабрики `React.lazy`, как и было до
// выделения пары: загрузка чанка стартует на первом рендере слота, а не на
// вычислении модуля. Момент запроса и Suspense-обвязка у потребителя не
// меняются — меняется только состав стартового графа.
export const TravelHeroExtrasSlot = React.lazy(() =>
  Promise.resolve(import('./TravelHeroExtras')).then((m) => ({
    default: m.TravelHeroExtras ?? m.default,
  })),
) as unknown as typeof TravelHeroExtrasComponent

export const TravelHeroInteractiveSliderSlot = React.lazy(() =>
  import('./TravelHeroInteractiveSlider'),
) as unknown as typeof TravelHeroInteractiveSliderComponent

export const TravelHeroFavoriteToggleSlot = React.lazy(() =>
  Promise.resolve(import('./TravelHeroFavoriteToggle')).then((m) => ({
    default: m.TravelHeroFavoriteToggle ?? m.default,
  })),
) as unknown as typeof TravelHeroFavoriteToggleComponent
