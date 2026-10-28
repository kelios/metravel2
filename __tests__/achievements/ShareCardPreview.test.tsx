import React from 'react'
import type { PropsWithChildren } from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'
import type { TestInstance } from 'test-renderer'

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
  it('wraps translated brand items as bounded whole groups', async () => {
    const { getByText } = await render(
      <ShareCardPreview subject={{ badge, isRare: false }} />,
    )

    const brandLabel = getByText('metravel.by')
    const ctaLabel = getByText('Build your collection')
    // test-renderer 1.3 dropped the extra host between Text and brandGroup.
    // The group itself still owns maxWidth 100%; the label stays inflexible.
    const brandGroupStyle = (label: TestInstance) => {
      const group = [label.parent, label.parent?.parent].find((node) =>
        StyleSheet.flatten(node?.props.style)?.maxWidth === '100%',
      )
      return StyleSheet.flatten(group?.props.style)
    }

    expect(brandGroupStyle(brandLabel)).toMatchObject({ maxWidth: '100%', flexDirection: 'row' })
    expect(brandGroupStyle(ctaLabel)).toMatchObject({ maxWidth: '100%', flexDirection: 'row' })
    expect(StyleSheet.flatten(brandLabel.props.style).flex).toBeUndefined()
    expect(StyleSheet.flatten(ctaLabel.props.style).flex).toBeUndefined()
    expect(StyleSheet.flatten(brandLabel.props.style).flexShrink).toBeUndefined()
    expect(StyleSheet.flatten(ctaLabel.props.style).flexShrink).toBeUndefined()
  })
})
