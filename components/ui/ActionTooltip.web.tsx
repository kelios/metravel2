import React, { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import type { ActionTooltipProps } from './ActionTooltip.types'

const INSET = DESIGN_TOKENS.spacing.sm
const GAP = DESIGN_TOKENS.spacing.xs

export function positionActionTooltip(
  anchor: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  tooltip: Pick<DOMRect, 'width' | 'height'>,
  viewport: { width: number; height: number },
) {
  const above = anchor.top - tooltip.height - GAP
  const top = above >= INSET ? above : anchor.bottom + GAP
  return {
    left: Math.max(INSET, Math.min(
      (anchor.left + anchor.right - tooltip.width) / 2,
      viewport.width - tooltip.width - INSET,
    )),
    top: Math.max(INSET, Math.min(top, viewport.height - tooltip.height - INSET)),
  }
}

export default function ActionTooltip({ anchorRef, label, visible, onDismiss }: ActionTooltipProps) {
  const colors = useThemedColors()
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!visible) {
      setPosition(null)
      return
    }
    const anchor = anchorRef.current as unknown as HTMLElement | null
    const tooltip = tooltipRef.current
    if (!anchor || !tooltip) return

    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect()
      if (!anchor.isConnected || rect.bottom <= 0 || rect.top >= window.innerHeight ||
          rect.right <= 0 || rect.left >= window.innerWidth) {
        onDismiss()
        return
      }
      setPosition(positionActionTooltip(rect, tooltip.getBoundingClientRect(), {
        width: window.innerWidth,
        height: window.innerHeight,
      }))
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('keydown', handleKeyDown)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updatePosition) : null
    observer?.observe(anchor)
    observer?.observe(tooltip)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('keydown', handleKeyDown)
      observer?.disconnect()
    }
  }, [anchorRef, label, visible, onDismiss])

  if (!visible || typeof document === 'undefined') return null

  // The body portal escapes RNW View stacking contexts and ScrollView clipping.
  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: 'fixed',
        ...position,
        visibility: position ? 'visible' : 'hidden',
        zIndex: DESIGN_TOKENS.zIndex.popover,
        pointerEvents: 'none',
        width: 'max-content',
        maxWidth: `min(240px, calc(100vw - ${INSET * 2}px))`,
        boxSizing: 'border-box',
        overflowWrap: 'anywhere',
        padding: `${DESIGN_TOKENS.spacing.xs}px ${INSET}px`,
        borderRadius: DESIGN_TOKENS.radii.sm,
        backgroundColor: colors.text,
        color: colors.surface,
        fontFamily: 'system-ui, sans-serif',
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        lineHeight: '16px',
        fontWeight: 600,
        boxShadow: DESIGN_TOKENS.shadows.heavy,
      }}
    >
      {label}
    </div>,
    document.body,
  )
}
