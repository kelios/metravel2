/**
 * MapMobilePopover — compact dropdown anchored under a top-overlay icon button.
 *
 * Used by the mobile map icon-toolbar for the Радиус and Слои entry points, so a
 * lightweight inline action does not need to open the 70% filters sheet.
 *
 * Cross-platform: pure RN primitives only (View / Pressable / absolute
 * positioning). No DOM-only API — works on RN Web and native alike.
 *
 * Behaviour:
 *  - Renders a full-screen transparent backdrop (Pressable) that closes the
 *    popover on a tap outside the card.
 *  - The card itself is absolutely positioned just below the toolbar icons
 *    (caller passes the resolved `top`) and pinned to the right edge (FAB-style),
 *    matching the icon toolbar.
 */
import React from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'

import type { ThemedColors } from '@/hooks/useTheme'

interface MapMobilePopoverProps {
  colors: ThemedColors
  /** Absolute top offset (safe-area + toolbar height + small gap). */
  top: number
  /**
   * Right edge offset of the card. Defaults to the mobile FAB-rail value (12).
   * The desktop floating «Слои» icon passes its own offset so the popover anchors
   * to that icon instead of the mobile toolbar.
   */
  right?: number
  /** Card max width. Defaults to 280 (mobile). Desktop uses a slightly wider card. */
  maxWidth?: number
  onRequestClose: () => void
  children: React.ReactNode
  testID?: string
}

const shadowWeb = {
  boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
} as const

const shadowNative = {
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.18,
  shadowRadius: 14,
  elevation: 8,
} as const

const MapMobilePopoverInner: React.FC<MapMobilePopoverProps> = ({
  colors,
  top,
  right = 12,
  maxWidth = 280,
  onRequestClose,
  children,
  testID,
}) => {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      testID={testID}
    >
      {/* Tap-outside catcher: closes the popover when tapping anywhere off-card. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onRequestClose}
        accessibilityRole="button"
        accessibilityLabel="Закрыть"
        testID={testID ? `${testID}-backdrop` : undefined}
      />

      <View
        style={[
          styles.card,
          {
            top,
            right,
            maxWidth,
            backgroundColor: colors.surface,
            borderColor: colors.borderLight,
          },
          Platform.OS === 'web' ? shadowWeb : shadowNative,
        ]}
        pointerEvents="auto"
      >
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    minWidth: 200,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
})

export const MapMobilePopover = React.memo(MapMobilePopoverInner)
