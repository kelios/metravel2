import type React from 'react'
import type { Root } from 'react-dom/client'

let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let FavoriteButton: React.ComponentType<any>
let favorite = false
const toggle = jest.fn()

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/hooks/useFavoriteToggle', () => ({
    useFavoriteToggle: () => ({ isFavorite: () => favorite, toggle, pending: false }),
  }))
  jest.doMock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: () => null }))
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  FavoriteButton = require('@/components/travel/FavoriteButton').default
})

it.each(['overlay', 'plain'])('%s favorite action carries its current label as a DOM title (#2284)', async (variant) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  favorite = false
  const renderButton = () => root.render(createElement(FavoriteButton, {
    id: 5, type: 'travel', title: 'Мост', url: '/travels/most', variant, size: favorite ? 25 : 24,
  }))
  try {
    await act(async () => renderButton())
    const button = container.querySelector('[role="button"]') as HTMLElement
    expect(button.getAttribute('title')).toBe(button.getAttribute('aria-label'))
    expect(button.getAttribute('title')).toMatch(/Добавить/)
    favorite = true
    await act(async () => renderButton())
    expect(button.getAttribute('title')).toBe(button.getAttribute('aria-label'))
    expect(button.getAttribute('title')).toMatch(/Удалить/)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
