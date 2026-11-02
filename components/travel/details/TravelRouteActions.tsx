import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import {
  type StyleProp,
  type ViewInstance,
  type ViewStyle,
  ActivityIndicator,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import CardActionPressable from '@/components/ui/CardActionPressable'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { globalFocusStyles } from '@/styles/globalFocus'
import type { Travel } from '@/types/types'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { showToast } from '@/utils/toast'
import { getTravelRouteWaypoints, hasTravelRouteForNavigation } from '@/utils/travelNavigatorLinks'
import { webViewStyle } from '@/utils/webProps'

import type { TravelNavigatorMenuAnchor } from './TravelNavigatorMenu'

// #2902: меню навигаторов и генератор GPX нужны только после нажатия — ленивые
// чанки, как офлайн-адаптер (`loadTravelOfflineAdapter`) соседнего чипа.
const TravelNavigatorMenu = React.lazy(() => import('./TravelNavigatorMenu'))
const loadGpxModules = () =>
  Promise.all([import('@/utils/travelRouteGpx'), import('@/utils/routeExport/save')])

const ICON_SIZE = 16
const DROPDOWN_WIDTH = 236
const DROPDOWN_HEIGHT = 200

type Props = {
  travel: Pick<Travel, 'id' | 'slug' | 'name' | 'travelAddress' | 'userName'>
  isMobile: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * «Открыть в навигаторе» + «Скачать GPX» в ряду действий статьи (#2902, макет
 * docs/features/ux-audit-2026-11-mocks.md §3). Без двух точек с координатами
 * ряд не рисуется; гостю доступен без входа. На mobile — иконочные чипы в
 * тач-таргет, как компактный офлайн-чип; на desktop web — чипы с подписью.
 */
function TravelRouteActions({ travel, isMobile, style }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const waypoints = useMemo(() => getTravelRouteWaypoints(travel.travelAddress), [travel.travelAddress])
  const [menuMounted, setMenuMounted] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const [anchor, setAnchor] = useState<TravelNavigatorMenuAnchor | null>(null)
  const [gpxBusy, setGpxBusy] = useState(false)
  const triggerRef = useRef<ViewInstance>(null)
  const gpxModulesRef = useRef<ReturnType<typeof loadGpxModules> | null>(null)

  const isWeb = Platform.OS === 'web'
  const compact = !isWeb || isMobile
  const useDropdown = isWeb && !isMobile
  // Тач-таргет как у OfflineSaveControl: native ≥44 (48 Android), web-десктоп — 36.
  const controlHeight = compact ? (Platform.OS === 'android' ? 48 : 44) : 36

  const navigatorLabel = i18nT('travel:components.travel.details.TravelRouteActions.openInNavigator')
  const gpxLabel = i18nT('travel:components.travel.details.TravelRouteActions.downloadGpx')

  const openMenu = useCallback(() => {
    setMenuMounted(true)
    setMenuVisible(true)
    if (!useDropdown) return
    const node = triggerRef.current
    if (!node || typeof node.measureInWindow !== 'function') return
    node.measureInWindow((x, y, width, height) => {
      if (width === 0 && height === 0) return
      const { width: winWidth, height: winHeight } = Dimensions.get('window')
      const below = y + height + DESIGN_TOKENS.spacing.xs
      const top = below + DROPDOWN_HEIGHT > winHeight
        ? Math.max(DESIGN_TOKENS.spacing.xs, y - DROPDOWN_HEIGHT - DESIGN_TOKENS.spacing.xs)
        : below
      const left = Math.max(
        DESIGN_TOKENS.spacing.md,
        Math.min(x, winWidth - DROPDOWN_WIDTH - DESIGN_TOKENS.spacing.md),
      )
      setAnchor({ top, left })
    })
  }, [useDropdown])

  const closeMenu = useCallback(() => setMenuVisible(false), [])

  // Разогрев чанка на pressIn: на web скачивание Blob идёт ближе к жесту.
  const warmGpxModules = useCallback(() => {
    if (!gpxModulesRef.current) gpxModulesRef.current = loadGpxModules()
    return gpxModulesRef.current
  }, [])

  const handleDownloadGpx = useCallback(async () => {
    if (gpxBusy) return
    setGpxBusy(true)
    try {
      const [{ buildTravelRouteGpx }, { saveRouteExportFile }] = await warmGpxModules()
      const saved = await saveRouteExportFile(
        buildTravelRouteGpx(travel),
        i18nT('travel:components.travel.details.TravelRouteActions.gpxShareTitle'),
      )
      if (!saved) throw new Error('save-unavailable')
      void sendAnalyticsEvent('travel_gpx_download', {
        ...(travel.id != null ? { travel_id: travel.id } : null),
        points: waypoints.length,
      })
      if (isWeb) {
        showToast({
          type: 'success',
          text1: i18nT('travel:components.travel.details.TravelRouteActions.gpxSaved'),
          visibilityTime: 2000,
        })
      }
    } catch {
      gpxModulesRef.current = null
      showToast({
        type: 'error',
        text1: i18nT('travel:components.travel.details.TravelRouteActions.gpxFailed'),
        visibilityTime: 3000,
      })
    } finally {
      setGpxBusy(false)
    }
  }, [gpxBusy, isWeb, travel, warmGpxModules, waypoints.length])

  if (!hasTravelRouteForNavigation(waypoints)) return null

  const chipStyle = ({ pressed }: { pressed: boolean }) => [
    styles.chip,
    globalFocusStyles.focusable,
    { minHeight: controlHeight },
    compact && { width: controlHeight, paddingHorizontal: 0 },
    pressed && styles.chipPressed,
  ]

  return (
    <View style={[styles.row, style]} testID="travel-route-actions">
      <View ref={triggerRef} collapsable={false}>
        <CardActionPressable
          accessibilityLabel={navigatorLabel}
          accessibilityState={{ expanded: menuVisible }}
          title={navigatorLabel}
          onPress={openMenu}
          enableWebClickFallback
          testID="travel-navigator-trigger"
          style={chipStyle}
        >
          <View style={styles.chipContent}>
            <Feather name="navigation" size={ICON_SIZE} color={colors.primaryText} />
            {compact ? null : (
              <>
                <Text style={styles.label} numberOfLines={1}>
                  {navigatorLabel}
                </Text>
                <Feather name="chevron-down" size={14} color={colors.primaryText} />
              </>
            )}
          </View>
        </CardActionPressable>
      </View>

      <CardActionPressable
        accessibilityLabel={gpxLabel}
        accessibilityHint={i18nT('travel:components.travel.details.TravelRouteActions.gpxHint')}
        accessibilityState={{ disabled: gpxBusy, busy: gpxBusy }}
        title={i18nT('travel:components.travel.details.TravelRouteActions.gpxHint')}
        disabled={gpxBusy}
        onPressIn={() => void warmGpxModules().catch(() => undefined)}
        onPress={() => void handleDownloadGpx()}
        enableWebClickFallback
        testID="travel-gpx-download"
        style={chipStyle}
      >
        <View style={styles.chipContent}>
          {gpxBusy ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <Feather name="download" size={ICON_SIZE} color={colors.primaryText} />
          )}
          {compact ? null : (
            <Text style={styles.label} numberOfLines={1}>
              {i18nT('travel:components.travel.details.TravelRouteActions.gpxLabel')}
            </Text>
          )}
        </View>
      </CardActionPressable>

      {menuMounted ? (
        <Suspense fallback={null}>
          <TravelNavigatorMenu
            visible={menuVisible}
            onClose={closeMenu}
            variant={useDropdown ? 'dropdown' : 'sheet'}
            anchor={anchor}
            waypoints={waypoints}
            travelId={travel.id}
            returnFocusRef={triggerRef}
          />
        </Suspense>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    // Тон — как у idle-состояния офлайн-чипа: один ряд действий одного вида.
    chip: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primaryLight,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      ...Platform.select({
        web: webViewStyle({
          cursor: 'pointer',
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }),
      }),
    },
    chipPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    chipContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    label: {
      color: colors.primaryText,
      fontSize: 13,
      fontWeight: '600',
    },
  })

export default React.memo(TravelRouteActions)
