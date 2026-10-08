import React from 'react'
import { View } from 'react-native'

export const MapMobileSheetHeader = View

/** Web keeps the existing panel and its scroll/footer ownership. */
export function renderMobileFiltersPanel(Panel: React.ElementType) {
  return <Panel hideTopControls={true} />
}
