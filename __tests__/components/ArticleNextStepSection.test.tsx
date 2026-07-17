import { fireEvent, render } from '@testing-library/react-native'

import ArticleNextStepSection from '@/components/article/ArticleNextStepSection'
import { queueAnalyticsEvent } from '@/utils/analytics'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: jest.fn(),
}))

describe('ArticleNextStepSection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('offers map and quest continuations without an auth gate', () => {
    const { getByLabelText } = render(<ArticleNextStepSection articleId={42} />)

    fireEvent.press(getByLabelText('Открыть карту мест'))
    fireEvent.press(getByLabelText('Открыть городские квесты'))

    expect(queueAnalyticsEvent).toHaveBeenNthCalledWith(1, 'contextual_next_step_click', {
      source: 'article_detail_intro',
      content_type: 'article',
      content_id: '42',
      action: 'map',
    })
    expect(queueAnalyticsEvent).toHaveBeenNthCalledWith(2, 'contextual_next_step_click', {
      source: 'article_detail_intro',
      content_type: 'article',
      content_id: '42',
      action: 'quests',
    })
    expect(mockPush).toHaveBeenNthCalledWith(1, '/map')
    expect(mockPush).toHaveBeenNthCalledWith(2, '/quests')
  })
})
