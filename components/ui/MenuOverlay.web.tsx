import { Modal } from 'react-native'
import type { MenuOverlayProps } from '@/components/ui/MenuOverlay.types'

export default function MenuOverlay({ visible, onRequestClose, children }: MenuOverlayProps) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>{children}</Modal>
}
