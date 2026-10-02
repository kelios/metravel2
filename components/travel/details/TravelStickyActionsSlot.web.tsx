import React from 'react'
import { createPortal } from 'react-dom'
import { useIsFocused } from 'expo-router'

import type TravelStickyActionsComponent from './TravelStickyActions'

// #1499: см. шапку `TravelHeroSlots.web.tsx`. В `TravelDetailsScrollRuntime.tsx`
// стоял тот же `Platform.OS === 'web' ? Lazy : Static`, из-за которого
// `TravelStickyActions` со всем поддеревом (ActionListSheet, FullscreenGallery,
// expo-clipboard) оставался в стартовом графе travel-детали.
// `import()` внутри фабрики: момент загрузки чанка тот же, что был у
// `React.lazy(() => import('./TravelStickyActions'))` в потребителе.
const TravelStickyActionsLazy = React.lazy(() => import('./TravelStickyActions'))

type TravelStickyActionsProps = React.ComponentProps<typeof TravelStickyActionsComponent>

// #2117: потребитель монтирует бар внутри контента ScrollView. Колонка контента
// (RN-web View, position: relative, высотой во всю статью), transform у
// `travel-details-scroll` и `contain: layout` у `main` становятся containing
// block и для absolute, и для fixed — бар уезжал в низ статьи. Портал в body и
// fixed-якорь нулевой высоты привязывают его `bottom: 0` к окну. Экран стека,
// ушедший из фокуса, остаётся смонтированным — его бар в body не нужен.
const viewportAnchorStyle: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 999,
}

export default function TravelStickyActionsSlot(props: TravelStickyActionsProps) {
  const isFocused = useIsFocused()
  if (!isFocused || typeof document === 'undefined') return null
  return createPortal(
    <div style={viewportAnchorStyle}>
      <TravelStickyActionsLazy {...props} />
    </div>,
    document.body,
  )
}
