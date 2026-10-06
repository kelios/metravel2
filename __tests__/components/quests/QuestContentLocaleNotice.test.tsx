// #2198: пометка языка контента на детали квеста — три состояния.
import React from 'react'
import { render } from '@testing-library/react-native'

let mockLocale = 'pl'
jest.mock('@/hooks/useQuestContentLocale', () => ({
  useQuestContentLocale: () => mockLocale,
}))

import QuestContentLocaleNotice from '@/components/quests/QuestContentLocaleNotice'

describe('QuestContentLocaleNotice', () => {
  beforeEach(() => {
    mockLocale = 'pl'
  })

  it('контент на языке интерфейса — пометки нет', () => {
    const { queryByTestId } = render(<QuestContentLocaleNotice contentLocale="pl" />)
    expect(queryByTestId('quest-content-locale-notice')).toBeNull()
  })

  it('контент на другом языке — пометка с названием языка контента', () => {
    const { getByTestId } = render(<QuestContentLocaleNotice contentLocale="ru" />)
    const notice = getByTestId('quest-content-locale-notice')
    expect(notice.props.accessibilityLabel).toMatch(/\S/)
    expect(notice.props.accessibilityLabel).not.toMatch(/\{\{language\}\}/)
  })

  it('офлайн-копия на другом языке (регион в коде) — та же пометка', () => {
    mockLocale = 'en'
    const { getByTestId, getByText } = render(<QuestContentLocaleNotice contentLocale="pl-PL" compact />)
    const notice = getByTestId('quest-content-locale-notice')
    // На экране — короткая подпись, полный текст — для диктора.
    const shortText = getByText(/:/).props.children as string
    expect(shortText.length).toBeLessThan(String(notice.props.accessibilityLabel).length)
  })

  it('русский интерфейс и русский квест — пометки нет нигде', () => {
    mockLocale = 'ru'
    const { queryByTestId } = render(<QuestContentLocaleNotice contentLocale="ru" />)
    expect(queryByTestId('quest-content-locale-notice')).toBeNull()
  })
})
