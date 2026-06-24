import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('@/components/travel/AuthorCard', () => ({
  __esModule: true,
  hasResolvableAuthor: () => true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, null, 'Author card body')
  },
}))

jest.mock('@/components/travel/ShareButtons', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, null, 'Share buttons')
  },
}))

jest.mock('@/components/travel/details/TravelPeerBadgesSection', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, null, 'Peer badges')
  },
}))

jest.mock('@/components/travel/details/TravelDetailsStyles', () => ({
  useTravelDetailsStyles: () => ({
    sectionContainer: {},
    contentStable: {},
    authorCardContainer: {},
    sectionHeaderText: {},
    shareButtonsContainer: {},
  }),
}))

import TravelDeferredAuthorSection from '@/components/travel/details/TravelDeferredAuthorSection'

describe('TravelDeferredAuthorSection', () => {
  it('keeps the mobile author block compact without duplicate explanatory subtitle', () => {
    const { getByText, queryByText } = render(
      <TravelDeferredAuthorSection travel={{ id: 1 } as any} isMobile />,
    )

    expect(getByText('Автор')).toBeTruthy()
    expect(getByText('Author card body')).toBeTruthy()
    expect(queryByText('Профиль, соцсети и другие путешествия автора')).toBeNull()
  })
})
