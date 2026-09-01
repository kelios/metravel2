import React, { memo, useCallback, useMemo, useRef } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { getScrollableWebNode, useHorizontalScrollEdges } from '@/hooks/useHorizontalScrollEdges'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

const IS_WEB = Platform.OS === 'web'

// Клик по стрелке листает почти на экран, оставляя «якорную» карточку в поле
// зрения — так пользователь не теряет контекст между страницами рельсы.
const SCROLL_PAGE_RATIO = 0.85
const MIN_SCROLL_STEP = 240

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
  const { canScrollLeft, canScrollRight, metricsRef, recompute, edgeScrollProps } =
    useHorizontalScrollEdges(scrollRef, children)

  // Стрелки — только десктопный веб: на тач-устройствах есть родной свайп.
  const arrowsEnabled = IS_WEB && !isMobile && !hideArrows

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const { offsetX, contentWidth, layoutWidth } = metricsRef.current
    const step = Math.max(MIN_SCROLL_STEP, layoutWidth * SCROLL_PAGE_RATIO) * direction
    const maxOffset = Math.max(0, contentWidth - layoutWidth)
    const next = Math.min(maxOffset, Math.max(0, offsetX + step))

    // На вебе двигаем scrollLeft напрямую. Всё остальное здесь не работает:
    // RNW перезаписывает scrollTo и на DOM-узле, и на рефе своей RN-сигнатурой
    // (y, x, animated), а любую плавную программную прокрутку (scroll-behavior
    // smooth / scrollBy behavior:'smooth') отменяет scroll-snap на контейнере.
    const node = getScrollableWebNode(scrollRef.current)
    if (node) {
      node.scrollLeft = next
    } else {
      scrollRef.current?.scrollTo({ x: next, animated: true })
    }

    // onScroll во время анимации может не успеть обновить состояние стрелок,
    // поэтому двигаем известную позицию сразу.
    metricsRef.current.offsetX = next
    recompute()
  }, [metricsRef, recompute])

  return (
    <View style={styles.wrapper} testID={testID}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        {...edgeScrollProps}
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
