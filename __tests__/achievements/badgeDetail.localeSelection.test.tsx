import type { ReactNode } from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import type { Badge, MyAchievements } from '@/api/achievements'
import type { BadgeDetail } from '@/components/achievements/BadgeDetailSheet'
import { MOCK_MY_ACHIEVEMENTS } from '@/api/achievementsMock'
import AchievementsGalleryModal from '@/components/achievements/AchievementsGalleryModal'
import RecentAwardsTab from '@/components/achievements/RecentAwardsTab'

jest.mock('@/hooks/useAchievementsApi', () => ({
  useMyAchievements: () => ({ data: mockData, isFetching: mockData == null }),
}))
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ isAuthenticated: true, username: 'Julia' }),
}))
jest.mock('@/components/ui/BottomSheet', () => {
  const React = require('react')
  const { View } = require('react-native')
  return ({ visible, children, modalContent }: { visible: boolean; children: ReactNode; modalContent?: ReactNode }) =>
    visible ? React.createElement(View, null, children, modalContent) : null
})
jest.mock('@/components/achievements/RankBar', () => () => null)
jest.mock('@/components/achievements/BadgeMedal', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')
  return ({ badge, onPress }: { badge: Badge; onPress?: () => void }) =>
    React.createElement(Pressable, { onPress, testID: `medal-${badge.id}` }, React.createElement(Text, null, badge.name))
})
jest.mock('@/components/achievements/BadgeDetailSheet', () => {
  const React = require('react')
  const { Text, View } = require('react-native')
  return ({ visible, detail }: { visible: boolean; detail: BadgeDetail | null }) => visible && detail ?
    React.createElement(View, { testID: 'selected-detail' },
      React.createElement(Text, null, detail.badge.description),
      React.createElement(Text, null, `share-${detail.userBadgeId}`)) : null
})

let mockData: MyAchievements | undefined
const makeData = (description: string): MyAchievements => {
  const earned = [{
    ...MOCK_MY_ACHIEVEMENTS.earned[0],
    badge: { ...MOCK_MY_ACHIEVEMENTS.earned[0].badge, description },
  }]
  return { ...MOCK_MY_ACHIEVEMENTS, earned, locked: [], recentlyEarned: earned }
}
beforeEach(() => { mockData = makeData('Русское описание') })

it('refreshes the selected gallery detail from the active language data and preserves its share identity', () => {
  const screen = () => <AchievementsGalleryModal visible onClose={() => {}} data={mockData!} />
  const view = render(screen())
  fireEvent.press(view.getByTestId(`medal-${mockData!.earned[0].badge.id}`))
  expect(view.getByText('Русское описание')).toBeTruthy()

  mockData = makeData('Opis po polsku')
  view.rerender(screen())

  expect(view.getByText('Opis po polsku')).toBeTruthy()
  expect(view.queryByText('Русское описание')).toBeNull()
  expect(view.getByText(`share-${mockData.earned[0].id}`)).toBeTruthy()

  mockData = { ...mockData, earned: [] }
  view.rerender(screen())
  expect(view.queryByTestId('selected-detail')).toBeNull()
})

it.each([false, true])('refreshes the selected recent badge without old-language prose (cold=%s)', cold => {
  const view = render(<RecentAwardsTab />)
  fireEvent.press(view.getByTestId(`recent-award-${mockData!.earned[0].badge.id}`))
  expect(view.getByText('Русское описание')).toBeTruthy()

  if (cold) {
    mockData = undefined
    view.rerender(<RecentAwardsTab testID="recent-loading" />)
    expect(view.queryByTestId('selected-detail')).toBeNull()
    expect(view.queryByText('Русское описание')).toBeNull()
  }
  mockData = makeData('Opis po polsku')
  view.rerender(<RecentAwardsTab testID="recent-pl" />)

  expect(view.getByText('Opis po polsku')).toBeTruthy()
  expect(view.queryByText('Русское описание')).toBeNull()
  expect(view.getByText(`share-${mockData.earned[0].id}`)).toBeTruthy()
})
