// #2119/#2229: каталог PDF-книги в приложении. «Сохранить PDF» печатает с текущими
// настройками, ссылка «Настройки» открывает окно настроек — как на сайте.
import React from 'react'
import { Platform } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'

import ListTravelExportControls from '@/components/listTravel/ListTravelExportControls'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import type { Travel } from '@/types/types'

const mockOpenPrintBook = jest.fn(async (_settings: BookSettings) => undefined)
const mockCancel = jest.fn()
let mockPdfExportState = { isGenerating: false, progress: 0 }

jest.mock('@/hooks/usePdfExport', () => ({
  usePdfExport: () => ({ openPrintBook: mockOpenPrintBook, cancel: mockCancel, ...mockPdfExportState }),
}))

const mockModalProps: { current: { visible: boolean; onSave: (value: BookSettings) => Promise<void>; onClose: () => void } | null } = { current: null }
jest.mock('@/components/export/BookSettingsModal', () => {
  const { Text: MockText, Pressable: MockPressable } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: (props: { visible: boolean; onSave: (value: BookSettings) => Promise<void>; onClose: () => void }) => {
      mockModalProps.current = props
      return props.visible ? <MockPressable testID="settings-cancel" onPress={props.onClose}><MockText>Отмена в настройках</MockText></MockPressable> : null
    },
  }
})

jest.mock('@/components/listTravel/SelectedTravelOrderCard', () => () => null)

const settings = {
  title: 'Мои путешествия',
  subtitle: '',
  coverType: 'auto',
  template: 'minimal',
  sortOrder: 'manual',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  includeChecklists: false,
  checklistSections: ['clothing', 'food', 'electronics'],
} as BookSettings

const travels = [
  { id: 1, name: 'Первое', slug: 'one' },
  { id: 2, name: 'Второе', slug: 'two' },
] as unknown as Travel[]

const originalPlatform = Platform.OS
const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
}

const renderControls = () =>
  render(
    <ListTravelExportControls
      isMobile
      travels={travels}
      selected={travels}
      toggleSelectAll={jest.fn()}
      clearSelection={jest.fn()}
      moveSelected={jest.fn()}
      moveSelectedTo={jest.fn()}
      hasSelection
      selectionCount={travels.length}
      baseSettings={settings}
      lastSettings={settings}
      settingsSummary="minimal"
      setLastSettings={jest.fn()}
    />
  )

describe('ListTravelExportControls в приложении (#2119)', () => {
  beforeEach(() => {
    mockOpenPrintBook.mockReset()
    mockOpenPrintBook.mockResolvedValue(undefined)
    mockCancel.mockReset()
    mockPdfExportState = { isGenerating: false, progress: 0 }
  })

  afterEach(() => {
    setPlatform(originalPlatform)
  })

  it.each(['ios', 'android'] as const)('%s: «Сохранить PDF» печатает книгу с текущими настройками, ссылка «Настройки» есть', (os) => {
    setPlatform(os)
    const view = renderControls()

    expect(view.queryByText('Настройки')).not.toBeNull()
    fireEvent.press(view.getByText('Сохранить PDF'))

    expect(mockOpenPrintBook).toHaveBeenCalledTimes(1)
    expect(mockOpenPrintBook).toHaveBeenCalledWith(settings)
  })

  it.each(['ios', 'android'] as const)('%s: во время сборки виден прогресс', (os) => {
    setPlatform(os)
    mockPdfExportState = { isGenerating: true, progress: 45 }
    const view = renderControls()

    expect(view.getByText('Генерация содержимого...')).toBeTruthy()
  })

  it.each(['ios', 'android'] as const)('%s: #2274 «Отменить» во время сборки прерывает её', (os) => {
    setPlatform(os)
    mockPdfExportState = { isGenerating: true, progress: 85 }
    const view = renderControls()

    fireEvent.press(view.getByText('Отменить'))
    expect(mockCancel).toHaveBeenCalledTimes(1)
  })

  it.each(['ios', 'android'] as const)('%s: closing the visible settings form cancels pending export and prevents late print', async (os) => {
    setPlatform(os)
    let finishPreparation: () => void = () => {}
    let cancelled = false
    const print = jest.fn()
    mockCancel.mockImplementation(() => {
      cancelled = true
      mockPdfExportState = { isGenerating: false, progress: 0 }
    })
    mockOpenPrintBook.mockImplementationOnce(async () => {
      mockPdfExportState = { isGenerating: true, progress: 85 }
      await new Promise<void>((resolve) => { finishPreparation = resolve })
      if (!cancelled) print()
    })
    const view = renderControls()
    fireEvent.press(view.getByText('Настройки'))
    expect(mockModalProps.current?.visible).toBe(true)
    let pending: Promise<void> = Promise.resolve()
    act(() => { pending = mockModalProps.current!.onSave(settings) })
    fireEvent.press(view.getByTestId('settings-cancel'))
    expect(mockCancel).toHaveBeenCalledTimes(1)
    expect(mockModalProps.current?.visible).toBe(false)
    expect(mockPdfExportState).toEqual({ isGenerating: false, progress: 0 })
    expect(view.queryByText('Отмена в настройках')).toBeNull()
    await act(async () => { finishPreparation(); await pending })
    expect(print).not.toHaveBeenCalled()
  })

  it('сайт: ссылка «Настройки» на месте', () => {
    setPlatform('web')
    const view = renderControls()

    expect(view.queryByText('Настройки')).not.toBeNull()
  })
})
