import type React from 'react'
import type { View } from 'react-native'

export type ActionTooltipProps = {
  anchorRef: React.RefObject<View | null>
  label: string
  visible: boolean
  onDismiss: () => void
}
