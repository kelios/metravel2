import React from 'react'
import { Platform } from 'react-native'
import { getTabRoles } from '@/utils/a11yTabRoles'
import { fireEvent, render, within } from '@testing-library/react-native'

jest.mock('@/components/achievements/AchievementsSection', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, null, 'all awards panel')
  },
}))
jest.mock('@/components/achievements/RecentAwardsTab', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, null, 'recent awards panel')
  },
}))
jest.mock('@/components/achievements/CharacterProfileCard', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, null, 'character panel')
  },
}))
jest.mock('@/components/achievements/ActivityProgressionSection', () => ({
  __esModule: true,
  default: ({ onOpenAwards }: { onOpenAwards?: () => void }) => {
    const React = require('react')
    const { Pressable, Text, View } = require('react-native')
    return React.createElement(
      View,
      null,
      React.createElement(Text, null, 'path progression panel'),
      React.createElement(
        Pressable,
        { testID: 'open-awards-from-path', onPress: onOpenAwards },
        React.createElement(Text, null, 'open awards')
      )
    )
  },
}))
jest.mock('@/components/achievements/RareAwardsSection', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, null, 'rare awards panel')
  },
}))

import AwardsHub from '@/components/achievements/AwardsHub'

describe('AwardsHub', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each(['web', 'ios', 'android'] as const)('keeps the real row ancestor, one selected child and switching on %s', os => {
    const original = Platform.OS
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
    try {
      const view = render(<AwardsHub />)
      const roles = getTabRoles()
      const row = view.getByTestId('awards-tabbar')
      expect(row.props.accessibilityRole).toBe(roles.tablist)
      const tabs = within(row).getAllByRole(roles.tab)
      expect(tabs).toHaveLength(4)
      expect(tabs.filter(tab => tab.props.accessibilityState?.selected)).toHaveLength(1)
      fireEvent.press(view.getByTestId('awards-tab-all'))
      const next = within(view.getByTestId('awards-tabbar')).getAllByRole(roles.tab)
      expect(next.filter(tab => tab.props.accessibilityState?.selected).map(tab => tab.props.testID)).toEqual(['awards-tab-all'])
    } finally { Object.defineProperty(Platform, 'OS', { configurable: true, value: original }) }
  })

  it('starts from the lightweight path tab without mounting all awards', () => {
    const { getByTestId, getByText, queryByText } = render(<AwardsHub />)

    expect(getByTestId('awards-tab-path').props.accessibilityState).toEqual({
      selected: true,
    })
    expect(getByText('character panel')).toBeTruthy()
    expect(getByText('path progression panel')).toBeTruthy()
    expect(queryByText('all awards panel')).toBeNull()
  })

  it('opens all awards from the path action', () => {
    const { getByTestId, getByText } = render(<AwardsHub />)

    fireEvent.press(getByTestId('open-awards-from-path'))

    expect(getByText('all awards panel')).toBeTruthy()
    expect(getByTestId('awards-tab-all').props.accessibilityState).toEqual({
      selected: true,
    })
  })
})
