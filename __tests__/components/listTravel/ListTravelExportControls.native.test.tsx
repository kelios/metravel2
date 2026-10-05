// #2119: каталог PDF-книги в приложении. Печать идёт кнопкой «Сохранить PDF» с
// настройками по умолчанию; ссылки «Настройки» нет, пока окно настроек книги
// существует только на сайте.
import React from 'react'
import { Platform } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import ListTravelExportControls from '@/components/listTravel/ListTravelExportControls'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import type { Travel } from '@/types/types'

const mockOpenPrintBook = jest.fn(async (_settings: BookSettings) => undefined)
let mockPdfExportState = { isGenerating: false, progress: 0 }

jest.mock('@/hooks/usePdfExport', () => ({
  usePdfExport: () => ({ openPrintBook: mockOpenPrintBook, ...mockPdfExportState }),
}))

jest.mock('@/components/export/BookSettingsModal', () => ({
  __esModule: true,
  default: () => null,
}))

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
    mockOpenPrintBook.mockClear()
    mockPdfExportState = { isGenerating: false, progress: 0 }
  })

  afterEach(() => {
    setPlatform(originalPlatform)
  })

  it.each(['ios', 'android'] as const)('%s: «Сохранить PDF» печатает книгу с текущими настройками, ссылки «Настройки» нет', (os) => {
    setPlatform(os)
    const view = renderControls()

    expect(view.queryByText('Настройки')).toBeNull()
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

  it('сайт: ссылка «Настройки» на месте', () => {
    setPlatform('web')
    const view = renderControls()

    expect(view.queryByText('Настройки')).not.toBeNull()
  })
})
