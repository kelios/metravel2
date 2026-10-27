import type React from 'react'
import type { ViewInstance } from 'react-native'

export type ActionTooltipProps = {
  anchorRef: React.RefObject<ViewInstance | null>
  label: string
  visible: boolean
  onDismiss: () => void
  /** Default action labels sit above; IconButton preserves bottom/left placement. */
  placement?: 'top' | 'bottom' | 'left'
}
