/**
 * #1795: просьба об отзыве в каталоге. Она обязана быть закрываемой и вести
 * ровно на тот квест, который игрок прошёл.
 */
import { fireEvent, render } from '@testing-library/react-native'

import QuestReviewPromptBanner from '@/components/quests/QuestReviewPromptBanner'

const mockPush = jest.fn()
const mockTrackShown = jest.fn()
const mockTrackClick = jest.fn()

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}))

jest.mock('@/utils/questReviewAnalytics', () => ({
  ...jest.requireActual('@/utils/questReviewAnalytics'),
  trackQuestReviewPromptShown: (...args: unknown[]) => mockTrackShown(...args),
  trackQuestReviewPromptClick: (...args: unknown[]) => mockTrackClick(...args),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111827',
    textMuted: '#6b7280',
    surface: '#ffffff',
    background: '#ffffff',
    border: '#e5e7eb',
    primary: '#2563eb',
    primaryDark: '#1d4ed8',
    textOnPrimary: '#ffffff',
    warning: '#f59e0b',
  }),
}))

describe('QuestReviewPromptBanner', () => {
  beforeEach(() => jest.clearAllMocks())

  it('отмечает показ просьбы в аналитике', () => {
    render(
      <QuestReviewPromptBanner
        questId="minsk-cmok"
        cityId="3"
        questTitle="Цмок"
        onDismiss={jest.fn()}
      />,
    )

    expect(mockTrackShown).toHaveBeenCalledWith({ questId: 'minsk-cmok', cityId: '3' })
  })

  it('ведёт на страницу пройденного квеста и закрывается', () => {
    const onDismiss = jest.fn()
    const { getByTestId } = render(
      <QuestReviewPromptBanner
        questId="minsk-cmok"
        cityId="3"
        questTitle="Цмок"
        onDismiss={onDismiss}
      />,
    )

    fireEvent.press(getByTestId('quest-review-prompt-cta'))

    expect(mockTrackClick).toHaveBeenCalledWith({
      questId: 'minsk-cmok',
      cityId: '3',
      source: 'catalog_banner',
    })
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/quests/[city]/[questId]',
      params: { city: '3', questId: 'minsk-cmok' },
    })
    expect(onDismiss).toHaveBeenCalled()
  })

  it('закрывается крестиком без перехода', () => {
    const onDismiss = jest.fn()
    const { getByTestId } = render(
      <QuestReviewPromptBanner questId="minsk-cmok" cityId="3" onDismiss={onDismiss} />,
    )

    fireEvent.press(getByTestId('quest-review-prompt-dismiss'))

    expect(onDismiss).toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('без города не показывает переход: маршрут квеста собрать не из чего', () => {
    const { queryByTestId } = render(
      <QuestReviewPromptBanner questId="minsk-cmok" onDismiss={jest.fn()} />,
    )

    expect(queryByTestId('quest-review-prompt-cta')).toBeNull()
  })
})
