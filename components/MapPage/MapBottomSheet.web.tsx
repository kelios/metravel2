/**
 * Web-only MapBottomSheet implementation.
 *
 * IMPORTANT: Do not import `@gorhom/bottom-sheet` on web — its initialisation
 * depends on Reanimated/Worklets and can crash the web bundle.
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useBottomSheetStore } from '@/stores/bottomSheetStore'
import { LAYOUT } from '@/constants/layout'
import { DESIGN_TOKENS } from '@/constants/designSystem'

type SheetState = 'collapsed' | 'quarter' | 'half' | 'full'
type SheetIndex = -1 | 0 | 1 | 2

const OPEN_DEBOUNCE_MS = 250
const SHORT_VIEWPORT_BREAKPOINT_PX = 700
const SNAP_RATIOS_TALL: readonly [number, number, number] = [0.25, 0.55, 1]
const SNAP_RATIOS_SHORT: readonly [number, number, number] = [0.3, 0.62, 1]

const STATE_TO_INDEX: Record<SheetState, SheetIndex> = {
  collapsed: -1,
  quarter: 0,
  half: 1,
  full: 2,
}

interface MapBottomSheetProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  peekContent?: React.ReactNode
  bottomInset?: number
  onStateChange?: (state: SheetState) => void
}

export interface MapBottomSheetRef {
  snapToCollapsed: () => void
  snapToQuarter: () => void
  snapToHalf: () => void
  snapToFull: () => void
  close: () => void
}

const MapBottomSheet = forwardRef<MapBottomSheetRef, MapBottomSheetProps>(
  ({ children, title, subtitle, peekContent, bottomInset = 0, onStateChange }, ref) => {
    const colors = useThemedColors()
    const styles = useMemo(() => getStyles(colors), [colors])
    const setBottomSheetHeightPx = useBottomSheetStore((s) => s.setHeightPx)
    const lastProgrammaticOpenTsRef = useRef(0)
    const [sheetIndex, setSheetIndex] = useState<SheetIndex>(-1)
    const { height: windowHeight } = useWindowDimensions()
    const webDomRef = useRef<HTMLElement | null>(null)

    const snapTo = useCallback(
      (state: SheetState) => {
        const idx = STATE_TO_INDEX[state]
        if (state !== 'collapsed') lastProgrammaticOpenTsRef.current = Date.now()
        setSheetIndex(idx)
        onStateChange?.(state)
      },
      [onStateChange],
    )

    useImperativeHandle(
      ref,
      () => ({
        snapToCollapsed: () => snapTo('collapsed'),
        snapToQuarter: () => snapTo('quarter'),
        snapToHalf: () => snapTo('half'),
        snapToFull: () => snapTo('full'),
        close: () => snapTo('collapsed'),
      }),
      [snapTo],
    )

    const isCollapsed = sheetIndex < 0
    const isFullScreen = sheetIndex === 2
    const hiddenWhenCollapsed = isCollapsed && !peekContent
    const contentBottomPadding = isCollapsed ? 12 + bottomInset : 12
    const fullScreenTopInset = LAYOUT.headerHeight
    const snapRatios =
      windowHeight < SHORT_VIEWPORT_BREAKPOINT_PX ? SNAP_RATIOS_SHORT : SNAP_RATIOS_TALL

    const openHeight = isCollapsed
      ? 0
      : isFullScreen
        ? Math.max(0, windowHeight - fullScreenTopInset - bottomInset)
        : Math.round(windowHeight * (snapRatios[sheetIndex as 0 | 1] ?? 0.55))

    const webRefCallback = useCallback((node: View | null) => {
      webDomRef.current = node as unknown as HTMLElement | null
    }, [])

    // Apply height imperatively — RN Web View ignores pixel height set via style props.
    useEffect(() => {
      const node = webDomRef.current
      if (!node) return
      if (isCollapsed) {
        node.style.height = peekContent ? 'auto' : '0px'
        node.style.maxHeight = peekContent ? 'none' : '0px'
      } else {
        node.style.height = `${openHeight}px`
        node.style.maxHeight = `${openHeight}px`
      }
    }, [isCollapsed, openHeight, peekContent])

    useEffect(() => {
      setBottomSheetHeightPx(openHeight)
    }, [openHeight, setBottomSheetHeightPx])

    useEffect(
      () => () => {
        setBottomSheetHeightPx(0)
      },
      [setBottomSheetHeightPx],
    )

    const handleClose = useCallback(() => {
      const dt = Date.now() - lastProgrammaticOpenTsRef.current
      if (dt < OPEN_DEBOUNCE_MS) return
      snapTo('collapsed')
    }, [snapTo])

    const handlePeekTap = useCallback(() => snapTo('quarter'), [snapTo])

    const bottomStyle = {
      bottom: `calc(${bottomInset}px + env(safe-area-inset-bottom, 0px))`,
    } as any

    return (
      <View
        ref={webRefCallback}
        style={[
          styles.webRoot,
          isFullScreen && styles.webRootFullScreen,
          isCollapsed && styles.webRootCollapsed,
          hiddenWhenCollapsed && styles.webRootHidden,
          { ...bottomStyle, pointerEvents: hiddenWhenCollapsed ? 'none' : 'auto' },
        ]}
        accessibilityLabel="Панель карты"
      >
        <Pressable
          onPress={isCollapsed ? handlePeekTap : handleClose}
          style={styles.dragHandleArea}
          accessibilityLabel={isCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
          accessibilityRole="button"
        >
          <View style={styles.dragHandle} />
        </Pressable>

        {!isCollapsed && (title || subtitle) && (
          <View style={styles.header}>
            <View style={styles.headerContent}>
              {!!title && (
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>{title}</Text>
                  {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                </View>
              )}
            </View>
          </View>
        )}

        <View
          style={[
            styles.contentContainer,
            isCollapsed && styles.contentContainerPeek,
            { paddingBottom: contentBottomPadding },
          ]}
        >
          {isCollapsed ? peekContent : children}
        </View>
      </View>
    )
  },
)

MapBottomSheet.displayName = 'MapBottomSheet'

export default MapBottomSheet

const PANEL_RADIUS = DESIGN_TOKENS.radii.lg
const PILL_RADIUS = DESIGN_TOKENS.radii.pill

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    webRoot: {
      position: 'fixed',
      left: 0,
      right: 0,
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: PANEL_RADIUS,
      borderTopRightRadius: PANEL_RADIUS,
      overflow: 'hidden',
      boxShadow: colors.boxShadows.heavy,
      transition: 'height 200ms ease-out',
    } as any,
    webRootFullScreen: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
    webRootCollapsed: { overflow: 'visible' as any },
    webRootHidden: { visibility: 'hidden', opacity: 0 } as any,
    dragHandleArea: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 8,
      paddingBottom: 6,
      cursor: 'pointer',
      touchAction: 'manipulation',
    } as any,
    dragHandle: {
      width: 40,
      height: 4,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.borderStrong,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerContent: { flex: 1, minWidth: 0 },
    titleContainer: { flexDirection: 'column', gap: 2 },
    title: { fontSize: 16, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 12, color: colors.textMuted },
    contentContainer: {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      overscrollBehavior: 'contain',
    } as any,
    contentContainerPeek: { height: 'auto', minHeight: 0, overflow: 'visible' } as any,
  })
