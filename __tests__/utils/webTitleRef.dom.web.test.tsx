import type React from 'react'
import type { Root } from 'react-dom/client'

// #2261: react-native-web 0.21.2 не переносит проп `title` в DOM (его нет в
// `forwardedProps`), поэтому подсказка наведения, развёрнутая спредом
// (`{...({ title } as any)}`), жила только в исходнике. react-test-renderer проп
// видит и проходит — здесь настоящий DOM react-native-web (рецепт #2035,
// `CardActionPressable.dom.web.test.tsx`): атрибут читается с узла страницы.
let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let RN: typeof import('react-native')
let webTitleRef: typeof import('@/utils/webProps').webTitleRef
let ScreenHeaderBarActions: React.ComponentType<any>
let QuestFontScaleSheet: React.ComponentType<any>
let CollapsedIconButton: React.ComponentType<any>
let CardActionPressable: React.ComponentType<any>

jest.mock('@/components/ui/ActionListSheet', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => children ?? null,
}))
jest.mock('@/components/ui/InfoSheet', () => ({ __esModule: true, default: () => null }))
jest.mock('@/stores/questFontScaleStore', () => ({
  useQuestFontScaleControls: () => ({
    fontScale: 1,
    increase: jest.fn(),
    decrease: jest.fn(),
    atMin: false,
    atMax: false,
  }),
}))

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@expo/vector-icons/Feather', () => {
    const React = jest.requireActual('react')
    const { Text } = require('react-native')
    const Feather = ({ name, size: _size, color, style, ...props }: any) =>
      React.createElement(Text, { ...props, style: [{ color }, style] }, String(name))
    return { __esModule: true, default: Feather }
  })
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  RN = require('react-native')
  ;({ webTitleRef } = require('@/utils/webProps'))
  ScreenHeaderBarActions = require('@/components/layout/ScreenHeaderBarActions').default
  QuestFontScaleSheet = require('@/components/quests/QuestFontScaleSheet').default
  ;({ CollapsedIconButton } = require('@/components/MapPage/MapScreenParts/shared'))
  CardActionPressable = require('@/components/ui/CardActionPressable').default
})

describe('web title hint in the real React Native Web DOM (#2261)', () => {
  let container: HTMLDivElement
  let root: Root

  const render = async (element: React.ReactElement) => {
    await act(async () => {
      root.render(element)
    })
  }

  const byTestId = (testID: string) => container.querySelector(`[data-testid="${testID}"]`)

  // Подсказка обязана совпадать с подписью скринридера: одна иконка — одно имя.
  const expectTitleEqualsLabel = (node: Element | null) => {
    expect(node).not.toBeNull()
    const label = node!.getAttribute('aria-label')
    expect(label).toBeTruthy()
    expect(node!.getAttribute('title')).toBe(label)
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

  describe('the mechanism', () => {
    it('is the reason it exists: a title prop never reaches the DOM', async () => {
      await render(
        createElement(RN.Pressable, { testID: 'dead', accessibilityLabel: 'Подсказка', ...({ title: 'Подсказка' } as object) }),
      )
      expect(byTestId('dead')?.getAttribute('aria-label')).toBe('Подсказка')
      expect(byTestId('dead')?.getAttribute('title')).toBeNull()
    })

    it.each(['Pressable', 'View', 'Text'] as const)('sets the attribute on %s', async (name) => {
      await render(createElement(RN[name] as React.ComponentType<any>, { testID: 'node', ref: webTitleRef('Полное имя') }))
      expect(byTestId('node')?.getAttribute('title')).toBe('Полное имя')
    })

    it('follows the text: change replaces the attribute, empty text removes it', async () => {
      const draw = (title: string | null) =>
        render(createElement(RN.Pressable, { testID: 'node', ref: webTitleRef(title) }))

      await draw('Свернуть')
      const node = byTestId('node')
      expect(node?.getAttribute('title')).toBe('Свернуть')

      await draw('Развернуть')
      expect(byTestId('node')).toBe(node)
      expect(node?.getAttribute('title')).toBe('Развернуть')

      await draw('')
      expect(node?.hasAttribute('title')).toBe(false)

      await draw('Свернуть')
      expect(node?.getAttribute('title')).toBe('Свернуть')
    })

    it('hands React the same ref for the same text, so a re-render does not touch the node', async () => {
      expect(webTitleRef('Одна подпись')).toBe(webTitleRef('Одна подпись'))
      expect(webTitleRef('')).toBe(webTitleRef(null))

      await render(createElement(RN.View, { testID: 'node', ref: webTitleRef('Одна подпись') }))
      const node = byTestId('node') as HTMLElement
      const setAttribute = jest.spyOn(node, 'setAttribute')
      await render(createElement(RN.View, { testID: 'node', ref: webTitleRef('Одна подпись') }))
      expect(setAttribute).not.toHaveBeenCalledWith('title', expect.anything())
    })

    it('serves every item of a list rendered in a loop', async () => {
      const labels = ['Сначала новые', 'Популярные', 'По алфавиту']
      await render(
        createElement(
          RN.View,
          null,
          labels.map((label) => createElement(RN.Pressable, { key: label, testID: `chip-${label}`, ref: webTitleRef(label) })),
        ),
      )
      for (const label of labels) expect(byTestId(`chip-${label}`)?.getAttribute('title')).toBe(label)
    })
  })

  describe('consumers', () => {
    it('screen header row: (i), the primary action and «⋯» carry their label as title', async () => {
      await render(
        createElement(ScreenHeaderBarActions, {
          header: {
            title: 'Мои поездки',
            info: ['Пояснение'],
            primaryAction: { icon: 'plus', label: 'Новая поездка', onPress: jest.fn() },
            overflow: [{ key: 'share', label: 'Поделиться', icon: 'share-2', onPress: jest.fn() }],
          },
        }),
      )

      const buttons = ['screen-header-info', 'screen-header-primary', 'screen-header-more'].map(byTestId)
      buttons.forEach(expectTitleEqualsLabel)
      expect(buttons[1]?.getAttribute('title')).toBe('Новая поездка')
    })

    it('quest font sheet: both step buttons carry their label as title', async () => {
      await render(createElement(QuestFontScaleSheet, { visible: true, onClose: jest.fn() }))

      expectTitleEqualsLabel(byTestId('quest-font-scale-decrease'))
      expectTitleEqualsLabel(byTestId('quest-font-scale-increase'))
    })

    it('collapsed map panel icon: title is its own text next to the label', async () => {
      await render(
        createElement(CollapsedIconButton, {
          icon: 'list',
          label: 'Список точек (12)',
          title: 'Список точек',
          onPress: jest.fn(),
          styles: { collapsedIconBtn: {} },
          iconColor: '#000',
        }),
      )

      const button = container.querySelector('[aria-label="Список точек (12)"]')
      expect(button?.getAttribute('title')).toBe('Список точек')
    })

    it('CardActionPressable: the tooltip goes through the same setter', async () => {
      const draw = (title?: string) =>
        render(createElement(CardActionPressable, { accessibilityLabel: 'Удалить', title, onPress: jest.fn() }))

      await draw('Удалить точку')
      const action = container.querySelector('[aria-label="Удалить"]')
      expect(action?.getAttribute('title')).toBe('Удалить точку')

      await draw(undefined)
      expect(action?.getAttribute('title')).toBe('Удалить')
    })
  })
})
