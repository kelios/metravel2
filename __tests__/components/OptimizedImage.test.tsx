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

    const srcset = generateSrcSet('https://cdn.example.com/image', [320, 640])
    expect(srcset.split(',').length).toBe(2)
    expect(srcset).toContain('w=320')
    expect(srcset).toContain('w=640')

    const sizes = generateSizes({ desktop: '25vw' })
    expect(sizes).toContain('25vw')
  })

  it('maps fetchpriority based on priority prop', () => {
    const { getByTestId, rerender } = render(
      <OptimizedImage source={{ uri: 'https://example.com/photo.jpg' }} priority="low" />
    )

    expect((getByTestId('expo-image') as any).props.fetchpriority).toBe('low')

    rerender(
      <OptimizedImage source={{ uri: 'https://example.com/photo.jpg' }} priority="normal" />
    )
    expect((getByTestId('expo-image') as any).props.fetchpriority).toBe('auto')

    rerender(
      <OptimizedImage source={{ uri: 'https://example.com/photo.jpg' }} priority="high" />
    )
    expect((getByTestId('expo-image') as any).props.fetchpriority).toBe('high')
  })

  it('generateSizes uses defaults and allows overriding breakpoints', () => {
    const value = generateSizes()
    expect(value).toContain('100vw')
    expect(value).toContain('50vw')
    expect(value).toContain('33vw')

    const overridden = generateSizes({ mobile: '90vw', tablet: '60vw', desktop: '20vw' })
    expect(overridden).toContain('90vw')
    expect(overridden).toContain('60vw')
    expect(overridden).toContain('20vw')
  })
})
