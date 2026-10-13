import { Platform } from 'react-native'

import ToastHost from '@/components/ui/ToastHost'

/**
 * Native Modal is above the app-root host. Mount its feedback host only while
 * visible: react-native-toast-message selects the last mounted host and falls
 * back to the previous one on unmount. Keep this in the parent modal when a
 * temporary child sheet closes after submitting, so its confirmation survives.
 * Web has one global host and must not register a second one here.
 */
export default function ModalToastHost({ visible }: { visible: boolean }) {
  if (!visible || Platform.OS === 'web') return null
  return <ToastHost overDock={false} />
}
