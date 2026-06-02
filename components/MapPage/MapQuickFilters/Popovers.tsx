import React from 'react'

import { MapChipPopover, type AnchorRect } from '../popovers/MapChipPopover'
import { RadiusPopover } from '../popovers/RadiusPopover'
import { CategoriesPopover } from '../popovers/CategoriesPopover'
import { OverlaysPopover } from '../popovers/OverlaysPopover'
import type { CategoryOption, ChipKey, OverlayOption, RadiusOption } from './types'

export function QuickFilterPopovers({
  openChip,
  anchor,
  onClose,
  iconOnly,
  hasRadiusPopover,
  radiusOptions,
  radiusSelected,
  onChangeRadius,
  hasCategoriesPopover,
  categoriesOptions,
  categoriesSelected,
  travelsData,
  onChangeCategories,
  hasOverlaysPopover,
  overlayOptions,
  enabledOverlays,
  onChangeOverlay,
  onResetOverlays,
}: {
  openChip: ChipKey | null
  anchor: AnchorRect | null
  onClose: () => void
  iconOnly: boolean
  hasRadiusPopover: boolean
  radiusOptions?: ReadonlyArray<RadiusOption>
  radiusSelected?: string
  onChangeRadius?: (next: string) => void
  hasCategoriesPopover: boolean
  categoriesOptions?: ReadonlyArray<CategoryOption>
  categoriesSelected?: string[]
  travelsData?: ReadonlyArray<{ categoryName?: string | null | undefined }>
  onChangeCategories?: (next: string[]) => void
  hasOverlaysPopover: boolean
  overlayOptions?: ReadonlyArray<OverlayOption>
  enabledOverlays?: Record<string, boolean>
  onChangeOverlay?: (id: string, enabled: boolean) => void
  onResetOverlays?: () => void
}) {
  return (
    <>
      {hasRadiusPopover && (
        <MapChipPopover
          visible={openChip === 'radius'}
          onClose={onClose}
          anchor={anchor}
          maxWidth={280}
          testID="map-quick-filters-radius-popover"
        >
          <RadiusPopover
            options={radiusOptions!}
            value={radiusSelected ?? ''}
            onChange={(next) => onChangeRadius!(next)}
            onClose={onClose}
          />
        </MapChipPopover>
      )}

      {hasCategoriesPopover && (
        <MapChipPopover
          visible={openChip === 'categories'}
          onClose={onClose}
          anchor={anchor}
          maxWidth={340}
          testID="map-quick-filters-categories-popover"
        >
          <CategoriesPopover
            categories={categoriesOptions!}
            selected={categoriesSelected ?? []}
            travelsData={travelsData ?? []}
            onApply={(next) => onChangeCategories!(next)}
            onClose={onClose}
          />
        </MapChipPopover>
      )}

      {hasOverlaysPopover && (
        <MapChipPopover
          visible={openChip === 'overlays'}
          onClose={onClose}
          anchor={anchor}
          maxWidth={360}
          testID="map-quick-filters-overlays-popover"
        >
          <OverlaysPopover
            options={overlayOptions!}
            enabledOverlays={enabledOverlays ?? {}}
            onToggle={(id, enabled) => onChangeOverlay!(id, enabled)}
            onReset={onResetOverlays}
            onClose={onClose}
            showHeaderClose={iconOnly}
          />
        </MapChipPopover>
      )}
    </>
  )
}
