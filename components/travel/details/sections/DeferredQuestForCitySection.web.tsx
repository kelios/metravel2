import React, { Suspense } from 'react'

import type { DeferredQuestForCitySectionProps } from '@/components/travel/details/sections/DeferredQuestForCitySection.types'

// #1393: блок «Пройдите квест по этому городу» тянул за собой весь слой данных
// квестов — `useQuestForLocation` → `utils/questAdapters` → `utils/geoCountry` →
// таблицу контуров стран `utils/geoCountryOutlines` (47 КБ raw). Travel-детали —
// это основная масса сгенерированных страниц, поэтому статический импорт держал
// таблицу контуров в стартовом графе почти всего сайта.
//
// Платформенная пара, а не `Platform.OS === 'web' ? Lazy : Static` в одном
// файле: во втором случае синхронный импорт остаётся ребром графа и в web-бандле,
// то есть модуль остаётся eager, сколько ни оборачивай его в `React.lazy`.
//
// The SSR link graph already supplies the selected cards. Request the legacy
// data path only when the route actually renders this fallback.
const QuestForCitySection = React.lazy(() =>
  import('@/components/travel/details/sections/QuestForCitySection'),
)

export default function DeferredQuestForCitySection(props: DeferredQuestForCitySectionProps) {
  // fallback={null}: блок и сам рендерит null, пока подходящего квеста нет,
  // поэтому пустое место до загрузки чанка не меняет раскладку страницы.
  return (
    <Suspense fallback={null}>
      <QuestForCitySection {...props} />
    </Suspense>
  )
}
