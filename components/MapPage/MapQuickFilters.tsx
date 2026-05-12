import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import CardActionPressable from '@/components/ui/CardActionPressable'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { MapChipPopover, type AnchorRect } from './popovers/MapChipPopover'
import { RadiusPopover } from './popovers/RadiusPopover'
import { CategoriesPopover } from './popovers/CategoriesPopover'
import { OverlaysPopover } from './popovers/OverlaysPopover'

type FeatherIconName = React.ComponentProps<typeof Feather>['name']
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
  icon: FeatherIconName
  onPress: () => void
  testID?: string
}

interface MapQuickFiltersProps {
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

const IS_WEB = Platform.OS === 'web'
const PHONE_COMPACT_LAYOUT_MAX_WIDTH = 767
const PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH = 430
const MOBILE_WEB_CONTROLS_CLEARANCE = 80
const DESKTOP_RADIUS_CLUSTER_MIN_WIDTH = 228
const DESKTOP_FILTER_FIELD_MIN_WIDTH = 172
const DESKTOP_TOOLBAR_MAX_WIDTH = 860
const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm
const TOOLBAR_RADIUS = DESIGN_TOKENS.radii.lg
const PILL_RADIUS = DESIGN_TOKENS.radii.pill
const ICON_ONLY_LEADING_ACTION_KEYS = new Set(['locate', 'zoom-in', 'zoom-out'])
const ICON_ONLY_TRAILING_ACTION_KEYS = new Set(['list'])

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

type ChipKey = 'radius' | 'categories' | 'overlays'
type Styles = ReturnType<typeof getStyles>

interface Selector {
  key: ChipKey
  label: string
  value: string
  icon: FeatherIconName
  onPress: () => void
  ref: React.MutableRefObject<View | null>
  hideLabel: boolean
}

function partitionActions(rowActions: QuickFilterAction[]) {
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

function IconActionButton({
  action,
  styles,
  colors,
}: {
  action: QuickFilterAction
  styles: Styles
  colors: ThemedColors
}) {
  return (
    <Pressable
      accessibilityLabel={action.label}
      accessibilityRole="button"
      onPress={action.onPress}
      testID={action.testID}
      style={({ pressed }) => [styles.iconButton, pressed && styles.fieldPressed]}
    >
      <Feather name={action.icon} size={16} color={colors.primary} style={styles.iconButtonIcon} />
    </Pressable>
  )
}

function SelectorField({
  selector,
  styles,
  colors,
}: {
  selector: Selector
  styles: Styles
  colors: ThemedColors
}) {
  return (
    <View ref={selector.ref} collapsable={false} style={styles.fieldWrap}>
      <CardActionPressable
        accessibilityLabel={`${selector.label}: ${selector.value}`}
        onPress={selector.onPress}
        title={selector.label}
        style={({ pressed }: any) => [styles.field, pressed && styles.fieldPressed]}
      >
        <Feather name={selector.icon} size={15} color={colors.primary} style={styles.fieldIcon} />
        <Text
          style={[styles.fieldLabel, selector.hideLabel && styles.fieldLabelHidden]}
          numberOfLines={1}
        >
          {selector.label}
        </Text>
        <Text style={styles.fieldValue} numberOfLines={1}>
          {selector.value}
        </Text>
        <Feather name="chevron-down" size={13} color={colors.textMuted} style={styles.fieldCaret} />
      </CardActionPressable>
    </View>
  )
}

function RadiusClusterField({
  selector,
  inlineActions,
  styles,
  colors,
}: {
  selector: Selector
  inlineActions: QuickFilterAction[]
  styles: Styles
  colors: ThemedColors
}) {
  return (
    <View ref={selector.ref} collapsable={false} style={styles.fieldWrap}>
      <View style={styles.radiusCluster}>
        <View style={styles.radiusActionsGroup}>
          {inlineActions.map((action) => (
            <CardActionPressable
              key={action.key}
              testID={action.testID}
              accessibilityLabel={action.label}
              onPress={action.onPress}
              title={action.label}
              style={({ pressed }: any) => [
                styles.radiusActionButton,
                pressed && styles.fieldPressed,
              ]}
            >
              <Feather
                name={action.icon}
                size={15}
                color={colors.primary}
                style={styles.iconButtonIcon}
              />
            </CardActionPressable>
          ))}
        </View>
        <View style={styles.radiusDivider} />
        <View style={styles.radiusFieldWrap}>
          <CardActionPressable
            accessibilityLabel={`${selector.label}: ${selector.value}`}
            onPress={selector.onPress}
            title={selector.label}
            style={({ pressed }: any) => [styles.radiusField, pressed && styles.fieldPressed]}
          >
            <Feather
              name={selector.icon}
              size={15}
              color={colors.primary}
              style={styles.fieldIcon}
            />
            <Text
              style={[styles.fieldLabel, selector.hideLabel && styles.fieldLabelHidden]}
              numberOfLines={1}
            >
              {selector.label}
            </Text>
            <Text style={styles.fieldValue} numberOfLines={1}>
              {selector.value}
            </Text>
            <Feather
              name="chevron-down"
              size={13}
              color={colors.textMuted}
              style={styles.fieldCaret}
            />
          </CardActionPressable>
        </View>
      </View>
    </View>
  )
}

function ActionAsField({
  action,
  styles,
  colors,
}: {
  action: QuickFilterAction
  styles: Styles
  colors: ThemedColors
}) {
  return (
    <View style={styles.actionWrap}>
      <CardActionPressable
        testID={action.testID}
        accessibilityLabel={action.label}
        onPress={action.onPress}
        title={action.label}
        style={({ pressed }: any) => [styles.field, pressed && styles.fieldPressed]}
      >
        <Feather
          name={action.icon}
          size={15}
          color={colors.primary}
          style={styles.fieldIcon}
        />
      </CardActionPressable>
    </View>
  )
}

function ActionAsIconButton({
  action,
  styles,
  colors,
}: {
  action: QuickFilterAction
  styles: Styles
  colors: ThemedColors
}) {
  return (
    <View style={styles.actionWrap}>
      <CardActionPressable
        testID={action.testID}
        accessibilityLabel={action.label}
        onPress={action.onPress}
        title={action.label}
        style={({ pressed }: any) => [styles.iconButton, pressed && styles.fieldPressed]}
      >
        <Feather name={action.icon} size={15} color={colors.primary} style={styles.iconButtonIcon} />
      </CardActionPressable>
    </View>
  )
}

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
      leadingActions =
        extraActionsPosition === 'start' ? rowActions : partitioned.leading
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
          <View style={styles.iconOnlyBar} pointerEvents="box-none">
            <View style={styles.iconOnlyGroup}>
              {leadingActions.map((action) => (
                <IconActionButton key={action.key} action={action} styles={styles} colors={colors} />
              ))}
            </View>

            {primaryCtaLabel && typeof onPressPrimaryCta === 'function' && (
              <Pressable
                accessibilityLabel={primaryCtaLabel}
                accessibilityRole="button"
                onPress={onPressPrimaryCta}
                testID={primaryCtaTestID}
                style={({ pressed }) => [
                  styles.primaryCtaButton,
                  pressed && styles.fieldPressed,
                ]}
              >
                <Feather name="search" size={14} color={colors.textOnPrimary} />
                <Text style={styles.primaryCtaText} numberOfLines={1}>
                  {primaryCtaLabel}
                </Text>
              </Pressable>
            )}

            <View style={[styles.iconOnlyGroup, styles.iconOnlyFiltersGroup]}>
              {selectors.map((selector) => {
                const activeCount = activeIndicatorByKey[selector.key] ?? 0
                const isActive = activeCount > 0
                const isRadius = selector.key === 'radius'
                return (
                  <Pressable
                    key={selector.key}
                    accessibilityLabel={
                      isActive
                        ? `${selector.label}: ${selector.value} (активно: ${activeCount})`
                        : `${selector.label}: ${selector.value}`
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={selector.onPress}
                    style={({ pressed }) => [
                      isRadius ? styles.iconTextButton : styles.iconButton,
                      isActive && styles.iconButtonActive,
                      pressed && styles.fieldPressed,
                    ]}
                  >
                    {isRadius ? (
                      <Text style={styles.iconTextButtonText} numberOfLines={1}>
                        {selector.value}
                      </Text>
                    ) : (
                      <Feather
                        name={selector.icon}
                        size={16}
                        color={colors.primary}
                        style={styles.iconButtonIcon}
                      />
                    )}
                    {!isRadius && isActive && (
                      <View
                        style={styles.iconBadge}
                        pointerEvents="none"
                        testID={`map-quick-filter-badge-${selector.key}`}
                      >
                        <Text style={styles.iconBadgeText} numberOfLines={1}>
                          {activeCount > 9 ? '9+' : String(activeCount)}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                )
              })}
              {trailingActions.map((action) => (
                <IconActionButton key={action.key} action={action} styles={styles} colors={colors} />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.row} pointerEvents="box-none">
            {leadingActions.map((action) => (
              <ActionAsIconButton key={action.key} action={action} styles={styles} colors={colors} />
            ))}
            {selectors.map((selector) =>
              selector.key === 'radius' && radiusInlineActions.length > 0 ? (
                <RadiusClusterField
                  key={selector.key}
                  selector={selector}
                  inlineActions={radiusInlineActions}
                  styles={styles}
                  colors={colors}
                />
              ) : (
                <SelectorField
                  key={selector.key}
                  selector={selector}
                  styles={styles}
                  colors={colors}
                />
              ),
            )}
            {trailingActions.map((action) => (
              <ActionAsField key={action.key} action={action} styles={styles} colors={colors} />
            ))}
          </View>
        )}

        {hasRadiusPopover && (
          <MapChipPopover
            visible={openChip === 'radius'}
            onClose={handleClose}
            anchor={anchor}
            maxWidth={280}
            testID="map-quick-filters-radius-popover"
          >
            <RadiusPopover
              options={radiusOptions!}
              value={radiusSelected ?? ''}
              onChange={(next) => onChangeRadius!(next)}
              onClose={handleClose}
            />
          </MapChipPopover>
        )}

        {hasCategoriesPopover && (
          <MapChipPopover
            visible={openChip === 'categories'}
            onClose={handleClose}
            anchor={anchor}
            maxWidth={340}
            testID="map-quick-filters-categories-popover"
          >
            <CategoriesPopover
              categories={categoriesOptions!}
              selected={categoriesSelected ?? []}
              travelsData={travelsData ?? []}
              onApply={(next) => onChangeCategories!(next)}
              onClose={handleClose}
            />
          </MapChipPopover>
        )}

        {hasOverlaysPopover && (
          <MapChipPopover
            visible={openChip === 'overlays'}
            onClose={handleClose}
            anchor={anchor}
            maxWidth={360}
            testID="map-quick-filters-overlays-popover"
          >
            <OverlaysPopover
              options={overlayOptions!}
              enabledOverlays={enabledOverlays ?? {}}
              onToggle={(id, enabled) => onChangeOverlay!(id, enabled)}
              onReset={onResetOverlays}
              onClose={handleClose}
              showHeaderClose={iconOnly}
            />
          </MapChipPopover>
        )}
      </View>
    )
  },
)

const getStyles = (
  colors: ThemedColors,
  options: {
    isNarrow: boolean
    isVeryNarrow: boolean
    reserveLeftControlsSpace: boolean
  },
) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: options.isNarrow ? 8 : 16,
      left:
        Platform.OS === 'web' && options.isNarrow
          ? options.reserveLeftControlsSpace
            ? MOBILE_WEB_CONTROLS_CLEARANCE
            : 12
          : options.isNarrow
            ? 12
            : 16,
      right: options.isNarrow ? 12 : 16,
      zIndex: 5,
      ...(Platform.OS === 'web' && !options.isNarrow
        ? ({ maxWidth: DESKTOP_TOOLBAR_MAX_WIDTH } as any)
        : null),
    },
    row: {
      flexDirection: 'row',
      flexWrap: options.isNarrow ? 'wrap' : 'nowrap',
      rowGap: options.isVeryNarrow ? 6 : 8,
      gap: options.isVeryNarrow ? 6 : options.isNarrow ? 8 : 10,
      alignItems: 'stretch',
      alignSelf: 'flex-start',
      ...(IS_WEB && !options.isNarrow
        ? ({
            padding: 5,
            borderRadius: TOOLBAR_RADIUS,
            backgroundColor: colors.surfaceElevated,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            backdropFilter: 'blur(18px) saturate(1.05)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.05)',
            boxShadow: colors.boxShadows.card,
          } as any)
        : null),
    },
    iconOnlyBar: {
      width: '100%',
      minHeight: options.isVeryNarrow ? 36 : options.isNarrow ? 40 : 42,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: options.isVeryNarrow ? 8 : 10,
      rowGap: 6,
    },
    iconOnlyGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isVeryNarrow ? 6 : options.isNarrow ? 8 : 10,
      flexShrink: 0,
    },
    primaryCtaButton: {
      minHeight: options.isVeryNarrow ? 36 : options.isNarrow ? 40 : 42,
      maxWidth: options.isVeryNarrow ? 164 : options.isNarrow ? 188 : 212,
      paddingHorizontal: options.isVeryNarrow ? 10 : 12,
      borderRadius: CONTROL_RADIUS,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      flexShrink: 1,
      ...(IS_WEB
        ? ({
            boxShadow: colors.boxShadows.medium,
            cursor: 'pointer',
            transition: 'transform 0.18s ease, opacity 0.18s ease',
          } as any)
        : colors.shadows.light),
    },
    primaryCtaText: {
      color: colors.textOnPrimary,
      fontSize: options.isVeryNarrow ? 11 : 12,
      lineHeight: options.isVeryNarrow ? 14 : 15,
      fontWeight: '800',
      letterSpacing: 0,
      flexShrink: 1,
    },
    iconOnlyFiltersGroup: { flexShrink: 1, minWidth: 0, justifyContent: 'flex-end' },
    fieldWrap: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: options.isVeryNarrow ? 150 : options.isNarrow ? 160 : 180,
    },
    actionWrap: { flexShrink: 0 },
    radiusCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: options.isVeryNarrow ? 36 : options.isNarrow ? 38 : 40,
      minWidth: options.isNarrow ? 0 : DESKTOP_RADIUS_CLUSTER_MIN_WIDTH,
      borderRadius: CONTROL_RADIUS,
      backgroundColor: IS_WEB ? colors.surfaceElevated : colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingLeft: options.isVeryNarrow ? 6 : 8,
      paddingRight: 4,
      ...(IS_WEB
        ? ({
            backdropFilter: 'blur(20px) saturate(1.12)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.12)',
            boxShadow: colors.boxShadows.medium,
          } as any)
        : colors.shadows.light),
    },
    radiusActionsGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isVeryNarrow ? 4 : 6,
      paddingRight: options.isVeryNarrow ? 4 : 6,
    },
    radiusActionButton: {
      width: options.isVeryNarrow ? 28 : options.isNarrow ? 30 : 32,
      height: options.isVeryNarrow ? 28 : options.isNarrow ? 30 : 32,
      borderRadius: CONTROL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      ...(IS_WEB
        ? ({ cursor: 'pointer', transition: 'transform 0.18s ease, opacity 0.18s ease' } as any)
        : null),
    },
    radiusDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: colors.borderLight,
      opacity: 0.9,
      marginRight: 2,
    },
    radiusFieldWrap: { flex: 1, minWidth: 0 },
    radiusField: {
      flex: 1,
      minWidth: options.isNarrow ? 0 : 136,
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isVeryNarrow ? 6 : 8,
      minHeight: options.isVeryNarrow ? 36 : options.isNarrow ? 38 : 40,
      paddingHorizontal: options.isVeryNarrow ? 8 : 10,
      paddingVertical: 4,
      backgroundColor: 'transparent',
      borderRadius: CONTROL_RADIUS,
      ...(IS_WEB
        ? ({ cursor: 'pointer', transition: 'transform 0.18s ease, opacity 0.18s ease' } as any)
        : null),
    },
    field: {
      flex: options.isNarrow ? 1 : 0,
      minWidth: options.isNarrow ? 0 : DESKTOP_FILTER_FIELD_MIN_WIDTH,
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isVeryNarrow ? 6 : 8,
      minHeight: options.isVeryNarrow ? 36 : options.isNarrow ? 38 : 40,
      paddingHorizontal: options.isVeryNarrow ? 10 : 12,
      paddingVertical: 4,
      borderRadius: CONTROL_RADIUS,
      backgroundColor: IS_WEB ? colors.surfaceElevated : colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...(IS_WEB
        ? ({
            backdropFilter: 'blur(20px) saturate(1.12)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.12)',
            boxShadow: colors.boxShadows.medium,
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease',
          } as any)
        : colors.shadows.light),
    },
    fieldPressed: {
      opacity: 0.85,
      ...(IS_WEB ? ({ transform: 'translateY(0px) scale(0.985)' } as any) : null),
    },
    iconButton: {
      width: options.isVeryNarrow ? 36 : options.isNarrow ? 40 : 42,
      height: options.isVeryNarrow ? 36 : options.isNarrow ? 40 : 42,
      flexBasis: options.isVeryNarrow ? 36 : options.isNarrow ? 40 : 42,
      flexShrink: 0,
      borderRadius: CONTROL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: IS_WEB ? colors.surfaceElevated : colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...(IS_WEB
        ? ({
            backdropFilter: 'blur(18px) saturate(1.08)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.08)',
            boxShadow: colors.boxShadows.medium,
            cursor: 'pointer',
          } as any)
        : colors.shadows.light),
    },
    iconTextButton: {
      minWidth: options.isVeryNarrow ? 54 : options.isNarrow ? 60 : 66,
      maxWidth: options.isVeryNarrow ? 62 : options.isNarrow ? 70 : 78,
      height: options.isVeryNarrow ? 36 : options.isNarrow ? 40 : 42,
      paddingHorizontal: options.isVeryNarrow ? 8 : 10,
      flexShrink: 0,
      borderRadius: CONTROL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: IS_WEB ? colors.surfaceElevated : colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...(IS_WEB
        ? ({
            backdropFilter: 'blur(18px) saturate(1.08)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.08)',
            boxShadow: colors.boxShadows.medium,
            cursor: 'pointer',
          } as any)
        : colors.shadows.light),
    },
    iconTextButtonText: {
      maxWidth: '100%',
      fontSize: options.isVeryNarrow ? 11 : 12,
      lineHeight: options.isVeryNarrow ? 14 : 15,
      fontWeight: '800',
      color: colors.primaryDark,
      letterSpacing: 0,
    },
    iconButtonIcon: { flexShrink: 0 },
    iconButtonActive: {
      borderColor: colors.primary,
      backgroundColor: IS_WEB ? colors.surfaceAlpha40 : colors.surface,
      ...(IS_WEB
        ? ({ boxShadow: `0 0 0 1px ${colors.primary}, ${colors.boxShadows.light}` } as any)
        : null),
    },
    iconBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: PILL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    iconBadgeText: {
      color: colors.textOnPrimary,
      fontSize: 10,
      lineHeight: 12,
      fontWeight: '800',
    },
    fieldIcon: { flexShrink: 0 },
    fieldLabel: {
      fontSize: options.isVeryNarrow ? 12 : 13,
      fontWeight: '600',
      color: colors.textMuted,
      letterSpacing: 0,
      flexShrink: 1,
      minWidth: 0,
    },
    fieldLabelHidden: {
      ...(IS_WEB ? ({ display: 'none' } as any) : { width: 0, height: 0, opacity: 0 }),
    },
    fieldValue: {
      marginLeft: 'auto',
      fontSize: options.isVeryNarrow ? 12 : 13,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 0,
      maxWidth: options.isVeryNarrow ? 90 : options.isNarrow ? 116 : 142,
    },
    fieldCaret: { flexShrink: 0, opacity: 0.5 },
  })
