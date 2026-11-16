import type React from 'react'
import type { Root } from 'react-dom/client'

let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let Suspense: typeof import('react').Suspense
let Map: React.ComponentType<{ steps: never[]; height: number }>

jest.mock('@/components/quests/QuestFullMap', () => ({
  __esModule: true,
  default: function MockQuestFullMap() {
    return require('react').createElement('div', { 'data-testid': 'map-renderer' })
  },
}))

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({ backgroundSecondary: '#eee' }) }))
  ;({ act, createElement, Suspense } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  Map = require('@/components/quests/QuestFullMapLazy.tsx').default
})

describe('QuestFullMapLazy platform wrappers', () => {
  it('keeps the original external 300px skeleton during default cold suspension', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    try {
      act(() => root.render(createElement(Suspense, {
        fallback: createElement('div', { 'data-testid': 'original-skeleton', style: { height: 300 } }),
      }, createElement(Map, { steps: [], height: 520 }))))
      expect(container.querySelector<HTMLElement>('[data-testid="original-skeleton"]')!.style.height).toBe('300px')
      expect(container.querySelector('[data-testid="quest-map-deferred-slot"]')).toBeNull()
      expect(container.querySelector('[data-testid="quest-map-placeholder"]')).toBeNull()
      expect(container.querySelector('[data-testid="map-renderer"]')).toBeNull()
      await act(async () => {})
      expect(container.querySelector('[data-testid="original-skeleton"]')).toBeNull()
      expect(container.querySelector('[data-testid="map-renderer"]')).not.toBeNull()
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('uses a direct component on native so Android does not render the web loading placeholder forever', () => {
    const QuestFullMapLazy = require('../../../components/quests/QuestFullMapLazy.native.tsx').default

    expect(typeof QuestFullMapLazy).toBe('function')
    expect(QuestFullMapLazy.name).toBe('MockQuestFullMap')
    expect(QuestFullMapLazy.$$typeof).toBeUndefined()
  })
})
