import { fireEvent, render, screen } from '@testing-library/react-native'

import type { AiSource } from '@/api/aiAssist/types'
import { AssistantAnswerText, parseAnswer, tokenizeInline } from '@/components/screens/assistant/AssistantAnswerText'

const sources: AiSource[] = [
  {
    type: 'travel',
    source_id: '1',
    title: 'Выходные в Гродно',
    url: 'https://metravel.by/travels/vyhodnye-v-grodno',
    path: '/travels/vyhodnye-v-grodno',
    snippet: '',
    score: 1,
  },
]

describe('AssistantAnswerText (#2460)', () => {
  it('разбирает markdown-lite: маркеры списка, жирный, ссылки, голые URL с пунктуацией', () => {
    expect(parseAnswer('* **Статья:** [Гродно](https://metravel.by/travels/vyhodnye-v-grodno).')).toEqual([
      {
        bullet: true,
        tokens: [
          { kind: 'bold', value: 'Статья:' },
          { kind: 'text', value: ' ' },
          { kind: 'link', label: 'Гродно', url: 'https://metravel.by/travels/vyhodnye-v-grodno' },
          { kind: 'text', value: '.' },
        ],
      },
    ])
    expect(tokenizeInline('см. https://metravel.by/travels/x, дальше')).toEqual([
      { kind: 'text', value: 'см. ' },
      { kind: 'link', label: 'https://metravel.by/travels/x', url: 'https://metravel.by/travels/x' },
      { kind: 'text', value: ',' },
      { kind: 'text', value: ' дальше' },
    ])
    expect(parseAnswer('## Заголовок\n1. пункт')).toEqual([
      { bullet: false, tokens: [{ kind: 'text', value: 'Заголовок' }] },
      { bullet: true, tokens: [{ kind: 'text', value: 'пункт' }] },
    ])
  })

  it('ссылка карточки ведёт внутрь приложения, чужой адрес остаётся текстом', () => {
    render(
      <AssistantAnswerText
        text={'Смотрите [статью](https://metravel.by/travels/vyhodnye-v-grodno) и [другое](https://metravel.by/travels/pridumano)'}
        sources={sources}
        style={{}}
        linkColor="#000"
        testID="answer"
      />,
    )
    const links = screen.getAllByTestId('assistant-answer-link')
    expect(links).toHaveLength(1)
    fireEvent.press(links[0])
    const { router } = jest.requireMock('expo-router')
    expect(router.push).toHaveBeenCalledWith('/travels/vyhodnye-v-grodno')
    expect(screen.getByText(/другое/)).toBeTruthy()
  })
})
