/**
 * #2866 — карточка адвента во вкладке «Обзор» профиля стоит за окном кампании:
 * вне окна её нет (и на web не грузится её чанк), в окне — есть после монтирования.
 */
import { render } from '@testing-library/react-native'

import { ProfileOverviewTab } from '@/components/screens/profile/ProfileOverviewTab'
import { useAdventProgressStore } from '@/stores/adventProgressStore'
import { i18n } from '@/i18n'
import { fakeToday } from './fakeToday'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, userId: '7', authReady: true }),
}))
jest.mock('@/hooks/useAchievementsApi', () => ({ useMyAchievements: () => ({ data: undefined }) }))
jest.mock('@/hooks/useGamification', () => ({ useSeedGamificationFromAchievements: () => undefined }))
jest.mock('@/components/profile/ProfileCompleteness', () => ({ ProfileCompleteness: () => null }))
jest.mock('@/components/profile/RankProgressCard', () => () => null)
jest.mock('@/components/profile/ProfileFirstStepsCard', () => () => null)
jest.mock('@/components/profile/ProfileSectionHeader', () => () => null)
jest.mock('@/components/achievements/AwardsHub', () => () => null)
jest.mock('@/components/achievements/GamificationOnboarding', () => () => null)
jest.mock('@/components/achievements/PlaceFirstBadgesSection', () => () => null)
jest.mock('@/components/profile/ProfileQuestCollections', () => () => null)
jest.mock('@/components/profile/ProfileCompletedQuests', () => () => null)
jest.mock('@/components/screens/profile/ProfileSectionsHub', () => ({ ProfileSectionsHub: () => null }))

const renderTab = () =>
  render(
    <ProfileOverviewTab
      userProp={{ name: 'Юля', email: 'u@example.com', hasDisplayName: true }}
      profile={{} as never}
      travelsCount={0}
      userId="7"
      onCreateRoute={jest.fn()}
      onStartQuest={jest.fn()}
    />,
  )

describe('ProfileOverviewTab — карточка адвента по окну кампании (#2866)', () => {
  beforeEach(async () => {
    useAdventProgressStore.setState({ byOwner: {} })
    await i18n.changeLanguage('ru')
  })
  afterEach(() => jest.useRealTimers())

  it('30.11 карточки нет', async () => {
    fakeToday(new Date(2026, 10, 30, 12))
    const screen = await renderTab()
    expect(screen.queryByTestId('profile-advent-card')).toBeNull()
  })

  it('03.12 карточка есть и читает прогресс владельца', async () => {
    fakeToday(new Date(2026, 11, 3, 12))
    useAdventProgressStore.setState({
      byOwner: { u7: { opened: { '1': '2026-12-01', '2': '2026-12-02' }, tasksDone: {} } },
    })
    const screen = await renderTab()
    expect(await screen.findByTestId('profile-advent-card')).toBeTruthy()
    expect(screen.getByText(/2 из 24 дверец/)).toBeTruthy()
  })

  it('08.01 карточки снова нет', async () => {
    fakeToday(new Date(2027, 0, 8, 12))
    const screen = await renderTab()
    expect(screen.queryByTestId('profile-advent-card')).toBeNull()
  })
})
