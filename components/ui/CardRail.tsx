import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

const IS_WEB = Platform.OS === 'web'

// Клик по стрелке листает почти на экран, оставляя «якорную» карточку в поле
// зрения — так пользователь не теряет контекст между страницами рельсы.
const SCROLL_PAGE_RATIO = 0.85
const MIN_SCROLL_STEP = 240
// Субпиксельные хвосты scrollLeft не должны зажигать стрелку в крайнем положении.
const EDGE_EPSILON = 4

type Props = {
  children: React.ReactNode
  /** Горизонтальный зазор между карточками. */
  gap?: number
  /** Внутренние отступы контента (чтобы тени/фокус-кольца не срезались). */
  contentPaddingHorizontal?: number
  contentPaddingVertical?: number
  testID?: string
  accessibilityLabel?: string
  /** Принудительно скрыть стрелки (например, если секция сама рисует навигацию). */
  hideArrows?: boolean
}

type ArrowProps = {
  direction: 'left' | 'right'
  onPress: () => void
  colors: ReturnType<typeof useThemedColors>
  styles: ReturnType<typeof createStyles>
}

const RailArrow = memo(function RailArrow({ direction, onPress, colors, styles }: ArrowProps) {
  const isLeft = direction === 'left'
  return (
    <View style={[styles.arrowSlot, isLeft ? styles.arrowSlotLeft : styles.arrowSlotRight]} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        style={({ hovered, pressed }: any) => [
          styles.arrowButton,
          hovered && styles.arrowButtonHovered,
          pressed && styles.arrowButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={isLeft ? i18nT('common:rail.scrollPrev') : i18nT('common:rail.scrollNext')}
        testID={`card-rail-arrow-${direction}`}
      >
        <Feather name={isLeft ? 'chevron-left' : 'chevron-right'} size={22} color={colors.text} />
      </Pressable>
    </View>
  )
})

/**
 * Горизонтальная рельса карточек с доступной навигацией.
 *
 * Зачем: на десктопе у мыши нет горизонтального колеса, а системный скроллбар
 * скрыт — карточки, торчащие за правый край, оказывались недостижимы. Стрелки
 * появляются только когда реально есть куда листать в эту сторону.
 */
function CardRail({
  children,
  gap = 16,
  contentPaddingHorizontal = 4,
  contentPaddingVertical = 4,
  testID,
  accessibilityLabel,
  hideArrows = false,
}: Props) {
  const colors = useThemedColors()
  const { isMobile } = useResponsive()
  const styles = useMemo(
    () => createStyles(colors, gap, contentPaddingHorizontal, contentPaddingVertical),
    [colors, gap, contentPaddingHorizontal, contentPaddingVertical],
  )

  const scrollRef = useRef<ScrollView>(null)
  const offsetX = useRef(0)
  const contentWidth = useRef(0)
  const layoutWidth = useRef(0)

  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Стрелки — только десктопный веб: на тач-устройствах есть родной свайп.
  const arrowsEnabled = IS_WEB && !isMobile && !hideArrows

  // На вебе меряем сам DOM-узел: onLayout/onContentSizeChange от RNW для
  // горизонтального ScrollView приходят не всегда и не с теми размерами,
  // из-за чего стрелки не показывались вовсе.
  const getWebNode = useCallback((): HTMLElement | null => {
    if (!IS_WEB) return null
    const host = scrollRef.current as unknown as { getScrollableNode?: () => unknown } | null
    const node = host?.getScrollableNode?.() as HTMLElement | undefined
    return node && typeof node.scrollWidth === 'number' ? node : null
  }, [])

  // Считаем всегда, а показ стрелок гейтим на рендере: размеры приходят раньше,
  // чем useResponsive отдаёт финальный breakpoint.
  const recompute = useCallback(() => {
    const node = getWebNode()
    if (node) {
      offsetX.current = node.scrollLeft
      layoutWidth.current = node.clientWidth
      contentWidth.current = node.scrollWidth
    }
    const x = offsetX.current
    const content = contentWidth.current
    const layout = layoutWidth.current
    setCanScrollLeft(x > EDGE_EPSILON)
    setCanScrollRight(layout > 0 && x + layout < content - EDGE_EPSILON)
  }, [getWebNode])

  // Контент рельсы приезжает асинхронно (данные + картинки), поэтому досчитываем
  // ещё несколько раз после маунта — иначе стрелка не появится до первого скролла.
  useEffect(() => {
    recompute()
    if (!IS_WEB) return
    const raf = requestAnimationFrame(recompute)
    const timers = [120, 400, 1000].map((ms) => setTimeout(recompute, ms))
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
    }
  }, [recompute, children])

  const handleScroll = useCallback(
    (event: any) => {
      const nativeEvent = event?.nativeEvent
      if (!nativeEvent) return
      offsetX.current = nativeEvent.contentOffset?.x ?? 0
      contentWidth.current = nativeEvent.contentSize?.width ?? contentWidth.current
      layoutWidth.current = nativeEvent.layoutMeasurement?.width ?? layoutWidth.current
      recompute()
    },
    [recompute],
  )

  const handleLayout = useCallback(
    (event: any) => {
      layoutWidth.current = event?.nativeEvent?.layout?.width ?? 0
      recompute()
    },
    [recompute],
  )

  const handleContentSizeChange = useCallback(
    (width: number) => {
      contentWidth.current = width
      recompute()
    },
    [recompute],
  )

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const step = Math.max(MIN_SCROLL_STEP, layoutWidth.current * SCROLL_PAGE_RATIO) * direction
    const maxOffset = Math.max(0, contentWidth.current - layoutWidth.current)
    const next = Math.min(maxOffset, Math.max(0, offsetX.current + step))

    // На вебе двигаем scrollLeft напрямую. Всё остальное здесь не работает:
    // RNW перезаписывает scrollTo и на DOM-узле, и на рефе своей RN-сигнатурой
    // (y, x, animated), а любую плавную программную прокрутку (scroll-behavior
    // smooth / scrollBy behavior:'smooth') отменяет scroll-snap на контейнере.
    const node = getWebNode()
    if (node) {
      node.scrollLeft = next
    } else {
      scrollRef.current?.scrollTo({ x: next, animated: true })
    }

    // onScroll во время анимации может не успеть обновить состояние стрелок,
    // поэтому двигаем известную позицию сразу.
    offsetX.current = next
    recompute()
  }, [getWebNode, recompute])

  return (
    <View style={styles.wrapper} testID={testID}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onLayout={handleLayout}
        onContentSizeChange={handleContentSizeChange}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </ScrollView>

      {arrowsEnabled && canScrollLeft && (
        <RailArrow direction="left" onPress={() => scrollByPage(-1)} colors={colors} styles={styles} />
      )}
      {arrowsEnabled && canScrollRight && (
        <RailArrow direction="right" onPress={() => scrollByPage(1)} colors={colors} styles={styles} />
      )}
    </View>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  gap: number,
  paddingHorizontal: number,
  paddingVertical: number,
) =>
  StyleSheet.create({
    wrapper: {
      position: 'relative',
      width: '100%',
    },
    scroll: {
      width: '100%',
      ...Platform.select({
        web: {
          scrollSnapType: 'x mandatory',
          overscrollBehaviorX: 'contain',
        } as any,
        default: {},
      }),
    },
    content: {
      flexDirection: 'row',
      gap,
      paddingHorizontal,
      paddingVertical,
    },
    arrowSlot: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      // Слот шире кнопки: перехватывает только зону самой стрелки, остальное
      // остаётся кликабельным для карточек под ним (pointerEvents="box-none").
      width: 56,
      zIndex: 2,
    },
    arrowSlotLeft: { left: -6, alignItems: 'flex-start' },
    arrowSlotRight: { right: -6, alignItems: 'flex-end' },
    arrowButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          transition: 'transform 0.18s ease, background-color 0.18s ease',
        } as any,
        default: {},
      }),
    },
    arrowButtonHovered: {
      backgroundColor: colors.surfaceElevated ?? colors.surface,
      ...Platform.select({ web: { transform: 'scale(1.06)' } as any, default: {} }),
    },
    arrowButtonPressed: {
      ...Platform.select({ web: { transform: 'scale(0.96)' } as any, default: {} }),
      opacity: 0.9,
    },
  })

export default memo(CardRail)
