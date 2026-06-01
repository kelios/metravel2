import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

export const TS = DESIGN_TOKENS.typography.scale
export const TOUCH = DESIGN_TOKENS.touchTarget.minHeight
export const PANEL_RADIUS = DESIGN_TOKENS.radii.lg
export const CARD_RADIUS = DESIGN_TOKENS.radii.md
export const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm
export const PILL_RADIUS = DESIGN_TOKENS.radii.pill

export type FiltersPanelStyleContext = {
  colors: ThemedColors
  isMobile: boolean
  panelWidth: number | '100%'
  bottomDockReserve: number
}
