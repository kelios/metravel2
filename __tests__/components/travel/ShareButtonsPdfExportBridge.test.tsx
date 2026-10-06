// #2119/#2229: мост экспорта одного путешествия. На сайте и в приложениях запрос
// экспорта открывает окно настроек книги (в приложениях — нативное,
// `BookSettingsModal.native.tsx`); печать идёт только из окна.
import React from 'react'
import { Platform } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'

import ShareButtonsPdfExportBridge from '@/components/travel/ShareButtonsPdfExportBridge'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import type { Travel } from '@/types/types'

const mockCancel = jest.fn()
let mockPdfExportState = { isGenerating: false, progress: 0, currentStage: 'validating' }
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
    pdfExport: { ...mockPdfExportState, cancel: mockCancel },
    lastSettings: LAST_SETTINGS,
    settingsSummary: 'minimal',
    handleOpenPrintBookWithSettings: (settings: BookSettings) => mockOpenPrintBook(settings),
  }),
}))

const mockModalProps: { current: { onSave: (settings: BookSettings) => Promise<void>; onClose: () => void } | null } = { current: null }
jest.mock('@/components/export/BookSettingsModal', () => {
  const { Text: MockText, Pressable: MockPressable } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: (props: { visible: boolean; onSave: (settings: BookSettings) => Promise<void>; onClose: () => void }) => {
      mockModalProps.current = props
      return props.visible ? <><MockText>окно настроек книги</MockText><MockPressable testID="settings-cancel" onPress={props.onClose}><MockText>Отмена</MockText></MockPressable></> : null
    },
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
    mockOpenPrintBook.mockReset()
    mockOpenPrintBook.mockResolvedValue(undefined)
    mockCancel.mockReset()
    mockPdfExportState = { isGenerating: false, progress: 0, currentStage: 'validating' }
  })

  afterEach(() => {
    setPlatform(originalPlatform)
  })

  describe.each(['web', 'ios', 'android'] as const)('%s — окно настроек есть', (os) => {
    beforeEach(() => {
      setPlatform(os)
    })

    it('запрос экспорта открывает окно настроек и сам ничего не печатает', async () => {
      const view = renderBridge(true)
      expect(await view.findByText('окно настроек книги')).toBeTruthy()

      expect(mockOpenPrintBook).not.toHaveBeenCalled()
      expect(view.onClose).not.toHaveBeenCalled()
    })

    it('сохранение в окне печатает книгу с выбранными настройками', async () => {
      const view = renderBridge(true)
      await view.findByText('окно настроек книги')
      await act(async () => {
        await mockModalProps.current?.onSave({ ...LAST_SETTINGS, template: 'classic' })
      })

      expect(mockOpenPrintBook).toHaveBeenCalledWith(expect.objectContaining({ template: 'classic' }))
      expect(view.onClose).toHaveBeenCalledTimes(1)
    })

    it('closing settings while export is pending cancels it before a late print can start', async () => {
      let finishPreparation: () => void = () => {}
      const print = jest.fn()
      let cancelled = false
      mockCancel.mockImplementation(() => {
        cancelled = true
        mockPdfExportState = { isGenerating: false, progress: 0, currentStage: 'validating' }
      })
      mockOpenPrintBook.mockImplementationOnce(async () => {
        mockPdfExportState = { isGenerating: true, progress: 85, currentStage: 'rendering' }
        await new Promise<void>((resolve) => { finishPreparation = resolve })
        if (!cancelled) print()
      })
      const view = renderBridge(true)
      await view.findByText('окно настроек книги')
      let pending: Promise<void> = Promise.resolve()
      act(() => { pending = mockModalProps.current!.onSave(LAST_SETTINGS) })
      fireEvent.press(view.getByTestId('settings-cancel'))
      expect(mockCancel).toHaveBeenCalledTimes(1)
      expect(view.onClose).toHaveBeenCalledTimes(1)
      view.rerenderBridge(false)
      expect(view.onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ isGenerating: false, progress: 0 }))
      await act(async () => { finishPreparation(); await pending })
      expect(print).not.toHaveBeenCalled()
    })

    it('состояние экспорта уходит наверх — кнопка показывает прогресс', async () => {
      const view = renderBridge(false)
      await act(async () => {})

      expect(view.onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ isGenerating: false, progress: 0, lastSettings: LAST_SETTINGS })
      )
    })
  })
})
