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

type MapPlaceBottomCardProps = {
  /** Selected single marker; when null the card is not rendered. */
  point: Point | null
  /** Live user location for distance/time + «Маршрут» action. */
  userLocation: { latitude: number; longitude: number } | null
  /** Close the card (button / swipe / map tap). */
  onClose: () => void
  /** Bottom inset so the card clears the global dock / tab bar. */
  bottomInset?: number
}

/**
 * #207 — maps.me-style bottom card for a tapped single marker on the mobile map.
 *
 * Reuses the SAME content as the Leaflet popup: `createMapPopupComponent` returns
 * a component that renders `PlacePopupCard` (photo via ImageCardMedia contain+blur,
 * title, category · distance · drive time, address, actions: «Маршрут» + ♥ + Share)
 * WITHOUT the Leaflet popup wrapper, so it drops straight into a bottom card.
 */
const MapPlaceBottomCard: React.FC<MapPlaceBottomCardProps> = ({
  point,
  userLocation,
  onClose,
  bottomInset = 0,
}) => {
  const colors = useThemedColors()
  const themeContextValue = useTheme()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { width: viewportWidth } = useWindowDimensions()
  // On mobile web the card uses a BOUNDED bottom sheet (maps.me-style): the map
  // stays visible above it, the photo is a fixed hero, and the caption/actions
  // scroll beneath it so every element stays reachable and the photo never jerks
  // when «Ещё» expands. Desktop popup / native keep the compact bottom-sheet.
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
        userLocationRef,
        invalidateUserPoints: () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.userPointsAll() })
        },
      }),
    [colors, themeContextValue, queryClient, isFullscreenWeb],
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

  const bottomContentInset = (bottomInset || 0) + (insets?.bottom ?? 0) + 12

  // #497/#travel-point-card — native: the card fills the screen and the chrome
  // floats over the hero photo. Keeping the grabber/close button out of the normal
  // layout removes the wasted white header while still clearing the status bar.
  const safeTop = insets?.top ?? 0

  // On web, close via a NATIVE DOM handler instead of relying solely on RN-Web's
  // `onPress`. RN-Web synthesises `onPress` through its responder system over
  // pointer events; on the mobile bottom sheet the grabber hosts a swipe
  // responder and the hero popup is a separate responder subtree underneath, and
  // the responder hand-off can swallow the button's `pointerup` so `onPress`
  // never fires — the card stays mounted and freezes the lower ~82% of the map.
  // `onPointerDown` stops propagation so the sheet's swipe responder can't claim
  // the gesture; `onPointerUp` closes deterministically on touch + mouse. We do
  // NOT also wire `onClick` (it would double-fire after pointerup). `onPress`
  // stays for native. RN-Web passes these unknown props straight to the host
  // <div>, so this runs before/independently of the responder race.
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

  // Native close lives in the floating header overlay, outside the hero image
  // Pressable subtree, so Android gives it a reliable touch target without
  // reserving a separate white header row.
  const nativeHeaderClose = (
    <Pressable
      testID="map-place-bottom-card-close"
      onPress={handleClose}
      accessibilityRole="button"
      accessibilityLabel="Закрыть карточку места"
      hitSlop={12}
      style={({ pressed }) => [styles.headerCloseButton, pressed && { opacity: 0.6 }]}
    >
      <Feather name="x" size={20} color={colors.text} />
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
              paddingTop: insets?.top ?? 0,
              paddingBottom: (bottomInset || 0) + (insets?.bottom ?? 0),
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

  return (
    <View
      style={[
        styles.root,
        IS_WEB ? { paddingBottom: bottomContentInset } : null,
      ]}
      testID="map-place-bottom-card"
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        {IS_WEB ? (
          <>
            <View style={styles.handleZone} {...(webSwipeHandlers ?? {})}>
              <View style={styles.grabber} />
            </View>
            <View style={styles.body}>
              <PopupComponent point={point} closePopup={handleClose} />
            </View>
          </>
        ) : (
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={[
              styles.body,
              styles.bodyNative,
              { paddingBottom: bottomContentInset },
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <PopupComponent point={point} closePopup={handleClose} />
          </ScrollView>
        )}

        {IS_WEB ? closeButton : (
          <View
            pointerEvents="box-none"
            style={[styles.floatingHeader, { top: safeTop + 8 }]}
            {...(nativeSwipeHandlers ?? {})}
          >
            <View style={styles.floatingGrabber} />
            {nativeHeaderClose}
          </View>
        )}
      </View>
    </View>
  )
}

export default React.memo(MapPlaceBottomCard)

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    root: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: IS_WEB ? 8 : 0,
      // Native: stretch the container edge-to-edge top→bottom so the card can fill
      // the whole screen (fullscreen place card). Web keeps the bounded sheetRoot.
      ...(IS_WEB ? ({ zIndex: 1200 } as any) : { top: 0 }),
    },
    // Mobile web BOUNDED bottom sheet (maps.me-style): anchored to the visible
    // viewport bottom so the map shows above it. Web-only (guarded by isFullscreenWeb).
    sheetRoot: {
      ...(IS_WEB
        ? ({
            position: 'fixed',
            left: 0,
            right: 0,
            // Anchor to the VISIBLE (`dvh`) viewport bottom so iOS Safari's dynamic
            // toolbar doesn't push the card under the fold.
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
      // Fullscreen on mobile web: the card covers the whole viewport (no map peek),
      // so square top corners read as a true full-screen surface, not a sheet.
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      // (Top safe-area paddingTop is applied inline — `insets` isn't in getStyles scope.)
      // Fullscreen height: the split layout inside flexes to fill the viewport
      // (hero photo grows + scrollable caption/actions below it).
      ...(IS_WEB
        ? ({
            display: 'flex',
            flexDirection: 'column',
            height: '100dvh',
            maxHeight: '100dvh',
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
        : {
            // Native fullscreen: fill the whole screen (no maxWidth / corner radii /
            // border). flex:1 lets the body ScrollView stretch from safeTop to bottom.
            flex: 1,
          }),
    },
    handleZone: {
      paddingTop: 8,
      paddingBottom: 4,
      alignItems: 'center',
      justifyContent: 'center',
      ...(IS_WEB ? ({ cursor: 'grab', touchAction: 'none' } as any) : null),
    },
    // Native: the header row holds the centered grabber AND a real in-bounds ✕
    // pinned to the right (the absolute-over-photo button did not receive taps on
    // Android). Extra height/padding gives the ✕ a comfortable tap target.
    handleZoneNative: {
      minHeight: 44,
      paddingTop: 10,
      paddingBottom: 6,
      paddingHorizontal: 8,
    },
    floatingHeader: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
      elevation: 20,
    },
    floatingGrabber: {
      width: 46,
      height: 5,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.82)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(15,23,42,0.22)',
    },
    headerCloseButton: {
      position: 'absolute',
      right: 12,
      top: 4,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.86)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(15,23,42,0.16)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.14,
      shadowRadius: 8,
      elevation: 21,
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
      // Dark pill + bright ring + shadow keeps ✕ legible on any photo (light or dark).
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
      // Larger tap target on the fullscreen card; overlays the hero's top-right
      // corner. `top` is set inline (insets.top + 12) so ✕ clears the notch.
      width: 44,
      height: 44,
      borderRadius: 22,
      right: 12,
      // Mobile web: a live backdrop-filter blur here forces a GPU recomposite of
      // the map region when the sheet unmounts (jank on close, CLAUDE.md arch #2).
      // Use a static opaque frost instead — ✕ stays legible on any photo.
      backgroundColor: 'rgba(0,0,0,0.6)',
      ...(IS_WEB
        ? ({
            zIndex: 10,
          } as any)
        : null),
    },
    // #497 — native scroll region for the body inside the fullscreen card. flex:1
    // fills the space below the sticky header; only the body scrolls when «Ещё»
    // expands, so the header keeps its height and never leaves the screen top.
    bodyScroll: {
      flex: 1,
    },
    body: {
      // Photo runs edge-to-edge: the popup card's own contentContainer/footerContainer
      // carry the horizontal padding for the caption/actions below the hero.
      paddingHorizontal: 0,
      paddingBottom: 4,
    },
    bodyNative: {
      flexGrow: 1,
    },
  })
