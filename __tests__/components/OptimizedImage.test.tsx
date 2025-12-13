import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'
import OptimizedImage, { generateSizes, generateSrcSet } from '@/components/ui/OptimizedImage'

jest.mock('expo-image', () => {
  const React = require('react')
  const { View } = require('react-native')

  const MockImage = ({ onLoad, onError, ...props }: any) =>
    React.createElement(View, { testID: 'expo-image', onLoad, onError, ...props })

  return {
    __esModule: true,
    Image: MockImage,
    ImageContentFit: {},
  }
})

describe('OptimizedImage', () => {
  const originalPlatform = Platform.OS

  beforeAll(() => {
    ;(Platform as any).OS = 'web'
  })

  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('shows loading indicator and error fallback correctly', () => {
    const { getByTestId, queryByTestId } = render(
      <OptimizedImage source={{ uri: 'https://example.com/photo.jpg' }} />
    )

    expect(getByTestId('optimized-image-loading')).toBeTruthy()

    const image = getByTestId('expo-image')
    fireEvent(image, 'onLoad')
    expect(queryByTestId('optimized-image-loading')).toBeNull()

    fireEvent(image, 'onError')
    expect(getByTestId('optimized-image-error')).toBeTruthy()
  })

  it('exposes web-specific loading attributes and helpers', () => {
    const { getByTestId } = render(
      <OptimizedImage source={{ uri: 'https://example.com/photo.jpg' }} priority="high" alt="demo" />
    )

    const image = getByTestId('expo-image')
    expect((image as any).props.loading).toBe('lazy')
    expect((image as any).props.fetchpriority).toBe('high')
    expect((image as any).props.alt).toBe('demo')

    expect(generateSrcSet('https://cdn.example.com/image')).toContain('w=320')
    expect(generateSizes({ desktop: '25vw' })).toContain('25vw')
  })
})
