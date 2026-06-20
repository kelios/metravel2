// __tests__/achievements/PeerBadgePickerSheet.test.tsx
// Render tests for components/achievements/PeerBadgePickerSheet.tsx
//
// Стратегия: Modal в setup.ts мокается как View-wrapper (visible=false → null),
// хуки usePeerBadgeCatalog / useGrantPeerBadge мокаются через
// jest.mock('@/hooks/useAchievementsApi').

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import type { PeerBadge, PeerBadgeReceived } from '@/api/achievements'

// expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'linear-gradient', ...props }, children),
  }
})

// DESIGN_TOKENS
jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 },
    typography: { sizes: { xs: 12, sm: 14, md: 16, lg: 18 } },
    radii: { xl: 16 },
  },
}))

// ImageCardMedia
jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')
  const { View } = require('react-native')
  return function MockImageCardMedia({ alt, ...props }: any) {
    return React.createElement(View, { testID: 'image-card-media', accessibilityLabel: alt, ...props })
  }
})

// Hooks — мокаем целиком
const mockMutate = jest.fn()

jest.mock('@/hooks/useAchievementsApi', () => ({
  usePeerBadgeCatalog: jest.fn(),
  useGrantPeerBadge: jest.fn(),
}))

import { usePeerBadgeCatalog, useGrantPeerBadge } from '@/hooks/useAchievementsApi'
import PeerBadgePickerSheet from '@/components/achievements/PeerBadgePickerSheet'

const mockUsePeerBadgeCatalog = usePeerBadgeCatalog as jest.MockedFunction<typeof usePeerBadgeCatalog>
const mockUseGrantPeerBadge = useGrantPeerBadge as jest.MockedFunction<typeof useGrantPeerBadge>

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

const makeCatalog = (): PeerBadge[] => [
  makePeerBadge({ id: 101, slug: 'favorite-author', name: 'Любимый автор', target: 'user' }),
  makePeerBadge({ id: 102, slug: 'inspired-me', name: 'Вдохновил меня', target: 'user' }),
  makePeerBadge({ id: 111, slug: 'best-article', name: 'Лучшая статья', target: 'travel' }),
  makePeerBadge({ id: 112, slug: 'best-photos', name: 'Лучшие фото', target: 'travel' }),
]

const makeReceived = (
  badge: PeerBadge,
  count: number,
  grantedByMe: boolean,
): PeerBadgeReceived => ({ badge, count, grantedByMe })

const defaultProps = {
  onClose: jest.fn(),
  target: 'user' as const,
  received: [] as PeerBadgeReceived[],
}

// ── setup helpers ────────────────────────────────────────────────────────────

const setupHooks = (catalogData: PeerBadge[] | undefined, isLoading = false) => {
  mockUsePeerBadgeCatalog.mockReturnValue({
    data: catalogData,
    isLoading,
    error: null,
    isError: false,
    isSuccess: !isLoading,
  } as any)
  mockUseGrantPeerBadge.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  } as any)
}

// ── visible=false ────────────────────────────────────────────────────────────

describe('PeerBadgePickerSheet — visible=false', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupHooks(makeCatalog())
  })

  it('renders nothing when visible=false', () => {
    const { toJSON } = render(
      <PeerBadgePickerSheet {...defaultProps} visible={false} />,
    )
    // MockModal in setup.ts returns null when visible=false
    expect(toJSON()).toBeNull()
  })
})

// ── visible=true, target filtering ──────────────────────────────────────────

describe('PeerBadgePickerSheet — visible=true, target filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupHooks(makeCatalog())
  })

  it('shows only user-targeted badges when target="user"', () => {
    const { getByText, queryByText } = render(
      <PeerBadgePickerSheet {...defaultProps} visible target="user" />,
    )
    expect(getByText('Любимый автор')).toBeTruthy()
    expect(getByText('Вдохновил меня')).toBeTruthy()
    // travel-targeted should not appear
    expect(queryByText('Лучшая статья')).toBeNull()
    expect(queryByText('Лучшие фото')).toBeNull()
  })

  it('shows only travel-targeted badges when target="travel"', () => {
    const { getByText, queryByText } = render(
      <PeerBadgePickerSheet {...defaultProps} visible target="travel" />,
    )
    expect(getByText('Лучшая статья')).toBeTruthy()
    expect(getByText('Лучшие фото')).toBeTruthy()
    expect(queryByText('Любимый автор')).toBeNull()
    expect(queryByText('Вдохновил меня')).toBeNull()
  })

  it('renders no options when catalog is empty', () => {
    setupHooks([])
    const { queryByText } = render(
      <PeerBadgePickerSheet {...defaultProps} visible target="user" />,
    )
    expect(queryByText('Любимый автор')).toBeNull()
  })

  it('renders no options when catalog is undefined (loading)', () => {
    setupHooks(undefined, false)
    const { queryByText } = render(
      <PeerBadgePickerSheet {...defaultProps} visible target="user" />,
    )
    expect(queryByText('Любимый автор')).toBeNull()
  })
})

// ── "Выдать" / "Выдано" по grantedByMe ──────────────────────────────────────

describe('PeerBadgePickerSheet — Выдать/Выдано toggle text', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupHooks(makeCatalog())
  })

  it('shows "Выдать" for badge not yet granted', () => {
    const { getAllByText } = render(
      <PeerBadgePickerSheet {...defaultProps} visible target="user" received={[]} />,
    )
    const buttons = getAllByText('Выдать')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('shows "Выдано" for badge already granted by me', () => {
    const catalog = makeCatalog()
    const received = [makeReceived(catalog[0], 3, true)]

    const { getByText } = render(
      <PeerBadgePickerSheet
        {...defaultProps}
        visible
        target="user"
        received={received}
      />,
    )
    expect(getByText('Выдано')).toBeTruthy()
  })

  it('shows "Выдать" for badge received by others but not by me (grantedByMe=false)', () => {
    const catalog = makeCatalog()
    const received = [makeReceived(catalog[0], 5, false)]

    const { getAllByText } = render(
      <PeerBadgePickerSheet
        {...defaultProps}
        visible
        target="user"
        received={received}
      />,
    )
    const giveButtons = getAllByText('Выдать')
    expect(giveButtons.length).toBeGreaterThan(0)
  })
})

// ── тап по опции вызывает mutate ──────────────────────────────────────────────

describe('PeerBadgePickerSheet — tap calls mutate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupHooks(makeCatalog())
  })

  it('calls grant.mutate with badgeSlug and recipientId when user-target option tapped', () => {
    const { getByLabelText } = render(
      <PeerBadgePickerSheet
        {...defaultProps}
        visible
        target="user"
        recipientId={42}
        received={[]}
      />,
    )
    fireEvent.press(getByLabelText(/Выдать значок «Любимый автор»/))
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ badgeSlug: 'favorite-author', recipientId: 42 }),
    )
  })

  it('calls grant.mutate with travelId when travel-target option tapped', () => {
    const { getByLabelText } = render(
      <PeerBadgePickerSheet
        {...defaultProps}
        visible
        target="travel"
        travelId={99}
        received={[]}
      />,
    )
    fireEvent.press(getByLabelText(/Выдать значок «Лучшая статья»/))
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ badgeSlug: 'best-article', travelId: 99 }),
    )
  })

  it('label changes to "Забрать" for already granted badge', () => {
    const catalog = makeCatalog()
    const received = [makeReceived(catalog[0], 3, true)]

    const { getByLabelText } = render(
      <PeerBadgePickerSheet
        {...defaultProps}
        visible
        target="user"
        recipientId={1}
        received={received}
      />,
    )
    // badge is granted → label should be "Забрать значок «...»"
    const el = getByLabelText(/Забрать значок «Любимый автор»/)
    expect(el).toBeTruthy()
    fireEvent.press(el)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ badgeSlug: 'favorite-author' }),
    )
  })
})

// ── заголовок листа ───────────────────────────────────────────────────────────

describe('PeerBadgePickerSheet — heading', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupHooks(makeCatalog())
  })

  it('shows "Наградить автора" for user target by default', () => {
    const { getByText } = render(
      <PeerBadgePickerSheet {...defaultProps} visible target="user" />,
    )
    expect(getByText('Наградить автора')).toBeTruthy()
  })

  it('shows "Наградить путешествие" for travel target by default', () => {
    const { getByText } = render(
      <PeerBadgePickerSheet {...defaultProps} visible target="travel" />,
    )
    expect(getByText('Наградить путешествие')).toBeTruthy()
  })

  it('shows custom title when provided', () => {
    const { getByText } = render(
      <PeerBadgePickerSheet {...defaultProps} visible target="user" title="Выдать медаль" />,
    )
    expect(getByText('Выдать медаль')).toBeTruthy()
  })
})

// ── loading state ─────────────────────────────────────────────────────────────

describe('PeerBadgePickerSheet — loading', () => {
  it('shows ActivityIndicator while catalog is loading', () => {
    jest.clearAllMocks()
    setupHooks(undefined, true)
    const { UNSAFE_getByType } = render(
      <PeerBadgePickerSheet {...defaultProps} visible target="user" />,
    )
    const { ActivityIndicator } = require('react-native')
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
  })
})
