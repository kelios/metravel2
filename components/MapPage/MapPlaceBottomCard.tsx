import React, { useEffect, useMemo, useRef } from 'react'
import {
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useQueryClient } from '@tanstack/react-query'

import { useTheme, useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { queryKeys } from '@/api/queryKeys'
import { createMapPopupComponent } from './Map/createMapPopupComponent'
import type { Point } from './Map/types'

const IS_WEB = Platform.OS === 'web'
const SWIPE_CLOSE_THRESHOLD_PX = 64
// Native bottom sheet: vertical budget the caption/actions block needs below the
// hero, so the hero can take the rest without forcing a scroll on tall content.
// Dropped from 460 → 380 after the «Статус поездки» row was removed (♥ + status are
// now compact icons in the hero corner), reclaiming a full row for the photo.
const NATIVE_CONTENT_RESERVE = 380

type MapPlaceBottomCardProps = {
  /** Selected single marker; when null the card is not rendered. */
  point: Point | null
  /** Live user location for distance/time + «Маршрут» action. */
  userLocation: { latitude: number; longitude: number } | null
  /** Close the card (button / swipe / map tap). */
  onClose: () => void
  /** Bottom inset so the card clears the global dock / tab bar. */
  bottomInset?: number
  /** Top inset so the sheet's max-height leaves the app header visible. */
  topInset?: number
}

/**
 * #207 — maps.me-style bottom-anchored sheet for a tapped single marker on the
 * mobile map. The map stays visible above it; the sheet is content-sized (caps at
 * `nativeSheetMaxHeight`) and slides up from the bottom over a soft backdrop.
 *
 * Reuses the SAME content as the Leaflet popup: `createMapPopupComponent` returns
 * a component that renders `PlacePopupCard` (photo via ImageCardMedia contain+blur,
 * title, category · distance · drive time, address, actions) WITHOUT the Leaflet
 * popup wrapper, so it drops straight into the sheet.
 */
const MapPlaceBottomCard: React.FC<MapPlaceBottomCardProps> = ({
  point,
  userLocation,
  onClose,
  bottomInset = 0,
  topInset = 0,
}) => {
  const colors = useThemedColors()
  const themeContextValue = useTheme()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions()
  // On mobile web the card uses a BOUNDED bottom sheet (maps.me-style): the map
  // stays visible above it, the photo is a fixed hero, and the caption/actions
  // scroll beneath it so every element stays reachable and the photo never jerks
  // when «Ещё» expands. Native uses a bottom-anchored content-sized sheet.
  const isFullscreenWeb = IS_WEB && viewportWidth <= 560
  const styles = useMemo(() => getStyles(colors), [colors])

  // createMapPopupComponent reads userLocation from a ref so the factory identity
  // stays stable across GPS updates (no remount → no lost state).
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    userLocationRef.current = userLocation
      ? { lat: userLocation.latitude, lng: userLocation.longitude }
      : null
  }, [userLocation])

  const topChromeInset = Math.max(0, topInset || 0)
  const bottomChromeInset = (bottomInset || 0) + (insets?.bottom ?? 0)
  // `bottomInset` carries a +16 breathing-room baked into NATIVE_MOBILE_BOTTOM_DOCK_INSET
  // (= tabBarHeight + 16). The dock itself only occupies tabBarHeight + safe-area, so
  // applying the full inset as the panel's marginBottom leaves a 16px gap above the dock.
  // Drop that breathing-room so the sheet sits flush on top of the dock (no gap).
  const DOCK_BREATHING_GAP = 16
  const nativePanelMargin = Math.max(0, bottomChromeInset - DOCK_BREATHING_GAP)

  // Native bottom sheet sizing. The sheet sits above the bottom chrome and caps its
  // height so the app header / map stay visible above it (content-sized otherwise).
  const nativeSheetTopInset = insets?.top ?? 0
  const nativeSheetMaxHeight = Math.round(
    Math.max(360, viewportHeight - bottomChromeInset - nativeSheetTopInset - 12),
  )
  const nativeHeroHeight = IS_WEB
    ? undefined
    : Math.max(
        180,
        Math.min(Math.round(viewportHeight * 0.46), nativeSheetMaxHeight - NATIVE_CONTENT_RESERVE),
      )

  const PopupComponent = useMemo(
    () =>
      createMapPopupComponent({
        colors,
        themeContextValue,
        compactLayout: true,
        // The bottom card IS the surface; do not also render the popup's own
        // fullscreen mobile overlay (that would double up the chrome).
        fullscreenOnMobile: false,
        // Mobile web sheet: fixed hero photo + scrollable caption/actions so the
        // photo never jerks when «Ещё» expands (the text scrolls under it).
        bottomSheetSplit: isFullscreenWeb,
        bottomCardImageHeight: nativeHeroHeight,
        // #FIX-3 — Telegram is a share action, not a map-app: surface it as the
        // title-row share icon and drop it from the «Навигация и действия» sheet.
        shareInActionRow: true,
        userLocationRef,
        invalidateUserPoints: () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.userPointsAll() })
        },
      }),
    [colors, themeContextValue, queryClient, isFullscreenWeb, nativeHeroHeight],
  )

  // On the mobile sheet the close button wires BOTH RN-Web `onPress` and a native
  // `onPointerUp` (the responder race can swallow either one). On touch both can
  // fire → double `clearSelectedPlace`. `closedRef` guarantees a single onClose
  // per gesture. It resets on unmount with the component, so reopening works.
  const closedRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const handleClose = useRef(() => {
    if (closedRef.current) return
    closedRef.current = true
    onCloseRef.current()
  }).current

  // #497 — the card is reused (React.memo) when the user taps another marker
  // without closing the current one: `selectedPlace` changes but the component
  // stays mounted, so `closedRef` (set true by a previous close) would make the
  // ✕ a permanent no-op. Reset it whenever a new point is shown.
  const pointKey = point ? String(point.coord ?? point.id ?? '') : null
  useEffect(() => {
    closedRef.current = false
  }, [pointKey])

  // #497 — native swipe-down-to-close on the grabber/header. The web grabber uses
  // pointer events (webSwipeHandlers); native needs a PanResponder because RN-Web
  // pointer props don't exist on real RN. Captures a downward drag past the
  // threshold and closes the card (parity with maps.me / web swipe).
  const nativeSwipeResponder = useMemo(() => {
    if (IS_WEB) return null
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy > SWIPE_CLOSE_THRESHOLD_PX) handleClose()
      },
      onPanResponderTerminate: (_evt, gesture) => {
        if (gesture.dy > SWIPE_CLOSE_THRESHOLD_PX) handleClose()
      },
    })
  }, [handleClose])
  const nativeSwipeHandlers = nativeSwipeResponder?.panHandlers ?? null

  // Web swipe-down-to-close on the grabber/header.
  const dragStartYRef = useRef<number | null>(null)
  const webSwipeHandlers = useMemo(() => {
    if (!IS_WEB) return null
    return {
      onPointerDown: (e: any) => {
        dragStartYRef.current = e?.clientY ?? null
      },
      onPointerUp: (e: any) => {
        const start = dragStartYRef.current
        dragStartYRef.current = null
        if (start == null) return
        const dy = (e?.clientY ?? start) - start
        if (dy > SWIPE_CLOSE_THRESHOLD_PX) handleClose()
      },
    } as any
  }, [handleClose])

  if (!point) return null

  const bottomContentInset = IS_WEB ? bottomChromeInset + 12 : 12

  // On web, close via a NATIVE DOM handler instead of relying solely on RN-Web's
  // `onPress`. RN-Web synthesises `onPress` through its responder system over
  // pointer events; on the mobile bottom sheet the grabber hosts a swipe
  // responder and the hero popup is a separate responder subtree underneath, and
  // the responder hand-off can swallow the button's `pointerup` so `onPress`
  // never fires — the card stays mounted and freezes the lower ~82% of the map.
  const webCloseHandlers = IS_WEB
    ? ({
        onPointerDown: (e: any) => {
          e?.stopPropagation?.()
        },
        onPointerUp: (e: any) => {
          e?.stopPropagation?.()
          handleClose()
        },
      } as any)
    : null

  const closeButton = (
    // Rendered after the body so it paints on top of the edge-to-edge hero
    // photo (RN has no zIndex across siblings without elevation); dark pill
    // + white glyph keeps it visible on any image.
    <Pressable
      testID="map-place-bottom-card-close"
      onPress={handleClose}
      accessibilityRole="button"
      accessibilityLabel="Закрыть карточку места"
      hitSlop={10}
      style={({ pressed }) => [
        styles.closeButton,
        isFullscreenWeb && styles.closeButtonFullscreen,
        // Fullscreen web: keep ✕ below the status bar / notch (insets not in getStyles).
        isFullscreenWeb && IS_WEB ? ({ top: (insets?.top ?? 0) + 12 } as any) : null,
        pressed && { opacity: 0.7 },
      ]}
      {...(webCloseHandlers ?? {})}
    >
      <Feather name="x" size={18} color="#fff" />
    </Pressable>
  )

  // Mobile web: a BOUNDED bottom sheet (maps.me-style) anchored to the bottom so the
  // map stays visible above it. The sheet hosts the split layout (fixed hero photo +
  // scrollable caption/actions) so every element stays reachable and the photo never
  // jerks when «Ещё» expands. Sits above the global bottom dock.
  if (isFullscreenWeb) {
    return (
      <View
        style={styles.sheetRoot}
        testID="map-place-bottom-card"
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheetCard,
            {
              height: `calc(100dvh - ${topChromeInset + bottomChromeInset}px)`,
              maxHeight: `calc(100dvh - ${topChromeInset + bottomChromeInset}px)`,
              marginTop: topChromeInset,
              marginBottom: bottomChromeInset,
              paddingTop: insets?.top ?? 0,
              paddingBottom: insets?.bottom ?? 0,
            },
          ]}
          {...({ pointerEvents: 'auto' } as any)}
        >
          <View style={styles.handleZone} {...(webSwipeHandlers ?? {})}>
            <View style={styles.grabber} />
          </View>
          <PopupComponent point={point} closePopup={handleClose} />
          {closeButton}
        </View>
      </View>
    )
  }

  if (IS_WEB) {
    // Mobile-web wide (>560): the legacy bounded card anchored to the bottom dock.
    return (
      <View
        style={[styles.root, { paddingBottom: bottomContentInset }]}
        testID="map-place-bottom-card"
        pointerEvents="box-none"
      >
        <View style={styles.card}>
          <View style={styles.handleZone} {...(webSwipeHandlers ?? {})}>
            <View style={styles.grabber} />
          </View>
          <View style={styles.body}>
            <PopupComponent point={point} closePopup={handleClose} />
          </View>
          {closeButton}
        </View>
      </View>
    )
  }

  // Native: a bottom-anchored, content-sized sheet over a soft backdrop. Tapping the
  // backdrop closes the card; the panel caps at `nativeSheetMaxHeight` so the app
  // header / map stay visible above it. A grabber + ✕ header row hosts swipe-down-to
  // close; the body is a content-driven ScrollView fallback for tall content.
  return (
    <View style={styles.nativeRoot} testID="map-place-bottom-card" pointerEvents="box-none">
      <Pressable
        testID="map-place-bottom-card-backdrop"
        accessibilityLabel="Закрыть карточку места"
        accessibilityRole="button"
        onPress={handleClose}
        style={styles.nativeBackdrop}
      />
      <View style={[styles.nativePanel, { maxHeight: nativeSheetMaxHeight, marginBottom: bottomChromeInset }]}>
        <View style={styles.nativeHandleRow} {...(nativeSwipeHandlers ?? {})}>
          <View style={styles.grabber} />
          <Pressable
            testID="map-place-bottom-card-close"
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Закрыть карточку места"
            hitSlop={12}
            style={({ pressed }) => [styles.nativeHeaderCloseButton, pressed && { opacity: 0.6 }]}
          >
            <Feather name="x" size={20} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView
          style={styles.nativeScroll}
          contentContainerStyle={[styles.body, { paddingBottom: bottomContentInset }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <PopupComponent point={point} closePopup={handleClose} />
        </ScrollView>
      </View>
    </View>
  )
}

export default React.memo(MapPlaceBottomCard)

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    // Web (wide >560): bounded card anchored to the bottom dock.
    root: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 8,
      ...(IS_WEB ? ({ zIndex: 1200 } as any) : null),
    },
    // Native bottom-anchored sheet over a soft backdrop.
    nativeRoot: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
    },
    nativeBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(15, 23, 42, 0.18)',
    },
    nativePanel: {
      width: '100%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 18,
    },
    nativeHandleRow: {
      minHeight: 40,
      paddingTop: 8,
      paddingBottom: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nativeHeaderCloseButton: {
      position: 'absolute',
      right: 12,
      top: 2,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    nativeScroll: {
      flexGrow: 0,
    },
    // Mobile web BOUNDED bottom sheet (maps.me-style): anchored to the visible
    // viewport bottom so the map shows above it. Web-only (guarded by isFullscreenWeb).
    sheetRoot: {
      ...(IS_WEB
        ? ({
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 5000,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          } as any)
        : null),
    },
    sheetCard: {
      width: '100%',
      backgroundColor: colors.surface,
      position: 'relative',
      overflow: 'hidden',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      ...(IS_WEB
        ? ({
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -8px 28px rgba(15,23,42,0.22)',
          } as any)
        : null),
    },
    card: {
      width: '100%',
      backgroundColor: colors.surface,
      overflow: 'hidden',
      position: 'relative',
      ...(IS_WEB
        ? {
            alignSelf: 'center',
            maxWidth: 560,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...({ boxShadow: DESIGN_TOKENS.shadows.card } as any),
          }
        : null),
    },
    handleZone: {
      paddingTop: 8,
      paddingBottom: 4,
      alignItems: 'center',
      justifyContent: 'center',
      ...(IS_WEB ? ({ cursor: 'grab', touchAction: 'none' } as any) : null),
    },
    grabber: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.borderStrong,
    },
    closeButton: {
      position: 'absolute',
      right: 8,
      top: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.85)',
      ...(IS_WEB
        ? ({ zIndex: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.45)' } as any)
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.45,
            shadowRadius: 6,
            elevation: 6,
          }),
    },
    closeButtonFullscreen: {
      width: 44,
      height: 44,
      borderRadius: 22,
      right: 12,
      backgroundColor: 'rgba(0,0,0,0.6)',
      ...(IS_WEB ? ({ zIndex: 10 } as any) : null),
    },
    body: {
      // Photo runs edge-to-edge: the popup card's own contentContainer/footerContainer
      // carry the horizontal padding for the caption/actions below the hero.
      paddingHorizontal: 0,
      paddingBottom: 4,
    },
  })
