// __tests__/achievements/ShareBadgeSheet.test.tsx
// Sprint 12 #386: share-flow медали — выбор канала, копирование, открытие внешних
// каналов ТОЛЬКО через openExternalUrlInNewTab (не window.open/Linking), события
// аналитики (#458), премиум-вариант редких наград (#385).

import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import type { Badge } from '@/api/achievements'

jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  }
})

jest.mock('@/components/achievements/BadgeMedal', () => {
  const React = require('react')
  const { View } = require('react-native')
  return function MockBadgeMedal(props: any) {
    return React.createElement(View, { testID: 'badge-medal', ...props })
  }
})

const mockCreateShareCard = jest.fn()
jest.mock('@/api/achievementsShare', () => ({
  createShareCard: (...args: any[]) => mockCreateShareCard(...args),
}))

const mockOpenExternal = jest.fn()
jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: (...args: any[]) => mockOpenExternal(...args),
}))

const mockDownload = jest.fn(() => true)
jest.mock('@/utils/downloadUrlOnWeb', () => ({
  downloadUrlOnWeb: (...args: any[]) => mockDownload(...args),
}))

const mockSetString = jest.fn()
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: any[]) => mockSetString(...args),
}))

jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))

const mockTrackOpened = jest.fn()
const mockTrackShared = jest.fn()
const mockTrackClick = jest.fn()
jest.mock('@/utils/gamificationAnalytics', () => ({
  trackBadgeShareOpened: (...a: any[]) => mockTrackOpened(...a),
  trackBadgeShared: (...a: any[]) => mockTrackShared(...a),
  trackShareCardClick: (...a: any[]) => mockTrackClick(...a),
}))

import ShareBadgeSheet, { type ShareBadgeSubject } from '@/components/achievements/ShareBadgeSheet'

const badge = (overrides: Partial<Badge> = {}): Badge => ({
  id: 901,
  slug: 'first-wave',
  name: 'Первая волна',
  description: 'Один из первых авторов',
  categorySlug: 'social',
  categoryName: 'Сообщество',
  tier: 'legendary',
  imageUrl: null,
  points: 0,
  isSecret: false,
  order: 1,
  ...overrides,
})

const subject = (overrides: Partial<ShareBadgeSubject> = {}): ShareBadgeSubject => ({
  achievementId: 901,
  slug: 'first-wave',
  badge: badge(),
  ownerName: 'Юлия',
  reason: 'Один из первых авторов',
  ...overrides,
})

const CARD = {
  shareToken: 'tok',
  imageUrl: 'https://cdn/x.png',
  publicUrl: 'https://metravel.by/achievements/901',
  expiresAt: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCreateShareCard.mockResolvedValue(CARD)
  mockOpenExternal.mockResolvedValue(true)
})

const waitReady = async (getByTestId: any) =>
  waitFor(() =>
    expect(getByTestId('share-channel-copy').props.accessibilityState?.disabled).not.toBe(true),
  )

describe('ShareBadgeSheet', () => {
  it('tracks open and requests a default-template card', async () => {
    const { getByTestId } = render(
      <ShareBadgeSheet visible onClose={() => {}} subject={subject()} context="detail" />,
    )
    await waitReady(getByTestId)
    expect(mockTrackOpened).toHaveBeenCalledWith(
      expect.objectContaining({ achievementId: 901, slug: 'first-wave', isRare: false, context: 'detail' }),
    )
    expect(mockCreateShareCard).toHaveBeenCalledWith(
      expect.objectContaining({ achievementId: 901, template: 'default' }),
    )
  })

  it('requests a rare-template card and renders the premium ribbon', async () => {
    const { getByTestId, getByText } = render(
      <ShareBadgeSheet visible onClose={() => {}} subject={subject({ isRare: true })} />,
    )
    await waitReady(getByTestId)
    expect(mockCreateShareCard).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'rare' }),
    )
    expect(getByText('Редкая награда')).toBeTruthy()
  })

  it('copies a UTM-tagged public link and tracks the share', async () => {
    const { getByTestId } = render(
      <ShareBadgeSheet visible onClose={() => {}} subject={subject()} />,
    )
    await waitReady(getByTestId)
    fireEvent.press(getByTestId('share-channel-copy'))
    await waitFor(() => expect(mockSetString).toHaveBeenCalled())
    const link = mockSetString.mock.calls[0][0] as string
    expect(link).toContain('https://metravel.by/achievements/901')
    expect(link).toContain('utm_source=copy')
    expect(link).toContain('utm_medium=badge_share')
    expect(mockTrackShared).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'copy', achievementId: 901 }),
    )
  })

  it('opens Telegram only via openExternalUrlInNewTab', async () => {
    const { getByTestId } = render(
      <ShareBadgeSheet visible onClose={() => {}} subject={subject()} />,
    )
    await waitReady(getByTestId)
    fireEvent.press(getByTestId('share-channel-telegram'))
    await waitFor(() => expect(mockOpenExternal).toHaveBeenCalled())
    const url = mockOpenExternal.mock.calls[0][0] as string
    expect(url).toContain('https://t.me/share/url')
    expect(decodeURIComponent(url)).toContain('utm_source=telegram')
    expect(mockTrackShared).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram' }),
    )
  })

  it('opens Facebook sharer via openExternalUrlInNewTab', async () => {
    const { getByTestId } = render(
      <ShareBadgeSheet visible onClose={() => {}} subject={subject()} />,
    )
    await waitReady(getByTestId)
    fireEvent.press(getByTestId('share-channel-facebook'))
    await waitFor(() => expect(mockOpenExternal).toHaveBeenCalled())
    expect(mockOpenExternal.mock.calls[0][0]).toContain('facebook.com/sharer')
  })

  it('renders nothing without a subject', () => {
    const { toJSON } = render(
      <ShareBadgeSheet visible onClose={() => {}} subject={null} />,
    )
    expect(toJSON()).toBeNull()
  })
})
