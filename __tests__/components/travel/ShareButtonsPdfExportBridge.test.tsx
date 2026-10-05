// #2119: мост экспорта одного путешествия. На сайте он открывает окно настроек
// книги; в приложении окна настроек нет, и запрос экспорта сразу печатает книгу с
// настройками по умолчанию.
import React from 'react'
import { Platform } from 'react-native'
import { act, render } from '@testing-library/react-native'

import ShareButtonsPdfExportBridge from '@/components/travel/ShareButtonsPdfExportBridge'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import type { Travel } from '@/types/types'

const mockOpenPrintBook = jest.fn(async (_settings: BookSettings) => undefined)

const LAST_SETTINGS = {
  title: 'Путешествие: Тест',
  subtitle: 'Беларусь',
  coverType: 'auto',
  template: 'minimal',
  sortOrder: 'date-desc',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  includeChecklists: false,
  checklistSections: ['clothing', 'food', 'electronics'],
} as BookSettings

jest.mock('@/components/travel/hooks/useSingleTravelExport', () => ({
  useSingleTravelExport: () => ({
    pdfExport: { isGenerating: false, progress: 0, currentStage: 'validating' },
    lastSettings: LAST_SETTINGS,
    settingsSummary: 'minimal',
    handleOpenPrintBookWithSettings: (settings: BookSettings) => mockOpenPrintBook(settings),
  }),
}))

jest.mock('@/components/export/BookSettingsModal', () => {
  const { Text: MockText } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: ({ visible }: { visible: boolean }) => (visible ? <MockText>окно настроек книги</MockText> : null),
  }
})

const travel = { id: 1, slug: 'test', name: 'Тест', countryName: 'Беларусь' } as unknown as Travel

const originalPlatform = Platform.OS
const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
}

const renderBridge = (visible: boolean, onClose = jest.fn(), onStateChange = jest.fn()) => {
  const view = render(
    <ShareButtonsPdfExportBridge travel={travel} visible={visible} onClose={onClose} onStateChange={onStateChange} />
  )
  const rerender = (nextVisible: boolean) =>
    view.rerender(
      <ShareButtonsPdfExportBridge travel={travel} visible={nextVisible} onClose={onClose} onStateChange={onStateChange} />
    )
  return { ...view, rerenderBridge: rerender, onClose, onStateChange }
}

describe('ShareButtonsPdfExportBridge (#2119)', () => {
  beforeEach(() => {
    mockOpenPrintBook.mockClear()
  })

  afterEach(() => {
    setPlatform(originalPlatform)
  })

  describe.each(['ios', 'android'] as const)('приложение %s — окна настроек нет', (os) => {
    beforeEach(() => {
      setPlatform(os)
    })

    it('запрос экспорта сразу печатает книгу с настройками по умолчанию и сбрасывает запрос', async () => {
      const view = renderBridge(true)
      await act(async () => {})

      expect(mockOpenPrintBook).toHaveBeenCalledTimes(1)
      expect(mockOpenPrintBook).toHaveBeenCalledWith(LAST_SETTINGS)
      expect(view.onClose).toHaveBeenCalledTimes(1)
      expect(view.queryByText('окно настроек книги')).toBeNull()
    })

    it('пока запрос не сброшен, повторные рендеры печать не перезапускают', async () => {
      const view = renderBridge(true)
      await act(async () => {})
      view.rerenderBridge(true)
      view.rerenderBridge(true)
      await act(async () => {})

      expect(mockOpenPrintBook).toHaveBeenCalledTimes(1)
    })

    it('новый запрос после сброса печатает ещё раз', async () => {
      const view = renderBridge(true)
      await act(async () => {})
      view.rerenderBridge(false)
      view.rerenderBridge(true)
      await act(async () => {})

      expect(mockOpenPrintBook).toHaveBeenCalledTimes(2)
    })

    it('без запроса ничего не печатает', async () => {
      renderBridge(false)
      await act(async () => {})

      expect(mockOpenPrintBook).not.toHaveBeenCalled()
    })

    it('состояние экспорта по-прежнему уходит наверх — кнопка показывает прогресс', async () => {
      const view = renderBridge(false)
      await act(async () => {})

      expect(view.onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ isGenerating: false, progress: 0, lastSettings: LAST_SETTINGS })
      )
    })
  })

  describe('сайт — окно настроек есть', () => {
    beforeEach(() => {
      setPlatform('web')
    })

    it('запрос экспорта открывает окно настроек и сам ничего не печатает', async () => {
      const view = renderBridge(true)
      expect(await view.findByText('окно настроек книги')).toBeTruthy()

      expect(mockOpenPrintBook).not.toHaveBeenCalled()
      expect(view.onClose).not.toHaveBeenCalled()
    })
  })
})
