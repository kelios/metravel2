import type { AskClient, AskRequest, AskResult } from '@/api/aiAssist/askProvider'
import type { AiSource } from '@/api/aiAssist/types'
import { parseAnswer } from '@/components/screens/assistant/AssistantAnswerText'
import { type AssistantTurn, buildHistoryFromTurns } from '@/components/screens/assistant/useAssistantChat'

import { createAskSession, renderShown } from '../../scripts/ai-assistant-eval/ask-path.mjs'

// #3286: путь службы контур меряет без экрана. Показанный текст и история диалога повторяют экран
// в `ask-path.mjs`; эти тесты держат их равными самому экрану — правка экрана без правки контура
// роняет тест, а не замер.

const SOURCES: AiSource[] = [
  { type: 'quest', source_id: '2', title: 'Квест по Бресту', url: 'https://metravel.by/quests/2', path: '/quests/2', snippet: '', score: 1 },
  { type: 'travel', source_id: '816', title: 'Ярмарки Польши', url: 'https://metravel.by/travels/816', path: '/travels/816', snippet: '', score: 1 },
]

/** Текст, который экран рисует по разбору `parseAnswer`: подпись ссылки, жирный без звёздочек, «• » у пункта. */
const screenText = (text: string) =>
  parseAnswer(text)
    .map((line) => `${line.bullet ? '• ' : ''}${line.tokens.map((token) => (token.kind === 'link' ? token.label : token.value)).join('')}`)
    .join('\n')
    .trim()

describe('путь службы повторяет экран (#3286)', () => {
  it.each([
    'Загляните в [Квест по Бресту](https://metravel.by/quests/2) и на [ярмарки](https://metravel.by/travels/816).',
    '## Что выбрать\n* **Квест по Бресту** — [страница](https://metravel.by/quests/2)\n- второй пункт без ссылки\n1. третий: https://metravel.by/travels/816.',
    'Материала пока нет.\n\nБлижайшее — https://metravel.by/travels/816, а ещё [чужая](https://evil.example/x) ссылка.',
    '',
  ])('показанный текст совпадает с разметкой экрана: %j', (answer) => {
    expect(renderShown(answer, SOURCES).answerText).toBe(screenText(answer))
  })

  it('нажимаемые ссылки — только на карточки хода: подпись ссылки или сам адрес', () => {
    const answer = '* [Квест по Бресту](https://metravel.by/quests/2)\n* [чужая](https://evil.example/x)\n* https://metravel.by/travels/816.'
    expect(renderShown(answer, SOURCES).linkLabels).toEqual(['Квест по Бресту', 'https://metravel.by/travels/816'])
    expect(renderShown(answer, []).linkLabels).toEqual([])
  })

  it('история диалога — та же, что собирает экран: только завершённые ответы, не длиннее трёх пар', async () => {
    const script: { question: string; status: AskResult['done']['status']; text: string }[] = [
      { question: 'первый', status: 'done', text: 'ответ 1' },
      { question: 'без материала', status: 'no_sources', text: 'черновик' },
      { question: 'второй', status: 'done', text: 'ответ 2' },
      { question: 'пустой', status: 'done', text: '  ' },
      { question: 'третий', status: 'done', text: 'ответ 3' },
      { question: 'четвёртый', status: 'done', text: 'ответ 4' },
      { question: 'последний', status: 'done', text: 'ответ 5' },
    ]
    const sent: AskRequest[] = []
    const client: AskClient = {
      async ask(request) {
        const step = script[sent.length]
        sent.push(request)
        return { sources: SOURCES, text: step.text, done: { status: step.status, reason: null, strikes: null, strikesToBlock: null, removedLinks: 0, usage: null, remaining: 5 } }
      },
    }
    const ask = createAskSession({ createAskClient: () => client, askUrl: 'http://service.test', visitor: '2001:db8::1', locale: 'ru' })
    for (const step of script) await ask(step.question)

    const turns = (count: number): AssistantTurn[] =>
      script.slice(0, count).map((step, index) => ({
        id: String(index), question: step.question, answer: step.status === 'done' ? step.text : '', sources: [], status: step.status,
        removedLinks: 0, retryAfterSec: null, usage: null, offTopicStrikes: null,
      }))
    for (const [index, request] of sent.entries()) expect(request.history).toEqual(buildHistoryFromTurns(turns(index)))
    expect(sent.at(-1)!.history.map((item) => item.text)).toEqual(['второй', 'ответ 2', 'третий', 'ответ 3', 'четвёртый', 'ответ 4'])
  })
})
