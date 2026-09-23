import type React from 'react'
import type { Root } from 'react-dom/client'

// #2035: попап места на карте в настоящем DOM react-native-web. Действия карточки
// помечены `data-card-action="true"` (через `dataSet` — сырой проп RNW отбрасывает),
// клик по действию над фото выполняет действие и не открывает фото на весь экран,
// клик по фото открывает его, а до карты (Leaflet слушает предков попапа) ни одно
// нажатие внутри карточки не доходит. Текст карточки маркера не несёт: курсор-рука
// из `app/global.css` над ним был бы ложной подсказкой.
//
// `__tests__/setup.ts` уже закэшировал свой мок `react-native`, поэтому RNW и всё,
// что через него рисуется, грузится из свежего реестра (рецепт #2024/#2032).
let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let PlacePopupCard: React.ComponentType<any>

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  isIOSSafariUserAgent: () => false,
  default: () => null,
}))
jest.mock('@/components/places/PlaceRatingSection', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/travel/RelatedTravelActionStack', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/MapPage/Map/PlacePopupCard/FullscreenImageViewer', () => ({
  __esModule: true,
  default: ({ visible }: { visible: boolean }) =>
    visible ? require('react').createElement('div', { 'data-testid': 'fullscreen-viewer' }) : null,
}))

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('expo-linear-gradient', () => {
    const { View } = require('react-native')
    return { LinearGradient: View }
  })
  // Настоящий `createIconSet` отдаёт все пропы в `<Text {...props}>` — так же
  // делает и эта замена; глобальный мок из `setup.ts` держит Text нативного реестра.
  jest.doMock('@expo/vector-icons/Feather', () => {
    const React = jest.requireActual('react')
    const { Text } = require('react-native')
    const Feather = ({ name, size: _size, color, style, ...props }: any) =>
      React.createElement(Text, { ...props, style: [{ color }, style] }, String(name))
    return { __esModule: true, default: Feather }
  })
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  PlacePopupCard = require('@/components/MapPage/Map/PlacePopupCard').default
})

const CARD_ACTION = '[data-card-action="true"]'
const MAP_EVENTS = ['mousedown', 'mouseup', 'click'] as const

const colors = {
  text: '#111',
  textMuted: '#666',
  textOnDark: '#fff',
  primary: '#2f6f62',
  backgroundSecondary: '#f3f4f6',
  surface: '#fff',
  borderLight: '#ddd',
}

describe('PlacePopupCard in the real React Native Web DOM (#2035)', () => {
  let mapHost: HTMLDivElement
  let container: HTMLDivElement
  let root: Root
  let mapEvents: string[]
  let onClose: jest.Mock
  let onNextSource: jest.Mock

  // Как у Leaflet: карта слушает нажатия на предке попапа.
  const recordMapEvent = (event: Event) => mapEvents.push(event.type)

  const press = async (node: Element | null) => {
    expect(node).not.toBeNull()
    await act(async () => {
      node!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      node!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      ;(node as HTMLElement).click()
    })
  }

  beforeEach(async () => {
    mapEvents = []
    onClose = jest.fn()
    onNextSource = jest.fn()
    mapHost = document.createElement('div')
    container = document.createElement('div')
    mapHost.appendChild(container)
    document.body.appendChild(mapHost)
    MAP_EVENTS.forEach((type) => mapHost.addEventListener(type, recordMapEvent))
    root = createRoot(container)
    await act(async () => {
      root.render(
        createElement(PlacePopupCard, {
          colors,
          title: 'Мирский замок',
          subtitle: 'Мир, Беларусь',
          imageUrl: 'https://metravel.by/media/mir.jpg',
          popupSplit: true,
          width: 560,
          sourceCount: 2,
          activeSourceIndex: 0,
          onPrevSource: jest.fn(),
          onNextSource,
          onClose,
          onShareTelegram: jest.fn(),
          coord: '53.4513, 26.4728',
        }),
      )
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    MAP_EVENTS.forEach((type) => mapHost.removeEventListener(type, recordMapEvent))
    mapHost.remove()
  })

  const hero = () => container.querySelector('[aria-label="Открыть фото на весь экран"]')
  const fullscreenOpen = () => document.querySelector('[data-testid="fullscreen-viewer"]') !== null

  it('marks the photo and every action in the DOM, and leaves the text unmarked', () => {
    expect(hero()?.getAttribute('data-card-action')).toBe('true')
    for (const label of ['Закрыть попап', 'Следующий материал', 'Предыдущий материал']) {
      expect(container.querySelector(`[aria-label="${label}"]`)?.getAttribute('data-card-action')).toBe('true')
    }
    const title = Array.from(container.querySelectorAll('div')).find(
      (node) => node.textContent === 'Мирский замок' && node.children.length === 0,
    )
    expect(title).toBeDefined()
    expect(title!.closest(CARD_ACTION)).toBeNull()
  })

  it('opens the photo on a click on the photo, without reaching the map', async () => {
    expect(fullscreenOpen()).toBe(false)

    await press(hero())

    expect(fullscreenOpen()).toBe(true)
    expect(mapEvents).toEqual([])
  })

  it('runs an action over the photo without opening the photo or reaching the map', async () => {
    await press(container.querySelector('[aria-label="Следующий материал"]'))
    expect(onNextSource).toHaveBeenCalledTimes(1)

    await press(container.querySelector('[aria-label="Закрыть попап"]'))
    expect(onClose).toHaveBeenCalled()

    expect(fullscreenOpen()).toBe(false)
    expect(mapEvents).toEqual([])
  })
})
