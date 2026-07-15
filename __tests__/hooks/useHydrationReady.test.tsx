/**
 * @jest-environment jsdom
 */

import React, { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server.node'
import { Platform } from 'react-native'

import { useHydrationReady } from '@/hooks/useHydrationReady'

function HydrationProbe() {
  const hydrationReady = useHydrationReady()
  return <span>{hydrationReady ? 'client' : 'server'}</span>
}

describe('useHydrationReady', () => {
  const originalPlatform = Platform.OS

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  })

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
  })

  it('keeps the first hydration render equal to SSR and switches after commit', async () => {
    const serverHtml = renderToString(<HydrationProbe />)
    expect(serverHtml).toContain('server')

    const container = document.createElement('div')
    container.innerHTML = serverHtml
    const recoverableErrors: unknown[] = []
    let root: Root | null = null

    await act(async () => {
      root = hydrateRoot(container, <HydrationProbe />, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      })
      await Promise.resolve()
    })

    expect(recoverableErrors).toEqual([])
    expect(container.textContent).toBe('client')

    await act(async () => {
      root?.unmount()
    })
  })
})
