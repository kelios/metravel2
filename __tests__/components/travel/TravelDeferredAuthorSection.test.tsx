import React from 'react'
import { render } from '@testing-library/react-native'
import { useResponsiveWidth } from '@/hooks/useResponsive'

jest.mock('@/hooks/useResponsive', () => ({
  useResponsiveWidth: jest.fn(),
}))

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
  beforeEach(() => {
    jest.mocked(useResponsiveWidth).mockReturnValue(390)
  })

  it('keeps the mobile author block compact without duplicate explanatory subtitle', async () => {
    const { getByTestId, getByText, queryByText } = await render(
      <TravelDeferredAuthorSection travel={{ id: 1 } as any} isMobile />,
    )

    expect(getByTestId('travel-details-author-mobile')).toBeTruthy()
    expect(getByText('Автор')).toBeTruthy()
    expect(getByText('Author card body')).toBeTruthy()
    expect(getByText('Share buttons')).toBeTruthy()
    expect(queryByText('Профиль, соцсети и другие путешествия автора')).toBeNull()
  })

  it('keeps the author visible on tablet without duplicating the desktop share block', async () => {
    jest.mocked(useResponsiveWidth).mockReturnValue(820)

    const { getByTestId, getByText, queryByText } = await render(
      <TravelDeferredAuthorSection travel={{ id: 1 } as any} isMobile={false} />,
    )

    expect(getByTestId('travel-details-author')).toBeTruthy()
    expect(getByText('Author card body')).toBeTruthy()
    expect(queryByText('Share buttons')).toBeNull()
    expect(getByText('Peer badges')).toBeTruthy()
  })

  it('leaves the inline author out when the desktop sidebar owns it', async () => {
    jest.mocked(useResponsiveWidth).mockReturnValue(1440)

    const { getByText, queryByTestId, queryByText } = await render(
      <TravelDeferredAuthorSection travel={{ id: 1 } as any} isMobile={false} />,
    )

    expect(queryByTestId('travel-details-author')).toBeNull()
    expect(queryByText('Author card body')).toBeNull()
    expect(getByText('Peer badges')).toBeTruthy()
  })
})
