import { METRICS } from '@/constants/layout'
import { defineBreakpointLayout, type BreakpointBlockStyle } from '@/utils/breakpointLayout'

type Density = 'compact' | 'regular'

const FLEX_NONE = { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' } as const

const bannerLayout = (density: Density) => {
  const compact = density === 'compact'
  return defineBreakpointLayout({
    scope: `contribution-${density}`,
    minWidth: METRICS.breakpoints.tablet,
    blocks: {
      wrapper: {
        narrow: { paddingTop: compact ? 8 : 12, paddingBottom: compact ? 8 : 12 },
        wide: { paddingTop: compact ? 10 : 20, paddingBottom: compact ? 10 : 20 },
      },
      card: {
        narrow: {
          paddingLeft: compact ? 14 : 16, paddingRight: compact ? 14 : 16,
          paddingTop: compact ? 14 : 18, paddingBottom: compact ? 14 : 18,
          flexDirection: 'column', alignItems: 'flex-start', gap: compact ? 12 : 14,
        },
        wide: {
          paddingLeft: compact ? 18 : 28, paddingRight: compact ? 18 : 28,
          paddingTop: compact ? 16 : 24, paddingBottom: compact ? 16 : 24,
          flexDirection: 'row', alignItems: 'center', gap: compact ? 14 : 20,
        },
      },
      text: {
        narrow: { ...FLEX_NONE, width: '100%' },
        wide: { flexGrow: 1, flexShrink: 1, flexBasis: '0%', width: 'auto' },
      },
      buttons: {
        narrow: { width: '100%', flexDirection: 'column', alignItems: 'stretch' },
        wide: { width: 'auto', flexDirection: 'row', alignItems: 'center' },
      },
      action: { narrow: { width: '100%' }, wide: { width: 'auto' } },
      title: {
        narrow: { fontSize: compact ? 14 : 15, ...(compact ? { lineHeight: 18 } : null) },
        wide: { fontSize: compact ? 16 : 17, ...(compact ? { lineHeight: 20 } : null) },
      },
      subtitle: {
        narrow: { fontSize: 13, lineHeight: compact ? 18 : 19 },
        wide: { fontSize: compact ? 13 : 14, lineHeight: compact ? 18 : 21 },
      },
      icon: {
        narrow: { fontSize: compact ? 18 : 20, lineHeight: compact ? 18 : 20, minWidth: compact ? 18 : 20, minHeight: compact ? 18 : 20 },
        wide: { fontSize: compact ? 18 : 22, lineHeight: compact ? 18 : 22, minWidth: compact ? 18 : 22, minHeight: compact ? 18 : 22 },
      },
    },
  })
}

export const CONTRIBUTION_BANNER_LAYOUTS = {
  compact: bannerLayout('compact'),
  regular: bannerLayout('regular'),
}

const containerGeometry = (horizontal: number, vertical: number, maxWidth: number): BreakpointBlockStyle => ({
  paddingLeft: horizontal, paddingRight: horizontal,
  paddingTop: vertical, paddingBottom: vertical, maxWidth,
})

const CONTAINER_NARROW = containerGeometry(METRICS.spacing.s, METRICS.spacing.xs, METRICS.containers.xl)

// Same tiers as the existing ResponsiveContainer. This owner supplies its
// existing style/dataSet inputs; other container consumers are unchanged.
export const CONTRIBUTION_CONTAINER_LAYOUTS = [
  { minWidth: METRICS.breakpoints.phone, horizontal: METRICS.spacing.m, vertical: METRICS.spacing.s, maxWidth: METRICS.containers.xl },
  { minWidth: METRICS.breakpoints.tablet, horizontal: METRICS.spacing.xl, vertical: METRICS.spacing.l, maxWidth: METRICS.containers.xl },
  { minWidth: METRICS.breakpoints.largeTablet, horizontal: METRICS.spacing.xxl, vertical: METRICS.spacing.xl, maxWidth: METRICS.containers.xl },
  { minWidth: METRICS.breakpoints.largeDesktop, horizontal: METRICS.spacing.xxl, vertical: METRICS.spacing.xl, maxWidth: METRICS.containers.xxl },
].map(({ minWidth, horizontal, vertical, maxWidth }) => defineBreakpointLayout({
  scope: 'contribution-container',
  minWidth,
  blocks: { frame: { narrow: CONTAINER_NARROW, wide: containerGeometry(horizontal, vertical, maxWidth) } },
}))

export function contributionContainerStyle(width: number): BreakpointBlockStyle {
  return CONTRIBUTION_CONTAINER_LAYOUTS.reduce(
    (style, layout) => width >= layout.minWidth ? layout.blocks.frame.wide : style,
    CONTAINER_NARROW,
  )
}
