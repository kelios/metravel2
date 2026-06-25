import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { Platform } from 'react-native'

import BookSettingsModal from '@/components/export/BookSettingsModal'
import type { BookSettings } from '@/components/export/BookSettingsModal'

const mockRequireUnlock = jest.fn()
const mockTrackPaywallView = jest.fn()
let mockIsPremium = true
const originalConsoleError = console.error
let consoleErrorSpy: jest.SpyInstance

jest.mock('react-native', () => {
  const React = require('react')

  return {
    __esModule: true,
    Modal: ({ visible, children }: any) =>
      visible ? React.createElement(React.Fragment, null, children) : null,
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.web ?? options.default,
    },
  }
})

jest.mock('@expo/vector-icons/Feather', () => {
  const React = require('react')

  return {
    __esModule: true,
    default: ({ name }: { name: string }) => React.createElement('span', null, name),
  }
})

jest.mock('@/hooks/useFocusTrap', () => ({
  useFocusTrap: jest.fn(),
}))

jest.mock('@/hooks/usePdfPremium', () => ({
  usePdfPremium: () => ({
    isPremium: mockIsPremium,
    requireUnlock: mockRequireUnlock,
    trackPaywallView: mockTrackPaywallView,
  }),
}))

jest.mock('@/components/export/PresetSelector', () => {
  const React = require('react')

  return {
    __esModule: true,
    default: ({ onPresetSelect, selectedPresetId }: any) =>
      React.createElement(
        'div',
        { 'data-testid': 'preset-selector', 'data-selected-preset': selectedPresetId ?? '' },
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () =>
              onPresetSelect({
                id: 'photo-album',
                name: 'Фотоальбом',
                description: 'Акцент на фотографии',
                category: 'photo-focused',
                icon: 'camera',
                settings: {
                  title: 'Preset title',
                  subtitle: 'Preset subtitle',
                  coverType: 'first-photo',
                  template: 'light',
                  sortOrder: 'date-desc',
                  includeToc: false,
                  includeGallery: true,
                  includeMap: false,
                  includeChecklists: false,
                  checklistSections: [],
                  galleryLayout: 'grid',
                  galleryColumns: 3,
                  galleryPhotosPerPage: 2,
                  galleryTwoPerPageLayout: 'vertical',
                  showCaptions: true,
                  captionPosition: 'bottom',
                  gallerySpacing: 'normal',
                },
              }),
          },
          'Apply photo album preset',
        ),
      ),
  }
})

jest.mock('@/components/export/ThemePreview', () => {
  const React = require('react')

  return {
    __esModule: true,
    default: ({ selectedTheme, onThemeSelect }: any) =>
      React.createElement(
        'div',
        { 'data-testid': 'theme-preview', 'data-selected-theme': selectedTheme },
        React.createElement(
          'button',
          { type: 'button', onClick: () => onThemeSelect('dark') },
          'Select dark theme',
        ),
      ),
  }
})

jest.mock('@/components/export/GalleryLayoutSelector', () => {
  const React = require('react')

  return {
    __esModule: true,
    default: ({ selectedLayout, onLayoutSelect, onCaptionPositionChange }: any) =>
      React.createElement(
        'div',
        { 'data-testid': 'gallery-layout-selector', 'data-selected-layout': selectedLayout },
        React.createElement(
          'button',
          { type: 'button', onClick: () => onLayoutSelect('masonry') },
          'Use masonry layout',
        ),
        React.createElement(
          'button',
          { type: 'button', onClick: () => onLayoutSelect('collage') },
          'Use collage layout',
        ),
        React.createElement(
          'button',
          { type: 'button', onClick: () => onCaptionPositionChange('overlay') },
          'Use overlay captions',
        ),
      ),
  }
})

const baseSettings: BookSettings = {
  title: 'Existing title',
  subtitle: 'Existing subtitle',
  coverType: 'auto',
  template: 'minimal',
  sortOrder: 'manual',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  showCoordinatesOnMapPage: true,
  includeChecklists: false,
  checklistSections: ['clothing', 'food', 'electronics'],
  galleryLayout: 'grid',
  galleryColumns: 3,
  galleryPhotosPerPage: 2,
  galleryTwoPerPageLayout: 'vertical',
  showCaptions: true,
  captionPosition: 'bottom',
  gallerySpacing: 'normal',
}

function renderModal(overrides: Partial<ComponentProps<typeof BookSettingsModal>> = {}) {
  const props = {
    visible: true,
    onClose: jest.fn(),
    onSave: jest.fn().mockResolvedValue(undefined),
    travelCount: 3,
    defaultSettings: baseSettings,
    ...overrides,
  }

  render(<BookSettingsModal {...props} />)

  return props
}

describe('BookSettingsModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
      const text = [message, ...args].map((item) => String(item)).join(' ')
      if (
        text.includes('non-boolean attribute `transparent`') ||
        (text.includes('non-boolean attribute') && text.includes('transparent')) ||
        text.includes('`animationType` prop') ||
        text.includes('animationType') ||
        text.includes('Unknown event handler property `onRequestClose`') ||
        text.includes('onRequestClose')
      ) {
        return
      }
      originalConsoleError(message, ...args)
    })
    mockIsPremium = true
    ;(Platform as any).OS = 'web'
    ;(Platform as any).select = (options: Record<string, unknown>) => options.web ?? options.default
    window.localStorage.clear()
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    })
  })

  afterEach(() => {
    consoleErrorSpy?.mockRestore()
  })

  it('renders the web modal with travel count and closes from the footer', () => {
    const props = renderModal()

    expect(screen.getByRole('dialog', { name: 'Настройки фотоальбома' })).toBeTruthy()
    expect(screen.getByText('Выбрано путешествий:')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))

    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('does not render content when hidden', () => {
    renderModal({ visible: false })

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('applies preset and theme changes while preserving existing title and subtitle', async () => {
    const props = renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Apply photo album preset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select dark theme' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить и создать PDF' }))

    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1))

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Existing title',
        subtitle: 'Existing subtitle',
        sortOrder: 'date-desc',
        template: 'dark',
        includeGallery: true,
      }),
    )
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('saves settings loaded from localStorage when default settings are absent', async () => {
    window.localStorage.setItem(
      'metravel_pdf_settings',
      JSON.stringify({
        ...baseSettings,
        title: 'Stored title',
        sortOrder: 'country',
        template: 'classic',
      }),
    )
    const props = renderModal({ defaultSettings: undefined })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить и создать PDF' }))

    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1))
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Stored title',
        sortOrder: 'country',
        template: 'classic',
      }),
    )
  })

  it('blocks invalid subtitle before save', async () => {
    const props = renderModal()
    fireEvent.click(screen.getByRole('button', { name: /Показать детальные настройки/ }))

    fireEvent.change(screen.getByDisplayValue('Existing subtitle'), {
      target: { value: 'x'.repeat(151) },
    })

    await screen.findByText('Подзаголовок не должен превышать 150 символов')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить и создать PDF' }))

    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('routes preview through onPreview without saving', async () => {
    const props = renderModal({ onPreview: jest.fn().mockResolvedValue(undefined) })

    fireEvent.click(screen.getByRole('button', { name: 'Предварительный просмотр PDF' }))

    await waitFor(() => expect(props.onPreview).toHaveBeenCalledTimes(1))
    expect(props.onPreview).toHaveBeenCalledWith(expect.objectContaining({ title: 'Existing title' }))
    expect(props.onSave).not.toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps premium gallery choices out of free-user settings and opens the paywall', async () => {
    mockIsPremium = false
    const props = renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Use collage layout' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use overlay captions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить и создать PDF' }))

    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1))

    expect(mockTrackPaywallView).toHaveBeenCalledWith('gallery-premium')
    expect(mockRequireUnlock).toHaveBeenCalledWith('gallery-premium')
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        galleryLayout: 'grid',
        captionPosition: 'bottom',
      }),
    )
  })

  it('allows non-premium gallery changes for free users', async () => {
    mockIsPremium = false
    const props = renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Use masonry layout' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить и создать PDF' }))

    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1))

    expect(mockRequireUnlock).not.toHaveBeenCalled()
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ galleryLayout: 'masonry' }))
  })
})
