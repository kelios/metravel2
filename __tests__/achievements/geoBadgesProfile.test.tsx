import { fireEvent, render } from '@testing-library/react-native'
import type { MyAchievements } from '@/api/achievements'
import { MOCK_BADGES, MOCK_RANK } from '@/api/achievementsMock'
import AchievementsSection from '@/components/achievements/AchievementsSection'

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean; userId: number; username: string }) => unknown) =>
    selector({ isAuthenticated: true, userId: 7, username: 'Новичок' }),
}))

let mockAchievements: MyAchievements | null = null

jest.mock('@/hooks/useAchievementsApi', () => ({
  useMyAchievements: () => ({ data: mockAchievements, isFetching: false, isError: false }),
  useUserAchievements: () => ({ data: { peerReceived: [] } }),
}))

const badge = (slug: string) => {
  const found = MOCK_BADGES.find((item) => item.slug === slug)
  if (!found) throw new Error(`missing mock badge ${slug}`)
  return found
}

const city = badge('quest-city-series')
const regions = badge('quest-two-regions')

const mine = (earnedCity: boolean): MyAchievements => ({
  rank: MOCK_RANK,
  earned: earnedCity
    ? [{ id: 119, badge: city, earnedAt: '2026-11-01T00:00:00Z', period: null, discovery: null }]
    : [],
  locked: [
    ...(earnedCity ? [] : [{ badge: city, current: 1, threshold: 2 }]),
    { badge: regions, current: 0, threshold: 2 },
  ],
  recentlyEarned: [],
  activityTypes: [],
})

describe('geo badges in the profile achievements tab (#3241)', () => {
  it('shows an earned city-series badge and the locked two-regions condition', async () => {
    mockAchievements = mine(true)
    const view = await render(<AchievementsSection bare />)

    expect(view.getByText('Городская серия')).toBeTruthy()
    expect(view.getByText('Завершены два разных квеста в одном городе.')).toBeTruthy()
    expect(view.getByText('Два региона')).toBeTruthy()
    expect(view.getByText('Завершены квесты в двух разных регионах. Учитываются регионы Беларуси и Польши.')).toBeTruthy()
    expect(view.getByText('Квесты')).toBeTruthy()
    expect(view.getByText('Гео')).toBeTruthy()
    expect(view.queryByText('Пока нет значков. Публикуйте путешествия и проходите квесты — они появятся здесь.')).toBeNull()

    await fireEvent.press(view.getByLabelText(/Два региона/))
    expect(view.getByText('Как получить')).toBeTruthy()
  })

  it('shows both unlock conditions to a player who has not earned either badge', async () => {
    mockAchievements = mine(false)
    const view = await render(<AchievementsSection bare />)

    expect(view.getByText('Городская серия')).toBeTruthy()
    expect(view.getByText('Завершены два разных квеста в одном городе.')).toBeTruthy()
    expect(view.getByText('Два региона')).toBeTruthy()
    expect(view.getByText('0/2')).toBeTruthy()
    expect(view.getByText('1/2')).toBeTruthy()
  })
})
