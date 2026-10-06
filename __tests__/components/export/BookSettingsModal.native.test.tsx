// #2229: окно «Настройки фотоальбома» в приложениях. Разметка окна, выбиралки и
// общий хук формы — реальные; подменён только источник премиума (граница
// entitlement) и тосты.
import React from 'react'
import { Platform } from 'react-native'
import { act, fireEvent, render, within } from '@testing-library/react-native'

import BookSettingsModal from '@/components/export/BookSettingsModal'
import type { BookSettings } from '@/components/export/BookSettingsModal'

const mockRequireUnlock = jest.fn()
const mockTrackPaywallView = jest.fn()
let mockIsPremium = true

jest.mock('@/hooks/usePdfPremium', () => ({
  usePdfPremium: () => ({
    isPremium: mockIsPremium,
    requireUnlock: mockRequireUnlock,
    trackPaywallView: mockTrackPaywallView,
  }),
}))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn(async () => undefined) }))

const DEFAULTS: Partial<BookSettings> = {
  title: 'Мои путешествия',
  template: 'minimal',
  sortOrder: 'date-desc',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  includeChecklists: false,
}

const originalPlatform = Platform.OS
const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
}

function renderModal(props: Partial<React.ComponentProps<typeof BookSettingsModal>> = {}) {
  const onSave = jest.fn(async (_settings: BookSettings) => undefined)
  const onClose = jest.fn()
  const view = render(
    <BookSettingsModal visible onClose={onClose} onSave={onSave} defaultSettings={DEFAULTS} travelCount={2} {...props} />,
  )
  return { ...view, onSave, onClose }
}

const openAdvanced = (view: ReturnType<typeof renderModal>) => fireEvent.press(view.getByTestId('book-settings-advanced'))

describe.each(['ios', 'android'] as const)('BookSettingsModal на %s (#2229)', (os) => {
  beforeEach(() => {
    setPlatform(os)
    mockIsPremium = true
    jest.clearAllMocks()
  })
  afterAll(() => setPlatform(originalPlatform))

  it('окно рисуется нативной разметкой, а не null: заголовок, число путешествий, подвал', () => {
    const view = renderModal()

    expect(view.getByTestId('book-settings-native')).toBeTruthy()
    expect(view.getByText('Настройки фотоальбома')).toBeTruthy()
    expect(view.getByText('Будет создана книга с 2 путешествиями')).toBeTruthy()
    expect(view.getByTestId('book-settings-save')).toBeTruthy()
    expect(view.getByTestId('book-settings-cancel')).toBeTruthy()
  })

  it('onSave получает выбранные поля BookSettings: порядок, тема, название, оглавление', async () => {
    const view = renderModal()

    fireEvent.press(within(view.getByTestId('book-settings-sort')).getByLabelText('По стране'))
    fireEvent.press(view.getByText('Классика'))
    openAdvanced(view)
    fireEvent.changeText(view.getByTestId('book-settings-title'), 'Лето 2026')
    fireEvent.press(view.getByLabelText('Включить оглавление'))
    await act(async () => {
      fireEvent.press(view.getByTestId('book-settings-save'))
    })

    expect(view.onSave).toHaveBeenCalledTimes(1)
    expect(view.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 'country', template: 'classic', title: 'Лето 2026', includeToc: false }),
    )
    expect(view.onClose).toHaveBeenCalledTimes(1)
  })

  it('подзаголовок из 151 символа: ошибка видна, «Сохранить PDF» не срабатывает; 150 — сохраняет', async () => {
    const view = renderModal()
    openAdvanced(view)

    fireEvent.changeText(view.getByTestId('book-settings-subtitle'), 'я'.repeat(151))
    expect(view.getByText('151/150 символов')).toBeTruthy()
    expect(within(view.getByTestId('book-settings-errors')).getByText(/150/)).toBeTruthy()
    await act(async () => {
      fireEvent.press(view.getByTestId('book-settings-save'))
    })
    expect(view.onSave).not.toHaveBeenCalled()

    fireEvent.changeText(view.getByTestId('book-settings-subtitle'), 'я'.repeat(150))
    expect(view.queryByTestId('book-settings-errors')).toBeNull()
    await act(async () => {
      fireEvent.press(view.getByTestId('book-settings-save'))
    })
    expect(view.onSave).toHaveBeenCalledWith(expect.objectContaining({ subtitle: 'я'.repeat(150) }))
  })

  it('чек-листы включены, но без разделов — ошибка и сохранения нет', async () => {
    const view = renderModal()

    fireEvent.press(view.getByLabelText('Добавить в PDF'))
    for (const section of ['clothing', 'food', 'electronics']) {
      fireEvent.press(view.getByTestId(`book-settings-checklist-${section}`))
    }
    expect(view.getByTestId('book-settings-errors')).toBeTruthy()
    await act(async () => {
      fireEvent.press(view.getByTestId('book-settings-save'))
    })
    expect(view.onSave).not.toHaveBeenCalled()

    fireEvent.press(view.getByTestId('book-settings-checklist-food'))
    await act(async () => {
      fireEvent.press(view.getByTestId('book-settings-save'))
    })
    expect(view.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ includeChecklists: true, checklistSections: ['food'] }),
    )
  })

  it('без премиума «Свое изображение» — paywall, тип обложки не меняется', async () => {
    mockIsPremium = false
    const view = renderModal()
    openAdvanced(view)

    fireEvent.press(within(view.getByTestId('book-settings-cover')).getByLabelText('Свое изображение (премиум)'))
    expect(mockTrackPaywallView).toHaveBeenCalledWith('cover-custom')
    expect(mockRequireUnlock).toHaveBeenCalledWith('cover-custom')

    await act(async () => {
      fireEvent.press(view.getByTestId('book-settings-save'))
    })
    expect(view.onSave).toHaveBeenCalledWith(expect.objectContaining({ coverType: 'auto' }))
  })

  it('«Отмена» закрывает окно без печати', () => {
    const view = renderModal()
    fireEvent.press(view.getByTestId('book-settings-cancel'))

    expect(view.onClose).toHaveBeenCalledTimes(1)
    expect(view.onSave).not.toHaveBeenCalled()
  })

  it('«Превью» есть только с onPreview и отдаёт настройки в него', async () => {
    expect(renderModal().queryByTestId('book-settings-preview')).toBeNull()

    const onPreview = jest.fn(async (_settings: BookSettings) => undefined)
    const view = renderModal({ onPreview })
    await act(async () => {
      fireEvent.press(view.getByTestId('book-settings-preview'))
    })
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ template: 'minimal' }))
  })
})
