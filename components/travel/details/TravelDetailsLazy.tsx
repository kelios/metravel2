import React, { lazy } from 'react'
import { Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'

const isTestEnv = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined

const retry = async <T,>(fn: () => Promise<T>, tries = 2, delay = 400): Promise<T> => {
  try {
    return await fn()
  } catch {
    if (isTestEnv || tries <= 0) throw new Error('retry failed')
    await new Promise((r) => setTimeout(r, delay))
    return retry(fn, tries - 1, delay)
  }
}

export const withLazy = <T extends React.ComponentType<any>>(f: () => Promise<{ default: T }>) =>
  lazy(async () => {
    try {
      return await retry(f, 2, 400)
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
