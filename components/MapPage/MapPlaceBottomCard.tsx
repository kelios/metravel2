import React, { useEffect, useMemo, useRef } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
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

  return (
    <View
      style={[styles.root, { paddingBottom }]}
      testID="map-place-bottom-card"
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        <View style={styles.handleZone} {...(webSwipeHandlers ?? {})}>
          <View style={styles.grabber} />
          <Pressable
            testID="map-place-bottom-card-close"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Закрыть карточку места"
            hitSlop={10}
            style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
          >
            <Feather name="x" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <PopupComponent point={point} closePopup={onClose} />
        </View>
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
      top: 4,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    body: {
      // Photo runs edge-to-edge: the popup card's own contentContainer/footerContainer
      // carry the horizontal padding for the caption/actions below the hero.
      paddingHorizontal: 0,
      paddingBottom: 4,
    },
  })
