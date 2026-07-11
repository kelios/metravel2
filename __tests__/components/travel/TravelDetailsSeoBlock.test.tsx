/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render } from '@testing-library/react-native'

const mockSeoProps = jest.fn()

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSeoProps(props)
    return null
  },
}))

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => children ?? null,
}))

import TravelDetailsSeoBlock from '@/components/travel/details/TravelDetailsSeoBlock'

describe('TravelDetailsSeoBlock', () => {
  beforeEach(() => {
    mockSeoProps.mockClear()
  })

  it('does not publish invented dimensions for a travel cover', () => {
    render(
      <TravelDetailsSeoBlock
        canonicalUrl="https://metravel.by/travels/lake"
        headKey="travel-lake"
        readyDesc="Описание путешествия"
        readyImage="https://metravel.by/gallery/3375/cover.jpg"
        readyTitle="Озеро Хотомле | Metravel"
      />
    )

    expect(mockSeoProps).toHaveBeenCalledWith(
      expect.objectContaining({
        image: 'https://metravel.by/gallery/3375/cover.jpg',
        imageAlt: 'Озеро Хотомле | Metravel',
      })
    )
    expect(mockSeoProps.mock.calls[0][0]).not.toHaveProperty('imageWidth')
    expect(mockSeoProps.mock.calls[0][0]).not.toHaveProperty('imageHeight')
  })
})
