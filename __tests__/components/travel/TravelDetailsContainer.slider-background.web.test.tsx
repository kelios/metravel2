/**
 * @jest-environment jsdom
 */

import React, { Suspense } from 'react'
import renderer, { act } from 'react-test-renderer'

import { Platform } from 'react-native'

const mockSliderSpy: jest.Mock<any, any> = jest.fn((_props: any) => null)

jest.mock('@/components/travel/Slider', () => ({
  __esModule: true,
  default: (props: any) => mockSliderSpy(props),
}))

jest.mock('@/components/travel/AuthorCard', () => ({
  __esModule: true,
  default: () => null,
}))

describe('TravelHeroSection slider background regression (web)', () => {
  jest.setTimeout(30000)

  beforeEach(() => {
    jest.useFakeTimers()
    Platform.OS = 'web'
    Platform.select = (obj: any) => obj.web || obj.default
    mockSliderSpy.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('passes blurBackground=true to Slider when renderSlider=true', async () => {
    const { __testables } = require('@/components/travel/details/TravelDetailsContainer')

    const travel: any = {
      id: 1,
      name: 'Demo travel',
      gallery: [
        {
          url: 'https://cdn.example.com/img.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        },
      ],
      travelAddress: [],
    }

    const anchors: any = {
      gallery: { current: null },
      video: { current: null },
      description: { current: null },
      recommendation: { current: null },
      plus: { current: null },
      minus: { current: null },
      map: { current: null },
      points: { current: null },
      near: { current: null },
      popular: { current: null },
      excursions: { current: null },
    }

    await act(async () => {
      renderer.create(
        <Suspense fallback={null}>
          <__testables.TravelHeroSection
            travel={travel}
            anchors={anchors}
            isMobile={false}
            renderSlider
            onFirstImageLoad={() => {}}
            sectionLinks={[]}
            onQuickJump={() => {}}
          />
        </Suspense>,
      )

      jest.runAllTimers()
      await Promise.resolve()
    })

    expect(mockSliderSpy.mock.calls.length).toBeGreaterThan(0)
    const lastArgs = mockSliderSpy.mock.calls[mockSliderSpy.mock.calls.length - 1]
    const lastProps = (lastArgs as any)?.[0]
    expect(lastProps).toBeTruthy()
    expect(lastProps.blurBackground).toBe(true)
  })
})
