import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
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

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('shows loading indicator and retries before error fallback', () => {
    const { getByTestId, queryByTestId } = render(
      <OptimizedImage source={{ uri: 'https://example.com/photo.jpg' }} />
    )

    expect(getByTestId('optimized-image-loading')).toBeTruthy()

    const image = getByTestId('expo-image')
    fireEvent(image, 'onLoad')
    expect(queryByTestId('optimized-image-loading')).toBeNull()

    const delays = [300, 600, 1200, 2000, 2500, 3000]

    // First error schedules retry (no fallback yet)
    act(() => {
      fireEvent(image, 'onError')
    })
    expect(queryByTestId('optimized-image-error')).toBeNull()

    // Drive retryAttempt from 0 -> 6 via backoff timers.
    // Note: When retryAttempt reaches 6, the *next* onError should show fallback.
    for (let attempt = 1; attempt <= delays.length; attempt++) {
      act(() => {
        jest.advanceTimersByTime(delays[attempt - 1] + 1)
      })

      const img = getByTestId('expo-image') as any
      expect(String(img.props.source?.uri)).toContain(`__retry=${attempt}`)

      if (attempt < delays.length) {
        // Simulate that the new URL still fails, schedule next retry.
        act(() => {
          fireEvent(getByTestId('expo-image'), 'onError')
        })
        expect(queryByTestId('optimized-image-error')).toBeNull()
      }
    }

    // After retries exhausted (retryAttempt==6), next error should show fallback.
    act(() => {
      fireEvent(getByTestId('expo-image'), 'onError')
    })
    expect(getByTestId('optimized-image-error')).toBeTruthy()
  })

  it('adds cache-busting retry param to source.uri after onError (regression: should retry instead of getting stuck until reload)', async () => {
    const { getByTestId } = render(
      <OptimizedImage source={{ uri: 'https://example.com/photo.jpg' }} />
    )

    act(() => {
      fireEvent(getByTestId('expo-image'), 'onError')
    })
    act(() => {
      jest.advanceTimersByTime(301)
    })

    const img1 = getByTestId('expo-image') as any
    expect(String(img1.props.source?.uri)).toContain('__retry=1')

    act(() => {
      fireEvent(getByTestId('expo-image'), 'onError')
    })
    act(() => {
      jest.advanceTimersByTime(601)
    })

    const img2 = getByTestId('expo-image') as any
    expect(String(img2.props.source?.uri)).toContain('__retry=2')
  })

  it('resets error state when uri changes (regression: should recover without page reload)', async () => {
    const { getByTestId, queryByTestId, rerender } = render(
      <OptimizedImage source={{ uri: 'https://example.com/photo.jpg' }} />
    )

    // Exhaust retries -> error fallback
    const delays = [300, 600, 1200, 2000, 2500, 3000]
    act(() => {
      fireEvent(getByTestId('expo-image'), 'onError')
    })
    for (let attempt = 1; attempt <= delays.length; attempt++) {
      act(() => {
        jest.advanceTimersByTime(delays[attempt - 1] + 1)
      })
      if (attempt < delays.length) {
        act(() => {
          fireEvent(getByTestId('expo-image'), 'onError')
        })
      }
    }
    act(() => {
      fireEvent(getByTestId('expo-image'), 'onError')
    })
    expect(getByTestId('optimized-image-error')).toBeTruthy()

    // Change uri -> should reset error and show loading again
    act(() => {
      rerender(<OptimizedImage source={{ uri: 'https://example.com/photo-2.jpg' }} />)
    })

    // Effects run synchronously under act in tests.
    expect(queryByTestId('optimized-image-error')).toBeNull()
    expect(getByTestId('optimized-image-loading')).toBeTruthy()
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
