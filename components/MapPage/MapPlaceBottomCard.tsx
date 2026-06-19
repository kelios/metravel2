import React, { useEffect, useMemo, useRef } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
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
  // On mobile web the tall, photo-dominant card frequently exceeds the viewport
  // height: pinned to bottom:0 with no scroll it overflows above the screen, so
  // the ♥/＋ buttons + title (and the close button) become unreachable. Promote
  // it to a real fullscreen, scrollable sheet there. Desktop popup / native keep
  // the compact bottom-sheet.
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
        userLocationRef,
        invalidateUserPoints: () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.userPointsAll() })
        },
      }),
    [colors, themeContextValue, queryClient],
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
    >
      <Feather name="x" size={18} color="#fff" />
    </Pressable>
  )

  // Mobile web: fullscreen, scrollable sheet so every element (♥/＋, title,
  // address, actions, close) stays on-screen and tappable regardless of photo
  // height. The card itself is the interactive surface — the box-none root lets
  // empty areas fall through, but the fullscreen card covers the whole viewport.
  if (isFullscreenWeb) {
    return (
      <View
        style={styles.fullscreenRoot}
        testID="map-place-bottom-card"
        {...({ pointerEvents: 'auto' } as any)}
      >
        <View style={styles.fullscreenCard}>
          <ScrollView
            testID="map-place-bottom-card-scroll"
            style={styles.fullscreenScroll}
            contentContainerStyle={[
              styles.fullscreenScrollContent,
              { paddingBottom: (insets?.bottom ?? 0) + 24 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            {...({ 'data-card-action': 'true' } as any)}
          >
            <PopupComponent point={point} closePopup={onClose} />
          </ScrollView>
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
    // Mobile web fullscreen sheet: a fixed full-viewport layer above the map and
    // the global bottom dock. Web-only (guarded by isFullscreenWeb at the call site).
    fullscreenRoot: {
      ...(IS_WEB
        ? ({
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 5000,
          } as any)
        : null),
    },
    fullscreenCard: {
      flex: 1,
      width: '100%',
      height: '100%',
      backgroundColor: colors.surface,
      position: 'relative',
      overflow: 'hidden',
    },
    fullscreenScroll: {
      flex: 1,
      width: '100%',
      ...(IS_WEB ? ({ WebkitOverflowScrolling: 'touch' } as any) : null),
    },
    fullscreenScrollContent: {
      // The hero photo runs edge-to-edge; PlacePopupCard's own contentContainer /
      // footerContainer carry the horizontal padding for the caption + actions.
      flexGrow: 1,
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
      backgroundColor: 'rgba(15,23,42,0.55)',
      ...(IS_WEB ? ({ zIndex: 5 } as any) : { elevation: 6 }),
    },
    closeButtonFullscreen: {
      // Larger tap target + clear of the notch/safe area; sits above the scroll
      // region so it is always reachable on the fullscreen mobile-web sheet.
      width: 44,
      height: 44,
      borderRadius: 22,
      right: 12,
      backgroundColor: 'rgba(15,23,42,0.6)',
      ...(IS_WEB
        ? ({
            top: 'max(12px, env(safe-area-inset-top, 12px))' as any,
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
