import React, { useCallback, useMemo, useRef } from 'react'
import { type ViewInstance, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ActionListSheet, { type ActionListSheetItem } from '@/components/ui/ActionListSheet'
import MenuOverlay from '@/components/ui/MenuOverlay'
import {
  getNavigationActionVisual,
  NAVIGATION_ACTION_LABELS,
  type NavigationActionKind,
} from '@/components/navigation/navigationActionMeta'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { globalFocusStyles } from '@/styles/globalFocus'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import type { RouteWaypoint } from '@/utils/routeExport/types'
import { showToast } from '@/utils/toast'
import { webViewStyle } from '@/utils/webProps'
import {
  buildTravelNavigatorUrl,
  TRAVEL_NAVIGATOR_PROVIDERS,
  type TravelNavigatorProvider,
} from '@/utils/travelNavigatorLinks'

export type TravelNavigatorMenuAnchor = { top: number; left: number }

type Props = {
  visible: boolean
  onClose: () => void
  /** `sheet` — mobile web и native (bottom sheet), `dropdown` — desktop web. */
  variant: 'sheet' | 'dropdown'
  anchor?: TravelNavigatorMenuAnchor | null
  waypoints: readonly RouteWaypoint[]
  travelId?: number | string
  returnFocusRef: React.RefObject<ViewInstance | null>
}

// Визуальный язык навигаторов — общий с popup карты и PointNavigationMenu.
const VISUAL_KIND: Record<TravelNavigatorProvider, NavigationActionKind> = {
  google: 'google',
  yandex: 'yandex-maps',
  apple: 'apple',
  osmand: 'osm',
}

const providerLabel = (provider: TravelNavigatorProvider): string => {
  switch (provider) {
    case 'google':
      return 'Google Maps'
    case 'yandex':
      return NAVIGATION_ACTION_LABELS['yandex-maps']
    case 'apple':
      return 'Apple Maps'
    case 'osmand':
      return 'OsmAnd'
  }
}

/**
 * #2902 — меню «Открыть в навигаторе» страницы маршрута. Грузится лениво по
 * первому нажатию (React.lazy в TravelRouteActions), поэтому построители URL и
 * лист не входят в первый чанк статьи. Ссылки — только через externalLinks.
 */
function TravelNavigatorMenu({
  visible,
  onClose,
  variant,
  anchor,
  waypoints,
  travelId,
  returnFocusRef,
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const firstItemRef = useRef<ViewInstance>(null)
  const restoreFocusRef = useRef(true)
  const title = i18nT('travel:components.travel.details.TravelRouteActions.openInNavigator')

  const openProvider = useCallback(
    (provider: TravelNavigatorProvider) => {
      const url = buildTravelNavigatorUrl(provider, waypoints)
      if (!url) return
      // Без await: на web новая вкладка должна открыться в том же жесте.
      void openExternalUrlInNewTab(url).then((opened) => {
        if (opened) return
        showToast({
          type: 'error',
          text1: i18nT('travel:components.travel.details.TravelRouteActions.navigatorOpenFailed'),
          visibilityTime: 3000,
        })
      })
      void sendAnalyticsEvent('travel_navigator_open', {
        provider,
        ...(travelId != null ? { travel_id: travelId } : null),
      })
    },
    [travelId, waypoints],
  )

  const items = useMemo(
    () =>
      TRAVEL_NAVIGATOR_PROVIDERS.map((provider) => {
        const visual = getNavigationActionVisual(VISUAL_KIND[provider], colors)
        const label = providerLabel(provider)
        return {
          provider,
          label,
          visual,
          a11y: i18nT('travel:components.travel.details.TravelRouteActions.openInProvider', { value1: label }),
        }
      }),
    [colors],
  )

  const sheetActions = useMemo<ActionListSheetItem[]>(
    () =>
      items.map((item) => ({
        key: item.provider,
        label: item.label,
        icon: item.visual.icon,
        iconColor: item.visual.iconColor,
        iconBubbleColor: item.visual.tintBg,
        accessibilityLabel: item.a11y,
        title: item.a11y,
        testID: `travel-navigator-${item.provider}`,
        onPress: () => openProvider(item.provider),
      })),
    [items, openProvider],
  )

  if (variant === 'sheet') {
    return <ActionListSheet visible={visible} onClose={onClose} title={title} actions={sheetActions} />
  }

  return (
    <MenuOverlay
      visible={visible}
      onRequestClose={onClose}
      accessibilityLabel={title}
      initialFocusRef={firstItemRef}
      returnFocusRef={returnFocusRef}
      restoreFocusRef={restoreFocusRef}
    >
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={title}>
        <View
          role="menu"
          aria-label={title}
          testID="travel-navigator-dropdown"
          style={[styles.menu, { top: anchor?.top ?? 120, left: anchor?.left ?? DESIGN_TOKENS.spacing.md }]}
        >
          {items.map((item, index) => (
            <Pressable
              key={item.provider}
              ref={index === 0 ? firstItemRef : undefined}
              role="menuitem"
              accessibilityLabel={item.a11y}
              testID={`travel-navigator-${item.provider}`}
              onPress={() => {
                restoreFocusRef.current = false
                onClose()
                openProvider(item.provider)
              }}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
                globalFocusStyles.focusable,
              ]}
            >
              <View style={[styles.iconBubble, { backgroundColor: item.visual.tintBg }]}>
                <Feather name={item.visual.icon} size={16} color={item.visual.iconColor} />
              </View>
              <Text style={styles.itemText} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </MenuOverlay>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    menu: {
      position: 'absolute',
      minWidth: 220,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: webViewStyle({ boxShadow: colors.boxShadows.modal }),
        default: { elevation: 4 },
      }),
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      marginHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    itemPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    iconBubble: {
      width: 28,
      height: 28,
      borderRadius: DESIGN_TOKENS.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: DESIGN_TOKENS.typography.weights.medium,
      color: colors.text,
    },
  })

export default React.memo(TravelNavigatorMenu)
