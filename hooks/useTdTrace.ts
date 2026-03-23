import { useCallback } from 'react'
import { Platform } from 'react-native'

type TdTraceWindow = Window & {
  __METRAVEL_TD_TRACE?: boolean
  __METRAVEL_TD_TRACE_START?: number
}

const traceWindow = typeof window !== 'undefined' ? (window as TdTraceWindow) : null

const tdTraceEnabled =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  (
    process.env.EXPO_PUBLIC_TD_TRACE === '1' ||
    traceWindow?.__METRAVEL_TD_TRACE === true ||
    (typeof window.location?.search === 'string' && /(?:\?|&)tdtrace=1(?:&|$)/.test(window.location.search))
  )

export function useTdTrace() {
  return useCallback(
    (event: string, data?: unknown) => {
      if (!tdTraceEnabled) return
      try {
        const perf = traceWindow?.performance
        const now = typeof perf?.now === 'function' ? perf.now() : Date.now()

        const base =
          traceWindow?.__METRAVEL_TD_TRACE_START ??
          (typeof perf?.now === 'function' ? perf.now() : now)
        if (traceWindow) {
          traceWindow.__METRAVEL_TD_TRACE_START = base
        }

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
