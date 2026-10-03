import { DESIGN_TOKENS } from '@/constants/designSystem'
import { defineBreakpointLayout } from '@/utils/breakpointLayout'

/**
 * Раскладка /about по брейкпоинту 900 px (#2112) — единственный источник значений,
 * которые меняются между узким и широким видом. React берёт их по `isWide`,
 * critical CSS — для первого кадра до гидратации (`utils/criticalCSSBuilder.ts`).
 *
 * `flex: n` RN (RNW) раскрыт в лонгхенды: grow n, shrink 1, basis 0%; узкий вид
 * несёт значения RNW по умолчанию (grow 0, shrink 0, basis auto).
 */
export const ABOUT_WIDE_MIN_WIDTH = 900

const FLEX_NONE = { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' } as const
const flexGrow = (grow: number) => ({ flexGrow: grow, flexShrink: 1, flexBasis: '0%' }) as const

const COLUMNS = {
  narrow: { flexDirection: 'column', gap: DESIGN_TOKENS.spacing.md, justifyContent: 'flex-start', alignItems: 'stretch' },
  wide: { flexDirection: 'row', gap: DESIGN_TOKENS.spacing.lg, justifyContent: 'space-between', alignItems: 'flex-start' },
} as const

export const ABOUT_LAYOUT = defineBreakpointLayout({
  scope: 'about',
  minWidth: ABOUT_WIDE_MIN_WIDTH,
  blocks: {
    heroWrap: {
      narrow: { padding: DESIGN_TOKENS.spacing.lg, flexDirection: 'column', alignItems: 'stretch', gap: DESIGN_TOKENS.spacing.lg },
      wide: { padding: DESIGN_TOKENS.spacing.xl, flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xl },
    },
    heroCopy: { narrow: FLEX_NONE, wide: flexGrow(1.1) },
    heroTitle: { narrow: { fontSize: 25, lineHeight: 31 }, wide: { fontSize: 34, lineHeight: 40 } },
    heroVisual: { narrow: { ...FLEX_NONE, minHeight: 220 }, wide: { ...flexGrow(0.9), minHeight: 250 } },
    statsCell: { narrow: { width: '50%' }, wide: { width: '25%' } },
    categoriesGrid: { narrow: { justifyContent: 'space-between' }, wide: { justifyContent: 'flex-start' } },
    categoriesCard: {
      narrow: { width: '48%', minWidth: 140 },
      wide: { width: 'calc(25% - 12px)' as unknown as number, minWidth: 180 },
    },
    introColumns: COLUMNS,
    introMain: { narrow: FLEX_NONE, wide: flexGrow(1.5) },
    introSide: {
      narrow: { ...FLEX_NONE, width: '100%', alignSelf: 'stretch' },
      wide: { ...flexGrow(1), width: 'auto', alignSelf: 'auto' },
    },
    featuresColumns: COLUMNS,
    featuresColumn: { narrow: FLEX_NONE, wide: flexGrow(1) },
  },
})

export type AboutLayoutKey = keyof typeof ABOUT_LAYOUT.blocks
