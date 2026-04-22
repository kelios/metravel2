/**
 * MapMobileCollapsedOverlay - MapQuickFilters chips shown when bottom sheet is collapsed.
 * Extracted from MapMobileLayout (no behavior change).
 */
import React from 'react'

import { MapQuickFilters } from '@/components/MapPage/MapQuickFilters'

type CategoryOption = string | { id?: string | number; name?: string; value?: string }

interface RadiusOption {
  id: string
  name: string
}

interface OverlayOption {
  id: string
  title: string
}

interface QuickFilterAction {
  key: string
  label: string
  icon: any
  onPress: () => void
  testID?: string
}

export interface MapMobileCollapsedOverlayProps {
  quickRadiusValue: string
  quickCategoriesValue: string
  quickOverlaysValue: string
  quickRadiusOptions: ReadonlyArray<RadiusOption>
  quickCategoryOptions: ReadonlyArray<CategoryOption>
  quickOverlayOptions: ReadonlyArray<OverlayOption>
  quickEnabledOverlays: Record<string, boolean>
  activeRadius: string
  quickFilterSelected: string[]
  travelsData: ReadonlyArray<{ categoryName?: string | null | undefined }>
  onCenterUser: () => void
  onOpenList: () => void
  onOpenSearch: () => void
  onFilterChange?: (key: string, value: unknown) => void
  onOverlayToggle?: (id: string, enabled: boolean) => void
  onResetOverlays?: () => void
  quickActionButtons?: ReadonlyArray<QuickFilterAction>
}

const MapMobileCollapsedOverlayInner: React.FC<MapMobileCollapsedOverlayProps> = ({
  quickRadiusValue,
  quickCategoriesValue,
  quickOverlaysValue,
  quickRadiusOptions,
  quickCategoryOptions,
  quickOverlayOptions,
  quickEnabledOverlays,
  activeRadius,
  quickFilterSelected,
  travelsData,
  onCenterUser,
  onOpenList,
  onOpenSearch,
  onFilterChange,
  onOverlayToggle,
  onResetOverlays,
  quickActionButtons,
}) => {
  const extraActions: QuickFilterAction[] = [
    {
      key: 'locate',
      label: 'Показать мое местоположение',
      icon: 'crosshair',
      onPress: onCenterUser,
      testID: 'map-center-user-quick',
    },
    ...(quickActionButtons ?? []).filter((action) => action.key !== 'locate'),
    {
      key: 'list',
      label: 'Открыть панель со списком',
      icon: 'list',
      onPress: onOpenList,
      testID: 'map-open-list',
    },
  ]

  return (
    <MapQuickFilters
      iconOnly={true}
      radiusValue={quickRadiusValue}
      categoriesValue={quickCategoriesValue}
      overlaysValue={quickOverlaysValue}
      extraActions={extraActions}
      onPressRadius={onOpenSearch}
      onPressCategories={onOpenSearch}
      onPressOverlays={onOpenSearch}
      radiusOptions={quickRadiusOptions}
      radiusSelected={activeRadius}
      onChangeRadius={(next) => onFilterChange?.('radius', next)}
      categoriesOptions={quickCategoryOptions}
      categoriesSelected={quickFilterSelected}
      onChangeCategories={(next) =>
        onFilterChange?.('categoryTravelAddress', next)
      }
      overlayOptions={quickOverlayOptions}
      enabledOverlays={quickEnabledOverlays}
      onChangeOverlay={(id, enabled) => onOverlayToggle?.(id, enabled)}
      onResetOverlays={onResetOverlays}
      travelsData={travelsData}
      reserveLeftControlsSpace={false}
    />
  )
}

export const MapMobileCollapsedOverlay = React.memo(
  MapMobileCollapsedOverlayInner,
)
export default MapMobileCollapsedOverlay
