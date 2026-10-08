// #2229: окно «Настройки фотоальбома» в приложениях. Разметка окна, выбиралки и
// общий хук формы — реальные; подменён только источник премиума (граница
// entitlement) и тосты.
import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { act, fireEvent, render, userEvent, within } from '@testing-library/react-native'

import BookSettingsModal from '@/components/export/BookSettingsModal'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import { NativeModalFooter } from '@/components/export/BookSettingsModal.native.parts'
import { i18n, translate } from '@/i18n'

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

  it('editing keeps the same input and validation while moving actions into the form scroll', async () => {
    const onPreview = jest.fn(async (_settings: BookSettings) => undefined)
    const view = renderModal({ onPreview })
    openAdvanced(view)
    const title = view.getByTestId('book-settings-title')
    fireEvent.changeText(title, 'Keyboard title')
    fireEvent(title, 'focus')
    expect(view.getByTestId('book-settings-title')).toBe(title)
    expect(title.props.value).toBe('Keyboard title')
    expect(within(view.getByTestId('book-settings-form-scroll')).getByTestId('book-settings-save')).toBeTruthy()
    fireEvent.changeText(view.getByTestId('book-settings-subtitle'), 'я'.repeat(151))
    expect(within(view.getByTestId('book-settings-form-scroll')).getByTestId('book-settings-errors')).toBeTruthy()
    const user = userEvent.setup()
    await user.press(view.getByTestId('book-settings-preview'))
    expect(onPreview).not.toHaveBeenCalled()
    fireEvent.changeText(view.getByTestId('book-settings-subtitle'), 'valid')
    await act(async () => fireEvent.press(view.getByTestId('book-settings-preview')))
    expect(onPreview).toHaveBeenCalledTimes(1)
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ title: 'Keyboard title', subtitle: 'valid' }))
  })

  it('flow chrome retains busy state and one Cancel handler during a real pending save', async () => {
    let finish!: () => void
    const onSave = jest.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    const view = renderModal({ onSave, onPreview: jest.fn() })
    openAdvanced(view)
    fireEvent(view.getByTestId('book-settings-title'), 'focus')
    await act(async () => { fireEvent.press(view.getByTestId('book-settings-save')) })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('book-settings-save').props.accessibilityState).toMatchObject({ busy: true, disabled: true })
    fireEvent(view.getByTestId('book-settings-title'), 'blur')
    expect(view.getByTestId('book-settings-preview').props.accessibilityState.disabled).toBe(true)
    fireEvent.press(view.getByTestId('book-settings-cancel'))
    expect(view.onClose).toHaveBeenCalledTimes(1)
    await act(async () => finish())
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

describe.each(['ios', 'android'] as const)('NativeModalFooter на %s (#2229)', (os) => {
  const renderFooter = (props: Partial<React.ComponentProps<typeof NativeModalFooter>> = {}) => {
    const handlers = { onClose: jest.fn(), onSave: jest.fn(), onPreview: jest.fn() }
    return {
      ...render(<NativeModalFooter isSaving={false} hasErrors={false} showPreview {...handlers} {...props} />),
      ...handlers,
    }
  }

  beforeEach(() => setPlatform(os))
  afterEach(async () => {
    await i18n.changeLanguage('ru')
    setPlatform(originalPlatform)
  })

  it.each(['ru', 'be', 'uk', 'pl', 'en'])(
    'сохраняет полные подписи %s у двух и трёх действий без ограничения строк',
    async (locale) => {
      await i18n.changeLanguage(locale)
      const labels = {
        cancel: translate('profile:components.export.BookSettingsModal_parts.otmena_7c664a0f'),
        preview: translate('profile:components.export.BookSettingsModal_parts.prevyu_8a8a2b33'),
        save: translate('profile:components.export.BookSettingsModal_parts.sohranit_pdf_513469e1'),
      }

      for (const showPreview of [false, true]) {
        const view = renderFooter({ showPreview })
        expect(view.getAllByRole('button')).toHaveLength(showPreview ? 3 : 2)
        expect(StyleSheet.flatten(view.getByTestId('book-settings-footer').props.style)).toMatchObject({
          flexDirection: 'column', flexShrink: 0,
        })
        const actions = showPreview ? ['cancel', 'preview', 'save'] as const : ['cancel', 'save'] as const
        for (const action of actions) {
          const button = view.getByTestId(`book-settings-${action}`)
          const label = within(button).getByText(labels[action])
          expect(label.props.numberOfLines).toBe(0)
          expect(StyleSheet.flatten(label.props.style)).toMatchObject({ textAlign: 'center' })
          const style = StyleSheet.flatten(
            typeof button.props.style === 'function'
              ? button.props.style({ pressed: false, hovered: false })
              : button.props.style,
          )
          expect(style).toMatchObject({ width: '100%', minHeight: os === 'android' ? 48 : 44 })
          expect(style.flex).toBeUndefined()
          expect(style.height).toBeUndefined()
        }
        view.unmount()
      }
    },
  )

  it('сохранение и превью неактивны при ошибке, отмена остаётся доступной', async () => {
    const view = renderFooter({ hasErrors: true })
    const user = userEvent.setup()
    // fireEvent searches composite ancestors and can invoke Button.onPress
    // above a disabled native host. userEvent targets actual touch responders.
    for (const action of ['save', 'preview']) {
      const button = view.getByTestId(`book-settings-${action}`)
      expect(button.props.accessibilityState.disabled).toBe(true)
      await user.press(button)
    }
    await user.press(view.getByTestId('book-settings-cancel'))
    expect(view.onSave).not.toHaveBeenCalled()
    expect(view.onPreview).not.toHaveBeenCalled()
    expect(view.onClose).toHaveBeenCalledTimes(1)
  })

  it('во время создания показывает индикатор и полную подпись; отмена работает', async () => {
    const view = renderFooter({ isSaving: true })
    const user = userEvent.setup()
    const save = view.getByTestId('book-settings-save')
    const label = within(save).getByText(translate('profile:components.export.BookSettingsModal_parts.sozdanie_14bbb42e'))
    expect(save.props.accessibilityState).toMatchObject({ busy: true, disabled: true })
    expect(label.props.numberOfLines).toBe(0)
    expect(view.getByTestId('book-settings-preview').props.accessibilityState.disabled).toBe(true)
    await user.press(save)
    await user.press(view.getByTestId('book-settings-preview'))
    await user.press(view.getByTestId('book-settings-cancel'))
    expect(view.onSave).not.toHaveBeenCalled()
    expect(view.onPreview).not.toHaveBeenCalled()
    expect(view.onClose).toHaveBeenCalledTimes(1)
  })

  it('сохраняет исходные обработчики доступных действий', () => {
    const view = renderFooter()
    for (const action of ['cancel', 'preview', 'save']) fireEvent.press(view.getByTestId(`book-settings-${action}`))
    expect(view.onClose).toHaveBeenCalledTimes(1)
    expect(view.onPreview).toHaveBeenCalledTimes(1)
    expect(view.onSave).toHaveBeenCalledTimes(1)
  })
})
