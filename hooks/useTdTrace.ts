import { useCallback } from 'react'
import { Platform } from 'react-native'

const tdTraceEnabled =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  (process.env.EXPO_PUBLIC_TD_TRACE === '1' || (window as any).__METRAVEL_TD_TRACE === true)

export function useTdTrace() {
  return useCallback(
    (event: string, data?: any) => {
      if (!tdTraceEnabled) return
      try {
        const perf = (window as any).performance
        const now = typeof perf?.now === 'function' ? perf.now() : Date.now()

        const base =
          (window as any).__METRAVEL_TD_TRACE_START ??
          (typeof perf?.now === 'function' ? perf.now() : now)
        ;(window as any).__METRAVEL_TD_TRACE_START = base

        const delta = Math.round(now - base)
        // eslint-disable-next-line no-console
        console.log(`[TD] +${delta}ms ${event}`, data ?? '')

        if (typeof perf?.mark === 'function') {
          perf.mark(`TD:${event}`)
        }
      } catch {
        // noop
      }
    },
    []
  )
}
