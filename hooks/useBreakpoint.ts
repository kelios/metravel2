import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, type View } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'

export type BreakpointKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

const BREAKPOINT_ORDER: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl']

const resolveBreakpoint = (width: number): BreakpointKey => {
  const bp = DESIGN_TOKENS.breakpoints
  if (width >= bp.xxl) return 'xxl'
  if (width >= bp.xl) return 'xl'
  if (width >= bp.lg) return 'lg'
  if (width >= bp.md) return 'md'
  if (width >= bp.sm) return 'sm'
  return 'xs'
}

/**
 * Returns the current window-based breakpoint plus comparison helpers.
 * Prefer this over raw `width` checks in new code.
 *
 * @example
 *   const { bp, isAtLeast } = useBreakpoint()
 *   if (isAtLeast('md')) {...}
 */
export function useBreakpoint() {
  const { width } = useResponsive()
  const bp = resolveBreakpoint(width)

  const isAtLeast = useCallback(
    (target: BreakpointKey) => BREAKPOINT_ORDER.indexOf(bp) >= BREAKPOINT_ORDER.indexOf(target),
    [bp]
  )
  const isAtMost = useCallback(
    (target: BreakpointKey) => BREAKPOINT_ORDER.indexOf(bp) <= BREAKPOINT_ORDER.indexOf(target),
    [bp]
  )

  return useMemo(
    () => ({
      bp,
      width,
      isAtLeast,
      isAtMost,
      isPhone: bp === 'xs' || bp === 'sm',
      isTablet: bp === 'md',
      isDesktop: bp === 'lg' || bp === 'xl' || bp === 'xxl',
    }),
    [bp, isAtLeast, isAtMost, width]
  )
}

/**
 * Container-query-style hook: measures the element itself, not the window.
 * On web uses ResizeObserver; on native falls back to onLayout handler.
 *
 * @example
 *   const { ref, width, containerBp } = useContainerWidth<View>()
 *   <View ref={ref}>{containerBp === 'xs' ? <Stack/> : <Row/>}</View>
 */
export function useContainerWidth<T extends View | HTMLElement = View>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const node = ref.current as unknown as Element | null
    if (!node || typeof ResizeObserver === 'undefined') return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect?.width ?? 0
        if (w > 0) setWidth(w)
      }
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const onLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      if (Platform.OS === 'web') return
      const w = event.nativeEvent?.layout?.width ?? 0
      if (w > 0 && Math.abs(w - width) > 0.5) setWidth(w)
    },
    [width]
  )

  const containerBp: BreakpointKey = width > 0 ? resolveBreakpoint(width) : 'xs'

  return { ref, width, containerBp, onLayout }
}
