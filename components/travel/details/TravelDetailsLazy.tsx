import React, { lazy } from 'react'
import { Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'

const isTestEnv = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Lazy import timeout')), timeoutMs)
      promise.then(resolve, reject)
    })
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const retry = async <T,>(fn: () => Promise<T>, tries = 2, delay = 400): Promise<T> => {
  try {
    return await fn()
  } catch (err) {
    console.error('[withLazy] import attempt failed:', err)
    if (isTestEnv || tries <= 0) throw err
    await new Promise((r) => setTimeout(r, delay))
    return retry(fn, tries - 1, delay)
  }
}

export const withLazy = <T extends React.ComponentType<any>>(f: () => Promise<{ default: T }>) =>
  lazy(async () => {
    try {
      const lazyImport = retry(f, 2, 400)

      // During local Metro bundling, initial async route chunks can take >12s.
      // Hard timeout here causes permanent "Component failed to load" fallback for map widgets.
      // Keep timeout protection in production only.
      if (__DEV__) {
        return await lazyImport
      }

      return await withTimeout(lazyImport, 12_000)
    } catch {
      return {
        default: (() => (
          <View style={{ padding: DESIGN_TOKENS.spacing.md }}>
            <Text>Component failed to load</Text>
          </View>
        )) as unknown as T,
      }
    }
  })
