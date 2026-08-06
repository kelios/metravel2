/**
 * @jest-environment jsdom
 */

import React, { act } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server.node'
import { Platform } from 'react-native'

import { useHydrationReady } from '@/hooks/useHydrationReady'

function HydrationProbe() {
  const hydrationReady = useHydrationReady()
  return <span>{hydrationReady ? 'client' : 'server'}</span>
}

function ClientOnlyProbe({ renders }: { renders: boolean[] }) {
  const hydrationReady = useHydrationReady({ clientOnly: true })
  renders.push(hydrationReady)
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

  // #1282: поддерево, смонтированное уже после гидратации (Home), не должно
  // тратить кадр на «серверное» состояние — этот лишний кадр рисует узкую
  // раскладку, а следующий перекладывает её и даёт весь CLS главной.
  it('with clientOnly is ready on the very first client render', async () => {
    const container = document.createElement('div')
    const renders: boolean[] = []
    let root: Root | null = null

    await act(async () => {
      root = createRoot(container)
      root.render(<ClientOnlyProbe renders={renders} />)
    })

    expect(renders[0]).toBe(true)
    expect(renders).toEqual([true])
    expect(container.textContent).toBe('client')

    await act(async () => {
      root?.unmount()
    })
  })
})
