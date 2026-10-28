import { getOnlyHost } from '@/__tests__/helpers/hostQueries'
// __tests__/achievements/BadgeMedal.test.tsx
// Render tests for components/achievements/BadgeMedal.tsx

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import type { Badge } from '@/api/achievements'

// react-native-svg — стаб (BadgeEmblem рисует векторную эмблему).
// Используем именованный testID 'svg' из корневого __mocks__/react-native-svg.js
// (jest подхватывает manual mock для node_modules автоматически).

// DESIGN_TOKENS — стаб нужных полей
jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    spacing: { xs: 4, sm: 8, md: 16 },
    typography: { sizes: { xs: 12, sm: 14, md: 16 } },
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

// badgeVisuals используется напрямую — реальный модуль, мок не нужен.
// @expo/vector-icons/Feather мокается глобально в setup.ts

import BadgeMedal from '@/components/achievements/BadgeMedal'

// ── fixtures ───────────────────────────────────────────────────────────────────

const makeBadge = (overrides: Partial<Badge> = {}): Badge => ({
  id: 1,
  slug: 'hiker-bronze',
  name: 'Хайкер',
  description: '3 похода',
  categorySlug: 'theme',
  categoryName: 'Темы',
  tier: 'bronze',
  imageUrl: null,
  points: 20,
  isSecret: false,
  order: 1,
  ...overrides,
})

// ── accessibilityLabel ─────────────────────────────────────────────────────────

describe('BadgeMedal — accessibilityLabel', () => {
  it('earned badge label contains "получен"', async () => {
    const { getByLabelText } = await render(
      <BadgeMedal badge={makeBadge({ name: 'Хайкер', tier: 'bronze' })} earned />,
    )
    expect(getByLabelText(/получен/)).toBeTruthy()
  })

  it('locked badge label contains "не получен"', async () => {
    const { getByLabelText } = await render(
      <BadgeMedal badge={makeBadge({ name: 'Хайкер' })} earned={false} />,
    )
    expect(getByLabelText(/не получен/)).toBeTruthy()
  })

  it('earned label includes tier label when tier is named', async () => {
    const { getByLabelText } = await render(
      <BadgeMedal badge={makeBadge({ name: 'Хайкер', tier: 'gold' })} earned />,
    )
    // "Хайкер, Золото, получен"
    expect(getByLabelText(/Золото/)).toBeTruthy()
  })

  it('earned label omits tier label when tier is "none"', async () => {
    const { getByLabelText } = await render(
      <BadgeMedal badge={makeBadge({ name: 'Тест', tier: 'none' })} earned />,
    )
    // Label = "Тест, получен" — no tier word between name and state
    const el = getByLabelText(/Тест, получен/)
    expect(el).toBeTruthy()
  })

  it('locked + progress: label includes progress in accessibilityLabel', async () => {
    const { getByLabelText } = await render(
      <BadgeMedal
        badge={makeBadge({ name: 'Хайкер' })}
        earned={false}
        progress={{ current: 2, threshold: 3 }}
      />,
    )
    // "…не получен. Прогресс 2 из 3"
    expect(getByLabelText(/Прогресс 2 из 3/)).toBeTruthy()
  })

  it('earned + progress: no progress text appended to label', async () => {
    const { queryByLabelText } = await render(
      <BadgeMedal
        badge={makeBadge({ name: 'Хайкер' })}
        earned
        progress={{ current: 2, threshold: 3 }}
      />,
    )
    expect(queryByLabelText(/Прогресс/)).toBeNull()
  })
})

// ── progress text ──────────────────────────────────────────────────────────────

describe('BadgeMedal — progress text', () => {
  it('renders "current/threshold" text when locked and progress provided', async () => {
    const { getByText } = await render(
      <BadgeMedal
        badge={makeBadge()}
        earned={false}
        progress={{ current: 5, threshold: 15 }}
      />,
    )
    expect(getByText('5/15')).toBeTruthy()
  })

  it('does NOT render progress text when earned=true', async () => {
    const { queryByText } = await render(
      <BadgeMedal
        badge={makeBadge()}
        earned
        progress={{ current: 5, threshold: 15 }}
      />,
    )
    expect(queryByText('5/15')).toBeNull()
  })

  it('does NOT render progress text when progress is null', async () => {
    const { queryByText } = await render(
      <BadgeMedal badge={makeBadge()} earned={false} progress={null} />,
    )
    expect(queryByText(/\d+\/\d+/)).toBeNull()
  })
})

// ── label rendering ────────────────────────────────────────────────────────────

describe('BadgeMedal — showLabel', () => {
  it('renders badge name as visible label when showLabel=true', async () => {
    const { getByText } = await render(
      <BadgeMedal badge={makeBadge({ name: 'Хайкер' })} showLabel />,
    )
    expect(getByText('Хайкер')).toBeTruthy()
  })

  it('does NOT render visible label when showLabel=false (default)', async () => {
    const { queryByText } = await render(<BadgeMedal badge={makeBadge({ name: 'Хайкер' })} />)
    expect(queryByText('Хайкер')).toBeNull()
  })
})

// ── onPress ────────────────────────────────────────────────────────────────────

describe('BadgeMedal — onPress', () => {
  it('calls onPress when pressed', async () => {
    const onPress = jest.fn()
    const { getByLabelText } = await render(
      <BadgeMedal badge={makeBadge({ name: 'Хайкер' })} earned onPress={onPress} />,
    )
    await fireEvent.press(getByLabelText(/Хайкер/))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('root element has accessibilityRole="button" when onPress is provided', async () => {
    const { container } = await render(
      <BadgeMedal badge={makeBadge()} earned onPress={jest.fn()} />,
    )
    expect(getOnlyHost(container, node => node.props.accessibilityRole === 'button')).toBeTruthy()
  })

  it('root element has accessibilityRole="image" when no onPress', async () => {
    const { container } = await render(<BadgeMedal badge={makeBadge()} earned />)
    expect(getOnlyHost(container, node => node.props.accessibilityRole === 'image')).toBeTruthy()
  })
})

// ── imageUrl rendering ─────────────────────────────────────────────────────────

describe('BadgeMedal — imageUrl', () => {
  it('renders ImageCardMedia when badge.imageUrl is set', async () => {
    const { getByTestId } = await render(
      <BadgeMedal
        badge={makeBadge({ imageUrl: 'https://s3.example.com/badge.png' })}
        earned
      />,
    )
    expect(getByTestId('image-card-media')).toBeTruthy()
  })

  it('renders vector emblem (BadgeEmblem svg) when imageUrl is null', async () => {
    const { getAllByTestId } = await render(
      <BadgeMedal badge={makeBadge({ imageUrl: null })} earned />,
    )
    // Эмблема помечена accessibilityElementsHidden (a11y-метка на корне медали),
    // поэтому ищем root svg с includeHiddenElements.
    expect(
      getAllByTestId('svg', { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0)
  })
})

// ── testID ────────────────────────────────────────────────────────────────────

describe('BadgeMedal — testID', () => {
  it('forwards testID to root element', async () => {
    const { getByTestId } = await render(
      <BadgeMedal badge={makeBadge()} earned testID="badge-medal-1" />,
    )
    expect(getByTestId('badge-medal-1')).toBeTruthy()
  })
})
