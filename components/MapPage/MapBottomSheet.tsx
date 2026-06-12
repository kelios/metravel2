/**
 * MapBottomSheet — native bottom sheet with three snap points.
 * Web has its own implementation in MapBottomSheet.web.tsx; this file is
 * resolved only for iOS/Android.
 */

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

type SheetState = 'collapsed' | 'quarter' | 'half' | 'full'

const OPEN_DEBOUNCE_MS = 250
const NATIVE_SNAP_POINTS = ['30%', '58%', '86%']
const SNAP_INDEX_QUARTER = 0
const SNAP_INDEX_HALF = 1
const SNAP_INDEX_FULL = 2
const CONTENT_BOTTOM_PADDING = 40

interface MapBottomSheetProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  peekContent?: React.ReactNode
  bottomInset?: number
  scrollableContent?: boolean
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
  ({
    children,
    title,
    subtitle,
    peekContent: _peekContent,
    bottomInset = 0,
    scrollableContent = true,
    onStateChange,
  }, ref) => {
    const colors = useThemedColors()
    const styles = useMemo(() => getStyles(colors), [colors])
    const bottomSheetRef = useRef<BottomSheet>(null)
    const lastProgrammaticOpenTsRef = useRef(0)

    const snapToIndex = useCallback((index: number) => {
      lastProgrammaticOpenTsRef.current = Date.now()
      bottomSheetRef.current?.snapToIndex(index)
    }, [])

    const closeSheet = useCallback(() => {
      bottomSheetRef.current?.close()
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        snapToCollapsed: closeSheet,
        snapToQuarter: () => snapToIndex(SNAP_INDEX_QUARTER),
        snapToHalf: () => snapToIndex(SNAP_INDEX_HALF),
        snapToFull: () => snapToIndex(SNAP_INDEX_FULL),
        close: closeSheet,
      }),
      [closeSheet, snapToIndex],
    )

    const [isFullySnapped, setIsFullySnapped] = useState(false)

    const handleSheetChanges = useCallback(
      (index: number) => {
        setIsFullySnapped(index === SNAP_INDEX_FULL)
        if (!onStateChange) return
        if (index < 0) {
          onStateChange('collapsed')
          return
        }
        const states: SheetState[] = ['quarter', 'half', 'full']
        onStateChange(states[index] ?? 'collapsed')
      },
      [onStateChange],
    )

    // Pressable монтируется только на FULL-снапе: постоянный absoluteFill-оверлей
    // перехватывает все касания карты (pan/zoom/маркеры) на Android.
    const renderBackdrop = useCallback(
      (props: any) => (
        <View
          testID="map-panel-overlay"
          style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}
        >
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={SNAP_INDEX_HALF}
            appearsOnIndex={SNAP_INDEX_FULL}
            opacity={0.5}
            pressBehavior="none"
          />
          {isFullySnapped && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                const dt = Date.now() - lastProgrammaticOpenTsRef.current
                if (dt < OPEN_DEBOUNCE_MS) return
                bottomSheetRef.current?.snapToIndex(SNAP_INDEX_QUARTER)
              }}
              accessibilityRole="button"
              accessibilityLabel="Закрыть панель карты"
            />
          )}
        </View>
      ),
      [isFullySnapped],
    )

    const hasHeaderText = !!(title || subtitle)
    const contentBottomPadding = CONTENT_BOTTOM_PADDING + bottomInset

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={NATIVE_SNAP_POINTS}
        enableDynamicSizing={false}
        bottomInset={bottomInset}
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        // Android: при самоскроллящемся контенте (таб «Места», plain FlatList)
        // контент-pan шторки перехватывает все вертикальные свайпы и список
        // не скроллится (gorhom v5 + reanimated 4, new arch). Шторку таскаем
        // только за хэндл; iOS-координация не тронута.
        enableContentPanningGesture={scrollableContent || Platform.OS !== 'android'}
        enablePanDownToClose
        handleIndicatorStyle={styles.indicator}
        backgroundStyle={styles.background}
        style={styles.sheet}
      >
        {hasHeaderText && (
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

        {scrollableContent ? (
          <BottomSheetScrollView
            contentContainerStyle={[styles.contentContainer, { paddingBottom: contentBottomPadding }]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView
            style={[styles.contentContainer, styles.staticContentContainer, { paddingBottom: contentBottomPadding }]}
          >
            {children}
          </BottomSheetView>
        )}
      </BottomSheet>
    )
  },
)

MapBottomSheet.displayName = 'MapBottomSheet'

export default MapBottomSheet

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    sheet: { ...(colors.shadows?.light ?? {}) },
    background: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    indicator: {
      backgroundColor: colors.borderLight,
      width: 24,
      height: 2,
      borderRadius: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerContent: { flex: 1 },
    titleContainer: { flexDirection: 'column' },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
      marginTop: 2,
    },
    contentContainer: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      flexGrow: 1,
    },
    staticContentContainer: {
      flex: 1,
      minHeight: 0,
    },
  })
