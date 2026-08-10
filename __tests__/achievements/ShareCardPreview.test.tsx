import React from 'react'
import type { PropsWithChildren } from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'

import type { Badge } from '@/api/achievements'

jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    LinearGradient: ({ children }: PropsWithChildren) =>
      React.createElement(View, null, children),
  }
})

jest.mock('@/components/achievements/BadgeMedal', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: () => React.createElement(View, { testID: 'badge-medal' }),
  }
})

jest.mock('@/i18n', () => ({
  translate: (key: string) => {
    if (key.includes('metravel_by')) return 'metravel.by'
    if (key.includes('soberi_svoyu_kollektsiyu')) return 'Build your collection'
    return key
  },
}))

import ShareCardPreview from '@/components/achievements/ShareCardPreview'

const badge: Badge = {
  id: 1,
  slug: 'first-route',
  name: 'Первый маршрут',
  description: 'Опубликован первый маршрут',
  categoryId: 1,
  categorySlug: 'travel',
  categoryName: 'Путешествия',
  categoryIcon: null,
  tier: 'bronze',
  imageUrl: null,
  imageStatus: null,
  awardType: null,
  target: null,
  points: 10,
  isSecret: false,
  order: 1,
}

describe('ShareCardPreview brand row sizing', () => {
  it('wraps translated brand items as bounded whole groups', () => {
    const { getByText } = render(
      <ShareCardPreview subject={{ badge, isRare: false }} />,
    )

    const brandLabel = getByText('metravel.by')
    const ctaLabel = getByText('Build your collection')

    expect(StyleSheet.flatten(brandLabel.parent?.parent?.props.style).maxWidth).toBe('100%')
    expect(StyleSheet.flatten(ctaLabel.parent?.parent?.props.style).maxWidth).toBe('100%')
    expect(StyleSheet.flatten(brandLabel.props.style).flex).toBeUndefined()
    expect(StyleSheet.flatten(ctaLabel.props.style).flex).toBeUndefined()
    expect(StyleSheet.flatten(brandLabel.props.style).flexShrink).toBeUndefined()
    expect(StyleSheet.flatten(ctaLabel.props.style).flexShrink).toBeUndefined()
  })
})
