/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render } from '@testing-library/react-native'

const mockSeoProps = jest.fn()
const mockHeadProps = jest.fn()

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSeoProps(props)
    return null
  },
}))

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: (props: { children?: React.ReactNode }) => {
    mockHeadProps(props)
    return null
  },
}))

import TravelDetailsSeoBlock from '@/components/travel/details/TravelDetailsSeoBlock'

describe('TravelDetailsSeoBlock', () => {
  beforeEach(() => {
    mockSeoProps.mockClear()
    mockHeadProps.mockClear()
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

  it('passes safely serialized JSON-LD as script text for Expo Head', () => {
    const jsonLd = {
      '@context': 'https://schema.org',
      url: 'https://metravel.by/travels/lake',
      headline: '</script><script>alert(1)</script>',
    }

    render(
      <TravelDetailsSeoBlock
        canonicalUrl="https://metravel.by/travels/lake"
        headKey="travel-lake"
        jsonLd={jsonLd}
        readyDesc="Описание путешествия"
        readyImage="https://metravel.by/gallery/3375/cover.jpg"
        readyTitle="Озеро Хотомле | Metravel"
      />
    )

    const script = mockHeadProps.mock.calls[0][0].children as React.ReactElement
    expect(script.type).toBe('script')
    expect(script.props.type).toBe('application/ld+json')
    expect(script.props.children).toContain('https://metravel.by/travels/lake')
    expect(script.props.children).toContain('\\u003c/script\\u003e')
    expect(script.props).not.toHaveProperty('dangerouslySetInnerHTML')
  })
})
