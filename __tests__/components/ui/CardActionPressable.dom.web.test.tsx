import type React from 'react'
import type { Root } from 'react-dom/client'

// #2035: маркер `data-card-action="true"` стоял сырым пропом на `Pressable`/`View`,
// а react-native-web переносит в DOM только `dataSet`. Карточки, которые отличают
// клик по своей кнопке от клика по себе через `closest('[data-card-action="true"]')`
// (`UnifiedTravelCard`, `PointListRow`), маркера не находили. react-test-renderer
// видит проп и проходит, поэтому здесь — настоящий DOM react-native-web.
//
// `__tests__/setup.ts` уже закэшировал свой мок `react-native`, поэтому RNW и всё,
// что через него рисуется, грузится из свежего реестра (рецепт #2024/#2032,
// `CompactSideBarTravel.dom.web.test.tsx`).
let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let View: typeof import('react-native').View
let CardActionPressable: React.ComponentType<any>
let UnifiedTravelCard: React.ComponentType<any>
let PointListRow: React.ComponentType<any>

jest.mock('@/components/ui/ImageCardMedia', () => ({ __esModule: true, default: () => null }))
jest.mock('@/utils/externalLinks', () => ({ openExternalUrlInNewTab: jest.fn() }))

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  // Мок reanimated из `setup.ts` тянет нативный TurboModule, которого у RNW нет.
  // `UnifiedTravelCard` на web пружину не включает — хватает плоской замены.
  jest.doMock('react-native-reanimated', () => {
    const { View: WebView } = require('react-native')
    return {
      __esModule: true,
      default: { View: WebView },
      useSharedValue: (value: unknown) => ({ value }),
      useAnimatedStyle: (factory: () => unknown) => factory(),
      withSpring: (value: unknown) => value,
    }
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
  ;({ View } = require('react-native'))
  CardActionPressable = require('@/components/ui/CardActionPressable').default
  UnifiedTravelCard = require('@/components/ui/UnifiedTravelCard').default
  PointListRow = require('@/components/travel/PointListRow').default
})

const CARD_ACTION = '[data-card-action="true"]'

describe('card actions in the real React Native Web DOM (#2035)', () => {
  let container: HTMLDivElement
  let root: Root

  const render = async (element: React.ReactElement) => {
    await act(async () => {
      root.render(element)
    })
  }

  const click = async (node: Element | null) => {
    expect(node).not.toBeNull()
    await act(async () => {
      ;(node as HTMLElement).click()
    })
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  describe('CardActionPressable', () => {
    it('puts the marker into the DOM through dataSet', async () => {
      await render(
        createElement(
          CardActionPressable,
          { accessibilityLabel: 'Удалить', onPress: jest.fn() },
          createElement(View, null),
        ),
      )

      const action = container.querySelector('[aria-label="Удалить"]')
      expect(action?.getAttribute('data-card-action')).toBe('true')
      expect(container.querySelectorAll(CARD_ACTION)).toHaveLength(1)
    })
  })

  describe('inside UnifiedTravelCard', () => {
    const renderCard = (openCard: jest.Mock, slot: React.ReactNode) =>
      render(
        createElement(UnifiedTravelCard, {
          title: 'Маршрут по Минску',
          imageUrl: null,
          metaText: 'Минск',
          onPress: openCard,
          rightTopSlot: slot,
        }),
      )

    it('runs the nested action without opening the card, and a click on the card opens it', async () => {
      const openCard = jest.fn()
      const remove = jest.fn()
      await renderCard(
        openCard,
        createElement(
          CardActionPressable,
          { accessibilityLabel: 'Удалить', onPress: remove },
          createElement(View, { testID: 'remove-icon' }),
        ),
      )

      await click(container.querySelector('[data-testid="remove-icon"]'))
      expect(remove).toHaveBeenCalledTimes(1)
      expect(openCard).not.toHaveBeenCalled()

      const title = Array.from(container.querySelectorAll('div')).find(
        (node) => node.textContent === 'Маршрут по Минску' && node.children.length === 0,
      )
      await click(title ?? null)
      expect(openCard).toHaveBeenCalledTimes(1)
      expect(remove).toHaveBeenCalledTimes(1)
    })

    it('keeps the card closed by the marker alone when the action does not stop the click', async () => {
      // RNW гасит всплытие клика у выключенного Pressable только с ролью `button`;
      // у выключенного `radio` клик уходит к карточке, и остановить открытие может
      // лишь маркер. Снятый маркер — контрольная проба: тот же клик открывает карточку.
      const openCard = jest.fn()
      const select = jest.fn()
      await renderCard(
        openCard,
        createElement(
          CardActionPressable,
          { accessibilityLabel: 'Вариант', accessibilityRole: 'radio', disabled: true, onPress: select },
          createElement(View, { testID: 'radio-dot' }),
        ),
      )

      const dot = container.querySelector('[data-testid="radio-dot"]')
      await click(dot)
      expect(openCard).not.toHaveBeenCalled()
      expect(select).not.toHaveBeenCalled()

      container.querySelector('[aria-label="Вариант"]')?.removeAttribute('data-card-action')
      await click(dot)
      expect(openCard).toHaveBeenCalledTimes(1)
      expect(select).not.toHaveBeenCalled()
    })
  })

  describe('inside PointListRow', () => {
    const point = { id: '7', address: 'Замок Мир', coord: '53.4513, 26.4728' }

    const renderRow = (handlers: { onCardPress: jest.Mock; onCopy: jest.Mock }) =>
      render(
        createElement(PointListRow, {
          point,
          index: 0,
          styles: {},
          colors: { primary: '#2f6f62', primaryDark: '#1f4f45', textMuted: '#666' },
          onCardPress: handlers.onCardPress,
          onCopy: handlers.onCopy,
          onOpenMap: jest.fn(),
          onShare: jest.fn(),
        }),
      )

    it('marks every action and the navigation menu, and opens the place only from the row', async () => {
      const onCardPress = jest.fn()
      const onCopy = jest.fn()
      await renderRow({ onCardPress, onCopy })

      const markers = Array.from(container.querySelectorAll(CARD_ACTION))
      // Координаты, «Скопировать», Telegram и обёртка меню навигации.
      expect(markers.map((node) => node.getAttribute('aria-label'))).toEqual([
        `Координаты: ${point.coord}`,
        'Скопировать координаты',
        'Поделиться в Telegram',
        null,
      ])
      const navigationMenu = container.querySelector('[data-testid="travel-point-row-navigation-7"]')
      expect(navigationMenu?.closest(CARD_ACTION)).not.toBeNull()

      await click(container.querySelector('[aria-label="Скопировать координаты"]'))
      expect(onCopy).toHaveBeenCalledWith(point.coord)
      expect(onCardPress).not.toHaveBeenCalled()

      await click(container.querySelector('[aria-label="Открыть место: Замок Мир"]'))
      expect(onCardPress).toHaveBeenCalledTimes(1)
    })

    it('does not open the place from the navigation menu area — the marker is what keeps it closed', async () => {
      // У обёртки меню нет своего обработчика: клик по её полю (не по кнопке)
      // доходит до строки, и отличить его от клика по строке может только маркер.
      const onCardPress = jest.fn()
      await renderRow({ onCardPress, onCopy: jest.fn() })

      const navigationMenu = container.querySelector('[data-testid="travel-point-row-navigation-7"]')
      await click(navigationMenu)
      expect(onCardPress).not.toHaveBeenCalled()

      navigationMenu?.closest(CARD_ACTION)?.removeAttribute('data-card-action')
      await click(navigationMenu)
      expect(onCardPress).toHaveBeenCalledTimes(1)
    })
  })
})
