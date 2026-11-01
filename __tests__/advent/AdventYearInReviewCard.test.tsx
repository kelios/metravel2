import { fireEvent, render, waitFor } from '@testing-library/react-native'

import AdventYearInReviewCard from '@/components/advent/AdventYearInReviewCard'
import AdventShareCard from '@/components/advent/AdventShareCard'
import { normalizeYearInReview } from '@/api/advent'
import { i18n } from '@/i18n'

let mockQuery: { isLoading: boolean; data: unknown } = { isLoading: false, data: undefined }
jest.mock('@/hooks/useYearInReviewQuery', () => ({ useYearInReviewQuery: () => mockQuery }))
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn(), queueAnalyticsEvent: jest.fn() }))
const mockShare = jest.fn()
jest.mock('@/utils/advent/adventShare', () => ({
  ...jest.requireActual('@/utils/advent/adventShare'),
  shareAdventCard: (...args: unknown[]) => mockShare(...args),
}))

const fullYear = normalizeYearInReview(
  {
    visited: { countries: ['Беларусь', 'Польша'], cities: 9, travels: 4 },
    published_travels: 2,
    quests_completed: 3,
    badges_earned: 5,
    longest_route_km: 640,
    advent: { opened: 24, streak: 24, completed: true },
  },
  2026,
)

describe('AdventYearInReviewCard (#2868)', () => {
  beforeEach(async () => {
    mockShare.mockReset()
    await i18n.changeLanguage('ru')
  })

  it('shows a loader while the aggregate loads', async () => {
    mockQuery = { isLoading: true, data: undefined }
    const screen = await render(<AdventYearInReviewCard year={2026} />)
    expect(screen.getByTestId('advent-yir-loading')).toBeTruthy()
  })

  it('renders non-zero stats, countries and shares the card', async () => {
    mockQuery = { isLoading: false, data: fullYear }
    mockShare.mockResolvedValue('shared')
    const screen = await render(<AdventYearInReviewCard year={2026} />)
    expect(screen.getByText('Итоги 2026 года')).toBeTruthy()
    expect(screen.getByTestId('advent-yir-stat-countries')).toBeTruthy()
    expect(screen.getByText('640 км')).toBeTruthy()
    expect(screen.getByText('24/24')).toBeTruthy()
    expect(screen.getByText('Польша')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('advent-yir-share'))
    await waitFor(() => expect(mockShare).toHaveBeenCalled())
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'year', year: 2026, text: 'Мои итоги 2026 года путешественника на MeTravel' }),
    )
  })

  it('shows a soft call to plan next year for an empty year', async () => {
    mockQuery = { isLoading: false, data: normalizeYearInReview({}, 2026) }
    const screen = await render(<AdventYearInReviewCard year={2026} />)
    expect(screen.getByTestId('advent-yir-empty')).toBeTruthy()
    expect(screen.getByText(/путешествия на 2027 год/)).toBeTruthy()
  })

  it('shows the postcard with an honest message when the server is unavailable', async () => {
    mockQuery = { isLoading: false, data: undefined }
    const screen = await render(<AdventYearInReviewCard year={2026} />)
    expect(screen.getByTestId('advent-yir-unavailable')).toBeTruthy()
    expect(screen.queryByTestId('advent-yir-share')).toBeNull()
  })
})

describe('AdventShareCard (#2868)', () => {
  beforeEach(async () => {
    mockShare.mockReset()
    await i18n.changeLanguage('ru')
  })

  it('shares "My advent N/24" and reports a copied link', async () => {
    mockShare.mockResolvedValue('copied')
    const screen = await render(<AdventShareCard openedCount={12} streak={5} year={2026} />)
    expect(screen.getByText('Мой адвент 12/24')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('advent-share-card-share'))
    await waitFor(() => expect(mockShare).toHaveBeenCalled())
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'progress', text: 'Открыто 12 из 24 дверец моего адвент-календаря путешественника на MeTravel' }),
    )
    expect(await screen.findByTestId('advent-share-card-status')).toBeTruthy()
    expect(screen.getByText('Ссылка скопирована')).toBeTruthy()
  })

  it('reports a failed share without crashing', async () => {
    mockShare.mockResolvedValue('failed')
    const screen = await render(<AdventShareCard openedCount={1} streak={0} year={2026} />)
    await fireEvent.press(screen.getByTestId('advent-share-card-share'))
    expect(await screen.findByText('Не получилось поделиться. Попробуйте ещё раз')).toBeTruthy()
  })
})
