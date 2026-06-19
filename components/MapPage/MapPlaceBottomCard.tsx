import React, { useEffect, useMemo, useRef } from 'react'
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
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
        if (dy > SWIPE_CLOSE_THRESHOLD_PX) onClose()
      },
    } as any
  }, [onClose])

  if (!point) return null

  const paddingBottom = (bottomInset || 0) + (insets?.bottom ?? 0) + 12

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
          onClose()
        },
      } as any)
    : null

  const closeButton = (
    // Rendered after the body so it paints on top of the edge-to-edge hero
    // photo (RN has no zIndex across siblings without elevation); dark pill
    // + white glyph keeps it visible on any image.
    <Pressable
      testID="map-place-bottom-card-close"
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="Закрыть карточку места"
      hitSlop={10}
      style={({ pressed }) => [
        styles.closeButton,
        isFullscreenWeb && styles.closeButtonFullscreen,
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
            { paddingBottom: (bottomInset || 0) + (insets?.bottom ?? 0) },
          ]}
          {...({ pointerEvents: 'auto' } as any)}
        >
          <View style={styles.handleZone} {...(webSwipeHandlers ?? {})}>
            <View style={styles.grabber} />
          </View>
          <PopupComponent point={point} closePopup={onClose} />
          {closeButton}
        </View>
      </View>
    )
  }

  return (
    <View
      style={[styles.root, { paddingBottom }]}
      testID="map-place-bottom-card"
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        <View style={styles.handleZone} {...(webSwipeHandlers ?? {})}>
          <View style={styles.grabber} />
        </View>

        <View style={styles.body}>
          <PopupComponent point={point} closePopup={onClose} />
        </View>

        {closeButton}
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
      paddingHorizontal: 8,
      ...(IS_WEB ? ({ zIndex: 1200 } as any) : null),
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
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      // Bounded height: the photo is dominant but the map stays visible above the
      // sheet. The split layout inside flexes to fill this box (hero + scroll body).
      ...(IS_WEB
        ? ({
            display: 'flex',
            flexDirection: 'column',
            height: 'min(82dvh, 720px)',
            maxHeight: '82dvh',
            boxShadow: '0 -8px 28px rgba(15,23,42,0.22)',
          } as any)
        : null),
    },
    card: {
      width: '100%',
      alignSelf: 'center',
      maxWidth: 560,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      ...(IS_WEB
        ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 16,
          }),
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
      // Larger tap target on the bounded bottom sheet; overlays the hero's top-right
      // corner. The sheet no longer touches the top safe area, so a plain inset is fine.
      width: 44,
      height: 44,
      borderRadius: 22,
      right: 12,
      backgroundColor: 'rgba(0,0,0,0.6)',
      ...(IS_WEB
        ? ({
            top: 12,
            zIndex: 10,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          } as any)
        : null),
    },
    body: {
      // Photo runs edge-to-edge: the popup card's own contentContainer/footerContainer
      // carry the horizontal padding for the caption/actions below the hero.
      paddingHorizontal: 0,
      paddingBottom: 4,
    },
  })
