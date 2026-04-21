/**
 * MapChipPopover — wrapper anchored to a chip button.
 * Web: absolute popover under the anchor.
 * Narrow screens / native: bottom-sheet style modal.
 */
import React, { useEffect, useMemo } from 'react'
import {
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

const BOTTOM_SHEET_MAX_WIDTH = 430
const WEB_MOBILE_BOTTOM_CHROME_INSET = 104

interface AnchorRect {
  x: number
  y: number
  width: number
  height: number
}

interface MapChipPopoverProps {
  visible: boolean
  onClose: () => void
  anchor?: AnchorRect | null
  children: React.ReactNode
  testID?: string
  maxWidth?: number
}

export const MapChipPopover: React.FC<MapChipPopoverProps> = ({
  visible,
  onClose,
  anchor,
  children,
  testID,
  maxWidth = 360,
}) => {
  const colors = useThemedColors()
  const { width, height } = useWindowDimensions()
  const isNarrow = width > 0 && width <= BOTTOM_SHEET_MAX_WIDTH
  const useBottomSheet = Platform.OS !== 'web' || isNarrow

  const styles = useMemo(() => getStyles(colors), [colors])

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [visible, onClose])

  useEffect(() => {
    if (!visible || Platform.OS === 'web') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [visible, onClose])

  const popoverPosition = useMemo(() => {
    if (useBottomSheet || !anchor) return null
    const desiredWidth = Math.min(maxWidth, Math.max(260, anchor.width))
    let left = anchor.x
    if (left + desiredWidth > width - 12) left = Math.max(12, width - desiredWidth - 12)
    if (left < 12) left = 12
    const top = anchor.y + anchor.height + 8
    const maxHeight = Math.max(180, height - top - 24)
    return { left, top, width: desiredWidth, maxHeight }
  }, [anchor, height, maxWidth, useBottomSheet, width])

  if (!visible) return null

  if (Platform.OS === 'web' && isNarrow) {
    return (
      <View style={styles.webOverlay} testID={testID}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={onClose}
          accessibilityLabel="Закрыть"
        >
          <Pressable
            style={[styles.sheetContainer, styles.sheetContainerWeb]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.sheetHandle} />
            {children}
          </Pressable>
        </Pressable>
      </View>
    )
  }

  if (useBottomSheet) {
    return (
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={onClose}
        testID={testID}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={onClose}
          accessibilityLabel="Закрыть"
        >
          <Pressable
            style={[
              styles.sheetContainer,
              Platform.OS === 'web' ? styles.sheetContainerWeb : null,
            ]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.sheetHandle} />
            {children}
          </Pressable>
        </Pressable>
      </Modal>
    )
  }

  if (!popoverPosition) return null

  return (
    <View
      style={styles.webOverlay}
      pointerEvents="box-none"
      testID={testID}
      {...({
        onClick: (e: any) => {
          if (e?.target === e?.currentTarget) onClose()
        },
      } as any)}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Закрыть"
      />
      <View
        style={[
          styles.popover,
          {
            left: popoverPosition.left,
            top: popoverPosition.top,
            width: popoverPosition.width,
            maxHeight: popoverPosition.maxHeight,
          },
        ]}
      >
        {children}
      </View>
    </View>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    webOverlay: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2100,
      ...(Platform.OS === 'web' ? ({ position: 'fixed' } as any) : null),
    },
    popover: {
      position: 'absolute',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 20px 44px rgba(17,24,39,0.18), 0 6px 18px rgba(17,24,39,0.10)',
          } as any)
        : colors.shadows.medium),
    },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
      ...(Platform.OS === 'web'
        ? ({
            zIndex: 6000,
          } as any)
        : null),
    },
    sheetContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 8,
      paddingBottom: 24,
      maxHeight: '85%',
      ...(Platform.OS === 'web'
        ? ({
            zIndex: 6001,
          } as any)
        : null),
    },
    sheetContainerWeb: {
      marginBottom: WEB_MOBILE_BOTTOM_CHROME_INSET,
      maxHeight: `calc(100% - ${WEB_MOBILE_BOTTOM_CHROME_INSET + 24}px)`,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderLight,
      marginBottom: 8,
    },
  })

export type { AnchorRect }
