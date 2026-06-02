import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { useThemedColors } from '@/hooks/useTheme'
import { type AnchorRect } from './popovers/MapChipPopover'
import { IconOnlyBar } from './MapQuickFilters/IconOnlyBar'
import { RowBar } from './MapQuickFilters/RowBar'
import { QuickFilterPopovers } from './MapQuickFilters/Popovers'
import {
  getStyles,
  PHONE_COMPACT_LAYOUT_MAX_WIDTH,
  PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH,
} from './MapQuickFilters/styles'
import {
  CATEGORY_ICONS,
  partitionActions,
  type ChipKey,
  type FeatherIconName,
  type MapQuickFiltersProps,
  type QuickFilterAction,
  type Selector,
} from './MapQuickFilters/types'

export { CATEGORY_ICONS }

export const MapQuickFilters: React.FC<MapQuickFiltersProps> = React.memo(
  ({
    radiusValue,
    categoriesValue,
    overlaysValue,
    iconOnly = false,
    primaryCtaLabel,
    primaryCtaTestID,
    onPressPrimaryCta,
    extraActions,
    extraActionsPosition = 'end',
    onPressRadius,
    onPressCategories,
    onPressOverlays,
    radiusOptions,
    radiusSelected,
    onChangeRadius,
    categoriesOptions,
    categoriesSelected,
    onChangeCategories,
    overlayOptions,
    enabledOverlays,
    onChangeOverlay,
    onResetOverlays,
    travelsData,
    reserveLeftControlsSpace = true,
  }) => {
    const colors = useThemedColors()
    const { width } = useWindowDimensions()
    const isNarrow = width > 0 && width <= PHONE_COMPACT_LAYOUT_MAX_WIDTH
    const isVeryNarrow = width > 0 && width <= PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH
    const styles = useMemo(
      () => getStyles(colors, { isNarrow, isVeryNarrow, reserveLeftControlsSpace }),
      [colors, isNarrow, isVeryNarrow, reserveLeftControlsSpace],
    )

    const radiusAnchorRef = useRef<View | null>(null)
    const categoriesAnchorRef = useRef<View | null>(null)
    const overlaysAnchorRef = useRef<View | null>(null)
    const [openChip, setOpenChip] = useState<ChipKey | null>(null)
    const [anchor, setAnchor] = useState<AnchorRect | null>(null)

    const hasRadiusPopover =
      Array.isArray(radiusOptions) &&
      radiusOptions.length > 0 &&
      typeof onChangeRadius === 'function'
    const hasCategoriesPopover =
      Array.isArray(categoriesOptions) &&
      categoriesOptions.length > 0 &&
      typeof onChangeCategories === 'function'
    const hasOverlaysPopover =
      Array.isArray(overlayOptions) &&
      overlayOptions.length > 0 &&
      typeof onChangeOverlay === 'function'

    const categoriesActiveCount = Array.isArray(categoriesSelected) ? categoriesSelected.length : 0
    const overlaysActiveCount = enabledOverlays
      ? Object.values(enabledOverlays).filter(Boolean).length
      : 0
    const activeIndicatorByKey: Record<ChipKey, number> = {
      radius: 0,
      categories: categoriesActiveCount,
      overlays: overlaysActiveCount,
    }

    const measureAndOpen = useCallback(
      (key: ChipKey, ref: React.MutableRefObject<View | null>) => {
        const node = ref.current
        if (!node || typeof node.measureInWindow !== 'function') {
          setAnchor(null)
          setOpenChip(key)
          return
        }
        node.measureInWindow((x, y, w, h) => {
          setAnchor({ x, y, width: w, height: h })
          setOpenChip(key)
        })
      },
      [],
    )

    const handleClose = useCallback(() => {
      setOpenChip(null)
      setAnchor(null)
    }, [])

    const makeChipPress = useCallback(
      (
        key: ChipKey,
        ref: React.MutableRefObject<View | null>,
        hasPopover: boolean,
        externalHandler: (() => void) | undefined,
      ) =>
        () => {
          if (hasPopover) {
            if (iconOnly) {
              setAnchor(null)
              setOpenChip(key)
              return
            }
            measureAndOpen(key, ref)
            return
          }
          externalHandler?.()
        },
      [iconOnly, measureAndOpen],
    )

    const handleRadiusPress = useMemo(
      () => makeChipPress('radius', radiusAnchorRef, hasRadiusPopover, onPressRadius),
      [hasRadiusPopover, makeChipPress, onPressRadius],
    )
    const handleCategoriesPress = useMemo(
      () => makeChipPress('categories', categoriesAnchorRef, hasCategoriesPopover, onPressCategories),
      [hasCategoriesPopover, makeChipPress, onPressCategories],
    )
    const handleOverlaysPress = useMemo(
      () => makeChipPress('overlays', overlaysAnchorRef, hasOverlaysPopover, onPressOverlays),
      [hasOverlaysPopover, makeChipPress, onPressOverlays],
    )

    const selectors: Selector[] = ([
      {
        key: 'radius' as const,
        label: 'Радиус',
        value: radiusValue || 'Выбор',
        icon: 'circle' as FeatherIconName,
        onPress: handleRadiusPress,
        ref: radiusAnchorRef,
        hideLabel: isNarrow,
      },
      {
        key: 'categories' as const,
        label: 'Что посмотреть',
        value: categoriesValue || 'Выбор',
        icon: 'grid' as FeatherIconName,
        onPress: handleCategoriesPress,
        ref: categoriesAnchorRef,
        hideLabel: isNarrow,
      },
      {
        key: 'overlays' as const,
        label: 'Оверлеи',
        value: overlaysValue || 'Выкл',
        icon: 'layers' as FeatherIconName,
        onPress: handleOverlaysPress,
        ref: overlaysAnchorRef,
        hideLabel: isNarrow,
      },
    ] satisfies Selector[]).filter((item) => {
      if (item.key === 'radius') return hasRadiusPopover || typeof onPressRadius === 'function'
      if (item.key === 'categories')
        return hasCategoriesPopover || typeof onPressCategories === 'function'
      return hasOverlaysPopover || typeof onPressOverlays === 'function'
    })

    const rowActions = (extraActions ?? []).filter(
      (action) => typeof action?.onPress === 'function',
    ) as QuickFilterAction[]

    const partitioned = useMemo(() => partitionActions(rowActions), [rowActions])

    let leadingActions: QuickFilterAction[]
    let trailingActions: QuickFilterAction[]
    let radiusInlineActions: QuickFilterAction[] = []

    if (iconOnly) {
      leadingActions = extraActionsPosition === 'start' ? rowActions : partitioned.leading
      trailingActions =
        extraActionsPosition === 'end' ? [...partitioned.other, ...partitioned.trailing] : []
    } else {
      leadingActions = extraActionsPosition === 'start' ? rowActions : []
      trailingActions = extraActionsPosition === 'end' ? rowActions : []
      radiusInlineActions = extraActionsPosition === 'inside-radius' ? rowActions : []
    }

    if (!selectors.length && !rowActions.length) return null

    return (
      <View testID="map-quick-filters" style={styles.container} pointerEvents="box-none">
        {iconOnly ? (
          <IconOnlyBar
            leadingActions={leadingActions}
            trailingActions={trailingActions}
            selectors={selectors}
            activeIndicatorByKey={activeIndicatorByKey}
            primaryCtaLabel={primaryCtaLabel}
            primaryCtaTestID={primaryCtaTestID}
            onPressPrimaryCta={onPressPrimaryCta}
            styles={styles}
            colors={colors}
          />
        ) : (
          <RowBar
            leadingActions={leadingActions}
            trailingActions={trailingActions}
            radiusInlineActions={radiusInlineActions}
            selectors={selectors}
            styles={styles}
            colors={colors}
          />
        )}

        <QuickFilterPopovers
          openChip={openChip}
          anchor={anchor}
          onClose={handleClose}
          iconOnly={iconOnly}
          hasRadiusPopover={hasRadiusPopover}
          radiusOptions={radiusOptions}
          radiusSelected={radiusSelected}
          onChangeRadius={onChangeRadius}
          hasCategoriesPopover={hasCategoriesPopover}
          categoriesOptions={categoriesOptions}
          categoriesSelected={categoriesSelected}
          travelsData={travelsData}
          onChangeCategories={onChangeCategories}
          hasOverlaysPopover={hasOverlaysPopover}
          overlayOptions={overlayOptions}
          enabledOverlays={enabledOverlays}
          onChangeOverlay={onChangeOverlay}
          onResetOverlays={onResetOverlays}
        />
      </View>
    )
  },
)
