// __tests__/achievements/PeerBadgeReceivedRow.test.tsx
// Render tests for components/achievements/PeerBadgeReceivedRow.tsx

import React from 'react'
import { render } from '@testing-library/react-native'
import type { PeerBadge, PeerBadgeReceived } from '@/api/achievements'

// expo-linear-gradient — мокаем как в BadgeMedal.test.tsx
jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'linear-gradient', ...props }, children),
  }
})

// DESIGN_TOKENS — стаб нужных полей
jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 },
    typography: { sizes: { xs: 12, sm: 14, md: 16, lg: 18 } },
    radii: { xl: 16 },
  },
}))

// ImageCardMedia — мокаем, чтобы не тянуть expo-image в jsdom
jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')
  const { View } = require('react-native')
  return function MockImageCardMedia({ alt, ...props }: any) {
    return React.createElement(View, { testID: 'image-card-media', accessibilityLabel: alt, ...props })
  }
})

import PeerBadgeReceivedRow from '@/components/achievements/PeerBadgeReceivedRow'
import { mapPublic } from '@/api/achievementsNormalizers'

// ── fixtures ────────────────────────────────────────────────────────────────

const makePeerBadge = (overrides: Partial<PeerBadge> = {}): PeerBadge => ({
  id: 101,
  slug: 'favorite-author',
  name: 'Любимый автор',
  description: 'Один из ваших любимых авторов',
  categorySlug: 'community',
  categoryName: 'От сообщества',
  tier: 'gold',
  imageUrl: null,
  points: 0,
  isSecret: false,
  order: 101,
  target: 'user',
  ...overrides,
})

const makeReceived = (
  badgeOverrides: Partial<PeerBadge> = {},
  count = 5,
  grantedByMe = false,
): PeerBadgeReceived => ({
  badge: makePeerBadge(badgeOverrides),
  count,
  grantedByMe,
})

// ── пустой items → null ─────────────────────────────────────────────────────

describe('PeerBadgeReceivedRow — empty items', () => {
  it('renders null (nothing) when items is empty', async () => {
    const { toJSON } = await render(<PeerBadgeReceivedRow items={[]} />)
    expect(toJSON()).toBeNull()
  })
})

// ── badge name + count ──────────────────────────────────────────────────────

describe('PeerBadgeReceivedRow — badge name and count', () => {
  it('renders flat API summaries without catalogue IDs or visual metadata', async () => {
    const { peerReceived } = mapPublic({
      rank: {}, earned_badges: [],
      peer_received: [
        { badge_slug: 'favorite-author', name: 'Любимый автор', image_url: '', count: 2, granted_by_me: true },
        { badge_slug: 'inspired-me', name: 'Вдохновил меня', image_url: 'https://cdn.example.com/inspired.png', count: 3, granted_by_me: false },
      ],
    })
    const consoleError = jest.spyOn(console, 'error')
    try {
      const { getByText, getByLabelText } = await render(<PeerBadgeReceivedRow items={peerReceived} />)

      expect(getByText('Любимый автор')).toBeTruthy()
      expect(getByText('Вдохновил меня')).toBeTruthy()
      expect(getByText('2')).toBeTruthy()
      expect(getByText('3')).toBeTruthy()
      expect(getByLabelText('Любимый автор, получен')).toBeTruthy()
      expect(getByLabelText('Вдохновил меня')).toBeTruthy()
      expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/unique.*key/i)
    } finally {
      consoleError.mockRestore()
    }
  })

  it('renders badge name', async () => {
    const { getByText } = await render(
      <PeerBadgeReceivedRow items={[makeReceived({ name: 'Любимый автор' })]} />,
    )
    expect(getByText('Любимый автор')).toBeTruthy()
  })

  it('renders count pill value', async () => {
    const { getByText } = await render(
      <PeerBadgeReceivedRow items={[makeReceived({}, 42)]} />,
    )
    expect(getByText('42')).toBeTruthy()
  })

  it('renders count=0 in pill', async () => {
    const { getByText } = await render(
      <PeerBadgeReceivedRow items={[makeReceived({}, 0)]} />,
    )
    expect(getByText('0')).toBeTruthy()
  })

  it('renders all badges when multiple items provided', async () => {
    const items: PeerBadgeReceived[] = [
      makeReceived({ id: 101, name: 'Любимый автор', slug: 'a' }, 10),
      makeReceived({ id: 102, name: 'Вдохновил меня', slug: 'b' }, 7),
    ]
    const { getByText } = await render(<PeerBadgeReceivedRow items={items} />)
    expect(getByText('Любимый автор')).toBeTruthy()
    expect(getByText('Вдохновил меня')).toBeTruthy()
    expect(getByText('10')).toBeTruthy()
    expect(getByText('7')).toBeTruthy()
  })
})

// ── title prop ──────────────────────────────────────────────────────────────

describe('PeerBadgeReceivedRow — title prop', () => {
  it('renders custom title when provided', async () => {
    const { getByText } = await render(
      <PeerBadgeReceivedRow items={[makeReceived()]} title="Награды читателей" />,
    )
    expect(getByText('Награды читателей')).toBeTruthy()
  })

  it('renders default title "От сообщества" when title omitted', async () => {
    const { getByText } = await render(
      <PeerBadgeReceivedRow items={[makeReceived()]} />,
    )
    expect(getByText('От сообщества')).toBeTruthy()
  })

  it('does not render heading when title is null', async () => {
    const { queryByText } = await render(
      <PeerBadgeReceivedRow items={[makeReceived()]} title={null} />,
    )
    expect(queryByText('От сообщества')).toBeNull()
  })

  it('does not render heading when title is empty string', async () => {
    const { queryByText } = await render(
      <PeerBadgeReceivedRow items={[makeReceived()]} title="" />,
    )
    // empty-string title is falsy → same branch as null
    expect(queryByText('От сообщества')).toBeNull()
  })
})

// ── testID forwarding ───────────────────────────────────────────────────────

describe('PeerBadgeReceivedRow — testID', () => {
  it('forwards testID to root View', async () => {
    const { getByTestId } = await render(
      <PeerBadgeReceivedRow items={[makeReceived()]} testID="peer-row" />,
    )
    expect(getByTestId('peer-row')).toBeTruthy()
  })
})
