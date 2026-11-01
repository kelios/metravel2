/**
 * @jest-environment jsdom
 */

import React, { act } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server.node'
import { Platform } from 'react-native'

import { useWebAutomation } from '@/hooks/useWebAutomation'

function AutomationProbe({ renders }: { renders: boolean[] }) {
  const isWebAutomation = useWebAutomation()
  renders.push(isWebAutomation)
  return <span>{isWebAutomation ? 'automation' : 'user'}</span>
}

// #2912: сервер не знает `navigator.webdriver`; первый клиентский кадр обязан
// совпадать с серверным HTML, иначе гидрация статьи под Playwright без маски
// падает с React #418. Признак включается сразу после commit.
describe('useWebAutomation', () => {
  const originalPlatform = Platform.OS
  const originalWebdriver = Object.getOwnPropertyDescriptor(navigator, 'webdriver')

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  })

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
  })

  afterEach(() => {
    if (originalWebdriver) Object.defineProperty(navigator, 'webdriver', originalWebdriver)
    else Reflect.deleteProperty(navigator, 'webdriver')
  })

  it('hydrates without mismatch under navigator.webdriver and flips only after commit', async () => {
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: true })
    const serverHtml = renderToString(<AutomationProbe renders={[]} />)
    expect(serverHtml).toContain('user')

    const container = document.createElement('div')
    container.innerHTML = serverHtml
    const recoverableErrors: unknown[] = []
    const renders: boolean[] = []
    let root: Root | null = null

    await act(async () => {
      root = hydrateRoot(container, <AutomationProbe renders={renders} />, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      })
      await Promise.resolve()
    })

    expect(recoverableErrors).toEqual([])
    expect(renders[0]).toBe(false)
    expect(renders.at(-1)).toBe(true)
    expect(container.textContent).toBe('automation')

    await act(async () => {
      root?.unmount()
    })
  })

  it('stays false for a real user after hydration', async () => {
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value: false })
    const container = document.createElement('div')
    const renders: boolean[] = []
    let root: Root | null = null

    await act(async () => {
      root = createRoot(container)
      root.render(<AutomationProbe renders={renders} />)
    })

    expect(renders.every((value) => value === false)).toBe(true)
    expect(container.textContent).toBe('user')

    await act(async () => {
      root?.unmount()
    })
  })
})
