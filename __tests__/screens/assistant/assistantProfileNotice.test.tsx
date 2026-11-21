/**
 * #3354: строка «Ассистент учитывает ваши статьи и сохранённое» — только вошедшему и только когда служба
 * подтвердила личный контекст в последнем ходе.
 */
import { act, render, renderHook, screen } from '@testing-library/react-native'

jest.mock('@/api/aiAssist/limits', () => ({
  AI_ASK_DAILY_LIMIT: 20,
  AI_OFFTOPIC_STRIKES_TO_BLOCK: 3,
  consumeQuestion: jest.fn(async () => 19),
  readRemainingQuestions: jest.fn(async () => 20),
  readOffTopicState: jest.fn(async () => ({ strikes: 0, blocked: false })),
  registerOffTopicStrike: jest.fn(async () => ({ strikes: 1, blocked: false })),
}))
jest.mock('@/api/aiAssist/demandLog', () => ({ logDemand: jest.fn(async () => []) }))
jest.mock('@/api/aiAssist/retrieval', () => ({
  searchSiteMaterials: jest.fn(async () => []),
  buildRetrievalQuery: jest.requireActual('@/api/aiAssist/retrieval').buildRetrievalQuery,
}))

import { type AskClient, AskError, type AskResult } from '@/api/aiAssist/askProvider'
import type { Generator } from '@/api/aiAssist/generator'
import { AssistantProfileNotice } from '@/components/screens/assistant/AssistantProfileNotice'
import type { AssistantStyles } from '@/components/screens/assistant/assistantStyles'
import { useAssistantChat } from '@/components/screens/assistant/useAssistantChat'
import { translate as i18nT } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'

const styles = { profileNotice: {} } as unknown as AssistantStyles
const NOTICE = 'Ассистент учитывает ваши статьи и сохранённое'

const done = (patch: Partial<AskResult['done']> = {}): AskResult['done'] => ({
  status: 'done',
  reason: null,
  strikes: null,
  strikesToBlock: null,
  removedLinks: 0,
  fallback: false,
  relabeled: 0,
  droppedDescriptions: 0,
  ungroundedNumbers: 0,
  usage: null,
  remaining: 19,
  turnId: null,
  ...patch,
})

const clientOf = (...steps: Array<AskResult['done']>): AskClient => {
  let index = 0
  return {
    ask: async () => ({ sources: [], text: 'Загляните на сайт.', done: steps[Math.min(index++, steps.length - 1)] }),
  }
}

describe('строка о личном контексте (#3354)', () => {
  afterEach(async () => {
    await act(async () => {
      useAuthStore.setState({ isAuthenticated: false })
    })
  })

  it('текст строки — из локали', () => {
    expect(i18nT('aiAssistStatic:ask.profileNotice')).toBe(NOTICE)
  })

  it('видна вошедшему после подтверждения службы; гостю и без подтверждения — нет', async () => {
    await act(async () => {
      useAuthStore.setState({ isAuthenticated: true })
    })
    const view = await render(<AssistantProfileNotice confirmed styles={styles} />)
    expect(screen.getByTestId('assistant-profile-notice').props.children).toBe(NOTICE)

    await view.rerender(<AssistantProfileNotice confirmed={false} styles={styles} />)
    expect(screen.queryByTestId('assistant-profile-notice')).toBeNull()

    // Посетитель вышел: строка исчезает сразу, не дожидаясь следующего ответа службы.
    await view.rerender(<AssistantProfileNotice confirmed styles={styles} />)
    expect(screen.getByTestId('assistant-profile-notice')).toBeTruthy()
    await act(async () => {
      useAuthStore.setState({ isAuthenticated: false })
    })
    expect(screen.queryByTestId('assistant-profile-notice')).toBeNull()
  })

  it('хук: признак берётся из последнего хода службы и снимается, когда служба его не прислала', async () => {
    const client = clientOf(done({ profile: true }), done(), done({ status: 'no_sources', profile: true }))
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client }))
    expect(result.current.profileActive).toBe(false)
    await act(async () => {
      await result.current.ask('Куда поехать на выходные?')
    })
    expect(result.current.profileActive).toBe(true)
    await act(async () => {
      await result.current.ask('А что ещё посмотреть рядом?')
    })
    expect(result.current.profileActive).toBe(false)
    await act(async () => {
      await result.current.ask('Куда съездить в Литве?')
    })
    expect(result.current.profileActive).toBe(true)
  })

  // #3431 Б1: ход, который служба не закончила, признак прошлого хода не сохраняет.
  // Лимит и блок закрывают поле вопроса до срока сервера — следующий вопрос после них не уходит.
  it.each<[string, () => Error, boolean]>([
    ['лимит 429', () => new AskError('limit', 'limit', { status: 429, retryAfterSec: 60 }), false],
    ['служба занята 429', () => new AskError('busy', 'busy', { status: 429, retryAfterSec: 5 }), true],
    ['блок «не по теме» 429', () => new AskError('offtopic_blocked', 'blocked', { status: 429, retryAfterSec: 60, strikes: 3 }), false],
    ['служба недоступна', () => new AskError('unavailable', 'down', { status: 503 }), true],
    ['посетитель остановил ответ', () => new AskError('aborted', 'ask aborted'), true],
    ['исключение', () => new Error('boom'), true],
  ])('хук: после подтверждённого хода %s снимает признак, следующий подтверждённый ход возвращает', async (_name, failure, canAskAgain) => {
    let step = 0
    const client: AskClient = {
      ask: async () => {
        step += 1
        if (step === 2) throw failure()
        return { sources: [], text: 'Загляните на сайт.', done: done({ profile: true }) }
      },
    }
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client }))
    await act(async () => {
      await result.current.ask('Куда поехать на выходные?')
    })
    expect(result.current.profileActive).toBe(true)
    await act(async () => {
      await result.current.ask('А что ещё посмотреть рядом?')
    })
    expect(result.current.profileActive).toBe(false)
    if (!canAskAgain) return
    await act(async () => {
      await result.current.ask('Куда съездить в Литве?')
    })
    expect(result.current.profileActive).toBe(true)
  })

  it('провайдер llamacpp личного контекста не получает', async () => {
    const generator: Generator = {
      generate: async () => ({ text: 'На сайте такого материала пока нет.', usage: { prompt_tokens: 1, completion_tokens: 1, ttft_ms: 1, tokens_per_s: 1 } }),
    }
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', generator }))
    await act(async () => {
      await result.current.ask('Куда поехать на выходные?')
    })
    expect(result.current.turns).toHaveLength(1)
    expect(result.current.profileActive).toBe(false)
  })
})
