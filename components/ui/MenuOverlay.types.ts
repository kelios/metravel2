import type { ReactNode, RefObject } from 'react'
import type { ViewInstance } from 'react-native'

export type MenuOverlayProps = {
  visible: boolean
  onRequestClose: () => void
  /** Native: called after the transported menu content is removed from the Paper host. */
  onClosed?: () => void
  accessibilityLabel: string
  initialFocusRef: RefObject<ViewInstance | null>
  returnFocusRef: RefObject<ViewInstance | null>
  restoreFocusRef: RefObject<boolean>
  children: ReactNode
}
