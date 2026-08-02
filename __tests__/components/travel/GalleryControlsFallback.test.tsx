import React from 'react'
import { render } from '@testing-library/react-native'

import { GalleryControlsFallback } from '@/components/travel/gallery/GalleryControlsFallback'
import { createGalleryStyles } from '@/components/travel/gallery/styles'

// #1148: состояние контролов, пока грузится ленивый dropzone-чанк.
// Регрессия, которую ловит этот файл: фолбэк передавал общий `isUploading`,
// и вместе с выбором файлов гасла кнопка съёмки — хотя её input принадлежит
// ImageGallery, а не ленивому чанку, и снимать можно сразу.

const colors: any = {
  text: '#000',
  textOnPrimary: '#fff',
  borderLight: '#eee',
  border: '#ddd',
  primary: '#0a0',
  background: '#fff',
  backgroundSecondary: '#f5f5f5',
  danger: '#c00',
  success: '#0c0',
  surface: '#fff',
  textMuted: '#666',
  shadows: { light: {} },
  boxShadows: { light: 'none' },
}

const renderFallback = (overrides: Partial<React.ComponentProps<typeof GalleryControlsFallback>> = {}) =>
  render(
    <GalleryControlsFallback
      styles={createGalleryStyles(colors) as any}
      colors={colors}
      imagesCount={0}
      maxImages={10}
      isMobileWeb
      batchUploadProgress={null}
      hasErrors={false}
      selectableCount={0}
      selectedCount={0}
      allSelected={false}
      onTakePhoto={jest.fn()}
      onToggleSelectAll={jest.fn()}
      onDeleteSelected={jest.fn()}
      {...overrides}
    />,
  )

describe('GalleryControlsFallback (#1148)', () => {
  it('оставляет съёмку доступной, пока занят только выбор файлов', () => {
    const screen = renderFallback()

    expect(screen.getByTestId('gallery-mobile-camera').props.disabled).toBe(false)
    expect(screen.getByTestId('gallery-mobile-pick').props.disabled).toBe(true)
  })

  it('гасит съёмку только на время реальной загрузки пачки', () => {
    const screen = renderFallback({ batchUploadProgress: { current: 1, total: 3 } })

    expect(screen.getByTestId('gallery-mobile-camera').props.disabled).toBe(true)
  })
})
