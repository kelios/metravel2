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
import { Pressable, StyleSheet, Text, View } from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'

type SheetState = 'collapsed' | 'quarter' | 'half' | 'seventy' | 'full'

const OPEN_DEBOUNCE_MS = 250
// 70% snap (index 2) is the size all three top-overlay icons open the sheet to:
// big enough to show search + categories + layers, без перехода в full.
const NATIVE_SNAP_POINTS = ['30%', '58%', '70%', '86%']
const SNAP_INDEX_QUARTER = 0
const SNAP_INDEX_HALF = 1
const SNAP_INDEX_SEVENTY = 2
const SNAP_INDEX_FULL = 3
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
  snapToSeventy: () => void
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
    const insets = useSafeAreaInsets()
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
        snapToSeventy: () => snapToIndex(SNAP_INDEX_SEVENTY),
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
        const states: SheetState[] = ['quarter', 'half', 'seventy', 'full']
        onStateChange(states[index] ?? 'collapsed')
      },
      [onStateChange],
    )

    // Backdrop + dismiss-Pressable монтируются ТОЛЬКО на FULL-снапе.
    //
    // Регрессия #217 (Android touch-dead): BottomSheetBackdrop от @gorhom рендерит
    // absoluteFill-`Animated.View` со СВОИМ `pointerEvents` (init = 'auto', т.к.
    // enableTouchThrough=false по умолчанию). При свёрнутой/half-шторке его узел
    // [0,461][1080,2410] лежал прозрачным слоем поверх всей карты и съедал pan/zoom/
    // тапы по маркерам — `box-none` на нашей обёртке это НЕ чинит, т.к. ребёнок сам
    // ставит 'auto'. Дим всё равно появляется только на full (appearsOnIndex=FULL),
    // поэтому ниже full backdrop не нужен вовсе — не монтируем его => касания над
    // свёрнутой шторкой проходят к карте, а собственные жесты шторки (drag/handle,
    // pan по контенту) живут в BottomSheetBody/Handle и не затронуты.
    const renderBackdrop = useCallback(
      (props: any) => {
        if (!isFullySnapped) return null
        return (
          <View
            testID="map-panel-overlay"
            style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}
          >
            <BottomSheetBackdrop
              {...props}
              disappearsOnIndex={SNAP_INDEX_SEVENTY}
              appearsOnIndex={SNAP_INDEX_FULL}
              opacity={0.5}
              pressBehavior="none"
            />
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
          </View>
        )
      },
      [isFullySnapped],
    )

    const hasHeaderText = !!(title || subtitle)
    // bottomInset уже учитывает глобальный таб-бар; добавляем системную
    // навигацию (gesture-bar/кнопки), чтобы нижние карточки не заезжали под неё.
    const contentBottomPadding =
      CONTENT_BOTTOM_PADDING + bottomInset + insets.bottom

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={NATIVE_SNAP_POINTS}
        enableDynamicSizing={false}
        bottomInset={bottomInset}
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        // Keep scroll gestures inside BottomSheetFlatList/ScrollView from
        // resizing the map sheet. Height changes should happen via the handle
        // or explicit snapTo* commands, not while the user scrolls list cards.
        enableContentPanningGesture={false}
        enableOverDrag={false}
        // Keyboard-avoidance for BottomSheetTextInput (place-name search): on
        // focus the sheet pans up so the input + results sit above the keyboard
        // instead of being hidden behind it (blind typing on Android). `extend`
        // grows the sheet to the top snap so the results list stays visible;
        // `adjustResize` lets Android resize the sheet rather than overlap it.
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        enablePanDownToClose
        handleStyle={styles.handle}
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
          // Не BottomSheetView: он меряет детей и растёт под контент
          // (layout h == content h), из-за чего вложенный список считает,
          // что скроллить нечего. Плоский View с flex:1 ограничен высотой шторки.
          <View
            style={[styles.contentContainer, styles.staticContentContainer, { paddingBottom: contentBottomPadding }]}
          >
            {children}
          </View>
        )}
      </BottomSheet>
    )
  },
)

MapBottomSheet.displayName = 'MapBottomSheet'

export default MapBottomSheet

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    sheet: {
      // Лёгкая тень сверху над картой (native; web-шторка отдельный файл).
      shadowColor: DESIGN_TOKENS.colors.text,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 16,
    },
    background: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      // Нижние углы приклеены к низу экрана.
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    // Хэндл-обёртка над таб-полосой: воздух сверху/снизу, чтобы хваталка
    // не прижималась к сегмент-табам и читалась как отдельный элемент.
    handle: {
      paddingTop: 10,
      paddingBottom: 8,
      alignItems: 'center',
    },
    indicator: {
      // borderStrong контрастирует с surface и в светлой, и в тёмной теме
      // (colors.border сливался с белым фоном на Android).
      backgroundColor: colors.borderStrong,
      width: 40,
      height: 5,
      borderRadius: 3,
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
