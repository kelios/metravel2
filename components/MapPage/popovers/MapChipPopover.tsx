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
import Feather from '@expo/vector-icons/Feather'

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
          <View
            style={[styles.sheetContainer, styles.sheetContainerWeb]}
            {...({
              role: 'dialog',
              'aria-modal': true,
              onClick: (e: any) => e.stopPropagation?.(),
            } as any)}
          >
            <View style={styles.sheetChrome}>
              <View style={styles.sheetHandle} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Закрыть фильтр"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  styles.closeButtonFloating,
                  pressed && styles.closeButtonPressed,
                ]}
                testID="map-chip-popover-close"
              >
                <Feather name="x" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.sheetContent}>{children}</View>
          </View>
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
            <View style={styles.sheetChrome}>
              <View style={styles.sheetHandle} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Закрыть фильтр"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  styles.closeButtonFloating,
                  pressed && styles.closeButtonPressed,
                ]}
                testID="map-chip-popover-close"
              >
                <Feather name="x" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.sheetContent}>{children}</View>
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
        {...({
          role: 'dialog',
          onClick: (e: any) => e.stopPropagation?.(),
        } as any)}
      >
        <View style={styles.popoverChrome}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Закрыть фильтр"
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            testID="map-chip-popover-close"
          >
            <Feather name="x" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.popoverContent}>{children}</View>
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
    popoverChrome: {
      paddingTop: 8,
      paddingHorizontal: 10,
      alignItems: 'flex-end',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    popoverContent: {
      flex: 1,
      minHeight: 0,
    },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.55)',
      justifyContent: 'flex-end',
      ...(Platform.OS === 'web'
        ? ({
            zIndex: 6000,
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          } as any)
        : null),
    },
    sheetContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 0,
      paddingBottom: 12,
      maxHeight: '90%',
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            zIndex: 6001,
            boxShadow: '0 -14px 40px rgba(15,23,42,0.18)',
          } as any)
        : null),
    },
    sheetContainerWeb: {
      marginBottom: WEB_MOBILE_BOTTOM_CHROME_INSET,
      paddingBottom: 0,
      maxHeight: `calc(100% - ${WEB_MOBILE_BOTTOM_CHROME_INSET + 24}px)`,
    },
    sheetChrome: {
      position: 'relative',
      minHeight: 44,
      justifyContent: 'center',
      paddingTop: 8,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderLight,
      marginBottom: 8,
    },
    sheetContent: {
      flex: 1,
      minHeight: 0,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSecondary ?? colors.backgroundSecondary ?? colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            cursor: 'pointer',
            transition: 'opacity 0.18s ease',
          } as any)
        : null),
    },
    closeButtonPressed: {
      opacity: 0.7,
    },
    closeButtonFloating: {
      position: 'absolute',
      top: 4,
      right: 12,
    },
  })

export type { AnchorRect }
