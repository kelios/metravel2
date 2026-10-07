import type React from 'react'
import type { View } from 'react-native'

export type ActionTooltipProps = {
  anchorRef: React.RefObject<View | null>
  label: string
  visible: boolean
  onDismiss: () => void
  /** Default action labels sit above; IconButton preserves bottom/left placement. */
  placement?: 'top' | 'bottom' | 'left'
}
