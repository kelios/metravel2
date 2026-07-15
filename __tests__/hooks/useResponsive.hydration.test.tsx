/**
 * @jest-environment jsdom
 */

import React, { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server.node'
import { Platform } from 'react-native'

import { useResponsive } from '@/hooks/useResponsive'

function ResponsiveProbe() {
  const { width, height, isHydrated } = useResponsive()
  return <span>{`${width}x${height}:${isHydrated ? 'live' : 'server'}`}</span>
}

describe('useResponsive hydration contract', () => {
  const originalPlatform = Platform.OS

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  })

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
  })

  it('hydrates the server snapshot before switching that consumer to live dimensions', async () => {
    const serverHtml = renderToString(<ResponsiveProbe />)
    expect(serverHtml).toContain('0x0:server')

    const container = document.createElement('div')
    container.innerHTML = serverHtml
    const recoverableErrors: unknown[] = []
    let root: Root | null = null

    await act(async () => {
      root = hydrateRoot(container, <ResponsiveProbe />, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      })
      await Promise.resolve()
    })

    expect(recoverableErrors).toEqual([])
    expect(container.textContent).toBe('1440x900:live')

    await act(async () => {
      root?.unmount()
    })
  })

  it('keeps a later hydration root on the server snapshot after another root is live', async () => {
    const serverHtml = renderToString(<ResponsiveProbe />)
    const firstContainer = document.createElement('div')
    const secondContainer = document.createElement('div')
    firstContainer.innerHTML = serverHtml
    secondContainer.innerHTML = serverHtml
    const firstErrors: unknown[] = []
    const secondErrors: unknown[] = []
    let firstRoot: Root | null = null
    let secondRoot: Root | null = null

    await act(async () => {
      firstRoot = hydrateRoot(firstContainer, <ResponsiveProbe />, {
        onRecoverableError: (error) => firstErrors.push(error),
      })
      await Promise.resolve()
    })
    expect(firstContainer.textContent).toBe('1440x900:live')

    await act(async () => {
      secondRoot = hydrateRoot(secondContainer, <ResponsiveProbe />, {
        onRecoverableError: (error) => secondErrors.push(error),
      })
      await Promise.resolve()
    })

    expect(firstErrors).toEqual([])
    expect(secondErrors).toEqual([])
    expect(secondContainer.textContent).toBe('1440x900:live')

    await act(async () => {
      firstRoot?.unmount()
      secondRoot?.unmount()
    })
  })
})
