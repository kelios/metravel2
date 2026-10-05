import type React from 'react'
import type { Root } from 'react-dom/client'

// #2231, web-сторона того же механизма. Modal в react-native-web — портал
// (`createPortal`), а синтетический click React всплывает по дереву React, не по
// DOM: клик по пустой поверхности листа доходит до `onClick` карточки, внутри
// которой лист смонтирован (`UnifiedTravelCard` — `PlaceListCard` в `compact`).
// Карточка пропускает клики только из-под `[data-card-action="true"]` (канон
// RULES.md), поэтому корень листа несёт эту метку. react-test-renderer портал и
// DOM не моделирует — здесь настоящий DOM react-native-web (рецепт #2035).
let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let RN: typeof import('react-native')
let ActionListSheet: React.ComponentType<any>

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@expo/vector-icons/Feather', () => {
    const ReactActual = jest.requireActual('react')
    const { Text } = require('react-native')
    const Feather = ({ name, size: _size, color, style, ...props }: any) =>
      ReactActual.createElement(Text, { ...props, style: [{ color }, style] }, String(name))
    return { __esModule: true, default: Feather }
  })
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  RN = require('react-native')
  ActionListSheet = require('@/components/ui/ActionListSheet').default
})

describe('нижний лист в настоящем DOM react-native-web (#2231, #2153)', () => {
  let container: HTMLDivElement
  let root: Root

  const inPage = (testID: string) => document.body.querySelector(`[data-testid="${testID}"]`)
  const click = async (node: Element | null) => {
    expect(node).not.toBeNull()
    await act(async () => {
      node!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
  }

  // Обработчик карточки — как у `UnifiedTravelCard` на web: клик из-под
  // `[data-card-action="true"]` не открывает карточку.
  const renderCardWithSheet = async (onCardPress: jest.Mock, onAction: jest.Mock) => {
    const onClick = (event: any) => {
      if (event?.target?.closest?.('[data-card-action="true"]')) return
      onCardPress()
    }
    await act(async () => {
      root.render(
        createElement(
          RN.View,
          { testID: 'card-under-sheet', onClick } as any,
          createElement(
            ActionListSheet,
            {
              visible: true,
              onClose: jest.fn(),
              title: 'Действия',
              actions: [
                { key: 'edit', label: 'Изменить', icon: 'edit-2', onPress: onAction, testID: 'row-edit' },
                { key: 'delete', label: 'Удалить', icon: 'trash-2', onPress: jest.fn(), destructive: true },
              ],
            },
            createElement(RN.Text, { testID: 'sheet-body-text' }, 'Абзац пояснения'),
          ),
        ),
      )
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

  it('лист — портал: его панель лежит вне DOM карточки', async () => {
    await renderCardWithSheet(jest.fn(), jest.fn())
    const panel = inPage('bottom-sheet-panel')
    expect(panel).not.toBeNull()
    expect(container.contains(panel)).toBe(false)
  })

  it.each([
    ['отступ панели', 'bottom-sheet-panel'],
    ['разделитель', 'action-sheet-separator'],
    ['текст тела', 'sheet-body-text'],
  ])('клик по пустой поверхности листа (%s) не открывает карточку под ним', async (_name, testID) => {
    const onCardPress = jest.fn()
    await renderCardWithSheet(onCardPress, jest.fn())
    await click(inPage(testID))
    expect(onCardPress).not.toHaveBeenCalled()
  })

  it('пункт листа срабатывает, карточка под ним — нет', async () => {
    const onCardPress = jest.fn()
    const onAction = jest.fn()
    await renderCardWithSheet(onCardPress, onAction)
    await click(inPage('row-edit'))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onCardPress).not.toHaveBeenCalled()
  })

  it('на web границы касаний нет — это native-механизм переговоров за касание', async () => {
    await renderCardWithSheet(jest.fn(), jest.fn())
    expect(inPage('bottom-sheet-touch-boundary')).toBeNull()
  })
})
