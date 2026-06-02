import React from 'react'
import type { View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

export type FeatherIconName = React.ComponentProps<typeof Feather>['name']
export type CategoryOption = string | { id?: string | number; name?: string; value?: string }

export interface RadiusOption {
  id: string
  name: string
}

export interface OverlayOption {
  id: string
  title: string
}

export interface QuickFilterAction {
  key: string
  label: string
  icon: FeatherIconName
  onPress: () => void
  testID?: string
}

export interface MapQuickFiltersProps {
  radiusValue?: string
  categoriesValue?: string
  overlaysValue?: string
  iconOnly?: boolean
  primaryCtaLabel?: string
  primaryCtaTestID?: string
  onPressPrimaryCta?: () => void
  extraActions?: ReadonlyArray<QuickFilterAction>
  extraActionsPosition?: 'start' | 'end' | 'inside-radius'
  onPressRadius?: () => void
  onPressCategories?: () => void
  onPressOverlays?: () => void
  radiusOptions?: ReadonlyArray<RadiusOption>
  radiusSelected?: string
  onChangeRadius?: (next: string) => void
  categoriesOptions?: ReadonlyArray<CategoryOption>
  categoriesSelected?: string[]
  onChangeCategories?: (next: string[]) => void
  overlayOptions?: ReadonlyArray<OverlayOption>
  enabledOverlays?: Record<string, boolean>
  onChangeOverlay?: (id: string, enabled: boolean) => void
  onResetOverlays?: () => void
  travelsData?: ReadonlyArray<{ categoryName?: string | null | undefined }>
  reserveLeftControlsSpace?: boolean
}

export type ChipKey = 'radius' | 'categories' | 'overlays'

export interface Selector {
  key: ChipKey
  label: string
  value: string
  icon: FeatherIconName
  onPress: () => void
  ref: React.MutableRefObject<View | null>
  hideLabel: boolean
}

export const CATEGORY_ICONS: Record<string, FeatherIconName> = {
  Горы: 'triangle',
  Пляжи: 'sun',
  Города: 'map-pin',
  Природа: 'feather',
  Музеи: 'home',
  Озера: 'droplet',
  Культура: 'music',
  Спорт: 'activity',
  Еда: 'coffee',
  Архитектура: 'layers',
}

export const ICON_ONLY_LEADING_ACTION_KEYS = new Set(['locate', 'zoom-in', 'zoom-out'])
export const ICON_ONLY_TRAILING_ACTION_KEYS = new Set(['list'])

export function partitionActions(rowActions: QuickFilterAction[]) {
  const leading: QuickFilterAction[] = []
  const trailing: QuickFilterAction[] = []
  const other: QuickFilterAction[] = []
  for (const action of rowActions) {
    if (ICON_ONLY_LEADING_ACTION_KEYS.has(action.key)) leading.push(action)
    else if (ICON_ONLY_TRAILING_ACTION_KEYS.has(action.key)) trailing.push(action)
    else other.push(action)
  }
  return { leading, trailing, other }
}
