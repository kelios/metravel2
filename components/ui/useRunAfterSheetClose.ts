import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'

// Анимация fade закрытия ~300 мс; если `onDismiss` не пришёл — действие всё равно выполнится.
const IOS_DISMISS_FALLBACK_MS = 450

/**
 * Действие из `BottomSheet`, которое открывает следующий Modal (#2115). На iOS UIKit
 * не покажет второй Modal, пока первый открыт или ещё закрывается (Fabric
 * `RCTModalHostViewComponentView` не ждёт dismiss), поэтому действие ждёт `onDismiss`
 * листа; страховка — таймер. Ровно один вызов. Web/Android — сразу.
 *
 * `onDismiss` отдаётся в `BottomSheet` того же листа.
 */
export function useRunAfterSheetClose(onClose: () => void) {
  const pendingActionRef = useRef<(() => void) | null>(null)
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onDismiss = useCallback(() => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
    pendingTimerRef.current = null
    const run = pendingActionRef.current
    pendingActionRef.current = null
    run?.()
  }, [])
  useEffect(() => () => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
  }, [])
  const runAfterClose = useCallback(
    (run: () => void) => {
      onClose()
      if (Platform.OS !== 'ios') {
        run()
        return
      }
      pendingActionRef.current = run
      pendingTimerRef.current = setTimeout(onDismiss, IOS_DISMISS_FALLBACK_MS)
    },
    [onDismiss, onClose],
  )
  return { runAfterClose, onDismiss }
}
