import React, { forwardRef, memo, useCallback, useRef } from 'react'
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { useHorizontalScrollEdges } from '@/hooks/useHorizontalScrollEdges'
import { useThemedColors } from '@/hooks/useTheme'

const IS_WEB = Platform.OS === 'web'

const DEFAULT_FADE_WIDTH = 28

/**
 * Тот же цвет с нулевой прозрачностью.
 *
 * Нативный градиент нельзя тянуть в `transparent`: это `rgba(0,0,0,0)`, и на
 * iOS ряд затухал бы через серость. На вебе градиент рисует CSS, которому
 * `transparent` в градиенте отдаётся уже премультиплицированным, и там цвет
 * фона может быть CSS-переменной — разбирать его не нужно.
 */
export const transparentVariant = (color: string): string => {
  const value = String(color ?? '').trim()

  const short = value.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/)
  if (short) {
    const [, r, g, b] = short
    return `rgba(${parseInt(r + r, 16)}, ${parseInt(g + g, 16)}, ${parseInt(b + b, 16)}, 0)`
  }

  const long = value.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})(?:[0-9a-fA-F]{2})?$/)
  if (long) {
    const [, r, g, b] = long
    return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, 0)`
  }

  const rgb = value.match(/^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/)
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, 0)`

  return 'transparent'
}

/** RNW не типизирует web-CSS свойства, но каст здесь не нужен: именованный тип
 *  присваивается в `StyleProp<ViewStyle>` без проверки лишних полей. */
type WebGradientStyle = ViewStyle & { backgroundImage: string }

type EdgeFadeProps = {
  side: 'left' | 'right'
  color: string
  width: number
}

const EdgeFade = memo(function EdgeFade({ side, color, width }: EdgeFadeProps) {
  const style: StyleProp<ViewStyle> = [
    styles.fade,
    side === 'left' ? styles.fadeLeft : styles.fadeRight,
    { width },
  ]

  if (IS_WEB) {
    // CSS-градиент понимает `var(--color-…)`, которым тема отдаёт цвета на вебе.
    const direction = side === 'left' ? 'to left' : 'to right'
    const gradient: WebGradientStyle = {
      backgroundImage: `linear-gradient(${direction}, transparent, ${color})`,
    }
    return (
      <View pointerEvents="none" testID={`edge-fade-${side}`} style={[style, gradient]} />
    )
  }

  const clear = transparentVariant(color)
  return (
    <LinearGradient
      pointerEvents="none"
      testID={`edge-fade-${side}`}
      colors={side === 'left' ? [color, clear] : [clear, color]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={style}
    />
  )
})

export type EdgeFadeScrollRowProps = Omit<ScrollViewProps, 'horizontal'> & {
  children: React.ReactNode
  /**
   * Цвет фона под рядом — в него затухает край. По умолчанию `colors.surface`;
   * поверхность с другим фоном обязана передать свой, иначе затухание будет
   * видно полосой.
   */
  fadeColor?: string
  fadeWidth?: number
  /**
   * Ключ пересчёта краёв. По умолчанию — число элементов ряда: сам массив
   * `children` пересоздаётся на каждом рендере и перезапускал бы досчёт впустую.
   */
  contentKey?: unknown
}

/**
 * Горизонтальный ряд-переключатель, который показывает, что продолжается за краем.
 *
 * Зачем: обрез посреди слова — единственный сигнал прокрутки на телефоне
 * (`showsHorizontalScrollIndicator` там ничего не рисует), и читается он как
 * поломка вёрстки. Затухание появляется только с той стороны, где реально есть
 * куда прокручивать, поэтому на десктопе, где ряд помещается целиком, его нет
 * вовсе (#1672).
 *
 * `style` остаётся на самом `ScrollView` (как у обычного `ScrollView`), обёртка
 * нужна только как система координат для затухания.
 */
const EdgeFadeScrollRow = forwardRef<ScrollView, EdgeFadeScrollRowProps>(function EdgeFadeScrollRow(
  {
    children,
    fadeColor,
    fadeWidth = DEFAULT_FADE_WIDTH,
    contentKey,
    style,
    onScroll,
    onLayout,
    onContentSizeChange,
    showsHorizontalScrollIndicator = false,
    ...rest
  },
  ref,
) {
  const colors = useThemedColors()
  const innerRef = useRef<ScrollView | null>(null)
  const { canScrollLeft, canScrollRight, edgeScrollProps } = useHorizontalScrollEdges(
    innerRef,
    contentKey ?? React.Children.count(children),
  )

  const setRefs = useCallback(
    (node: ScrollView | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<ScrollView | null>).current = node
    },
    [ref],
  )

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      edgeScrollProps.onScroll(event)
      onScroll?.(event)
    },
    [edgeScrollProps, onScroll],
  )

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      edgeScrollProps.onLayout(event)
      onLayout?.(event)
    },
    [edgeScrollProps, onLayout],
  )

  const handleContentSizeChange = useCallback(
    (width: number, height: number) => {
      edgeScrollProps.onContentSizeChange(width, height)
      onContentSizeChange?.(width, height)
    },
    [edgeScrollProps, onContentSizeChange],
  )

  const resolvedFadeColor = fadeColor ?? colors.surface ?? colors.background
  const hasFadeColor = typeof resolvedFadeColor === 'string' && resolvedFadeColor.length > 0

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={setRefs}
        horizontal
        style={style}
        showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
        scrollEventThrottle={edgeScrollProps.scrollEventThrottle}
        onScroll={handleScroll}
        onLayout={handleLayout}
        onContentSizeChange={handleContentSizeChange}
        {...rest}
      >
        {children}
      </ScrollView>

      {hasFadeColor && canScrollLeft ? (
        <EdgeFade side="left" color={resolvedFadeColor} width={fadeWidth} />
      ) : null}
      {hasFadeColor && canScrollRight ? (
        <EdgeFade side="right" color={resolvedFadeColor} width={fadeWidth} />
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    width: '100%',
  },
  fade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 2,
    // Дублируем проп стилем: затухание лежит поверх чипов и не должно съедать тапы.
    pointerEvents: 'none',
  },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
})

export default memo(EdgeFadeScrollRow)
