import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

export const PANEL_RADIUS = DESIGN_TOKENS.radii.xl
export const CONTROL_RADIUS = DESIGN_TOKENS.radii.md
export const MENU_RADIUS = DESIGN_TOKENS.radii.md
export const PILL_RADIUS = DESIGN_TOKENS.radii.pill

export type StylesCtx = {
  colors: ReturnType<typeof useThemedColors>
  spacing: typeof DESIGN_TOKENS.spacing
  typography: typeof DESIGN_TOKENS.typography
  radii: typeof DESIGN_TOKENS.radii
  mobileWebTopReserve: number
  PANEL_RADIUS: number
  CONTROL_RADIUS: number
  MENU_RADIUS: number
  PILL_RADIUS: number
}
