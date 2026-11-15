/**
 * #3298: план по дням на экране ассистента — вопрос с намерением «план» уходит в `/ai/plan`, ответ рисуется
 * днями с карточками материалов, «Открыть в планировщике» несёт план черновиком в форму новой поездки.
 * Отказ плана не показывается: тот же вопрос идёт обычным путём `/ai/ask`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native'

const mockPush = jest.fn()
const mockAnalytics = jest.fn()
const authState = { isAuthenticated: true, authReady: true }

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  router: { push: jest.fn() },
}))
jest.mock('@/context/AuthContext', () => ({ useAuth: () => authState }))
jest.mock('@/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ loginHref: '/login', requireAuth: jest.fn(), authReady: true }) }))
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: (...args: unknown[]) => mockAnalytics(...args) }))
jest.mock('@/components/travel/TravelStatusButton', () => {
  const { Text } = require('react-native')
  return function TravelStatusButton(props: { travelId: string }) {
    return <Text testID={`travel-status-${props.travelId}`}>status</Text>
  }
})
jest.mock('@/components/ui/CardRail', () => {
  const { View } = require('react-native')
  return function CardRail({ children, testID }: { children: unknown; testID?: string }) {
    return <View testID={testID}>{children}</View>
  }
})
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

import type { AskClient, AskResult } from '@/api/aiAssist/askProvider'
import type { Generator } from '@/api/aiAssist/generator'
import type { AiTripPlan, PlanClient } from '@/api/aiAssist/planProvider'
import { ASSISTANT_PLAN_OPEN_EVENT, planDescription, planToDraft } from '@/components/screens/assistant/AssistantPlanDays'
import { AssistantTurnCard } from '@/components/screens/assistant/AssistantTurnCard'
import { createAssistantStyles } from '@/components/screens/assistant/assistantStyles'
import { buildHistoryFromTurns, useAssistantChat, type AssistantTurn } from '@/components/screens/assistant/useAssistantChat'
import { useThemedColors } from '@/hooks/useTheme'
import { loadTripPlanDraft } from '@/utils/tripPlanDraft'

const QUESTION = 'Спланируй два дня в Кракове'

const PLAN: AiTripPlan = {
  days: [
    {
      items: [
        { type: 'travel', source_id: '568', title: 'Краков: путеводитель по местам', url: 'https://metravel.by/travels/krakow', path: '/travels/krakow', hours: 4, lat: 50.061, lng: 19.937, cover: null, city: null, country: 'Польша' },
        { type: 'quest', source_id: '246', title: 'Квест по Кракову: чёрные дамы', url: 'https://metravel.by/quests/246', path: '/quests/246', hours: 2, lat: 50.054, lng: 19.935, cover: null, city: 'Краков', country: 'Польша' },
      ],
    },
    { items: [{ type: 'travel', source_id: '636', title: 'Что посмотреть вокруг Кракова', url: 'https://metravel.by/travels/around', path: '/travels/around', hours: 4.5, lat: 50.2, lng: 19.83, cover: null, city: null, country: 'Польша' }] },
  ],
  daysRequested: 2,
  assembled: 'code',
}

const done: AskResult['done'] = { status: 'done', reason: null, strikes: null, strikesToBlock: null, removedLinks: 0, fallback: false, relabeled: 0, droppedDescriptions: 0, ungroundedNumbers: 0, usage: null, remaining: 19, turnId: null }
const askClient = () => {
  const ask = jest.fn(async (): Promise<AskResult> => ({ sources: [], text: 'Загляните на сайт.', done }))
  return { ask, client: { ask } as AskClient }
}
const planClient = (outcome: Awaited<ReturnType<PlanClient['plan']>>) => {
  const plan = jest.fn(async () => outcome)
  return { plan, client: { plan } as PlanClient }
}

describe('хук ассистента: намерение «план» (#3298)', () => {
  it('вопрос о плане уходит в /ai/plan: ход получает план, обычный путь не вызывается', async () => {
    const asks = askClient()
    const plans = planClient({ plan: PLAN, aborted: false })
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: asks.client, planClient: plans.client }))
    await act(async () => {
      await result.current.ask(QUESTION)
    })
    expect(plans.plan).toHaveBeenCalledWith(expect.objectContaining({ question: QUESTION, locale: 'ru' }))
    expect(asks.ask).not.toHaveBeenCalled()
    const turn = result.current.turns[0]
    expect(turn).toMatchObject({ status: 'done', answer: '', sources: [], plan: PLAN })
    // Ход с планом в историю диалога не идёт.
    expect(buildHistoryFromTurns(result.current.turns)).toEqual([])
    expect(result.current.busy).toBe(false)
  })

  it.each([
    ['плана нет (404, 422, 503, сеть)', { plan: null, aborted: false }],
  ])('%s — тот же вопрос идёт обычным путём, без ошибки на экране', async (_name, outcome) => {
    const asks = askClient()
    const plans = planClient(outcome)
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: asks.client, planClient: plans.client }))
    await act(async () => {
      await result.current.ask(QUESTION)
    })
    expect(plans.plan).toHaveBeenCalledTimes(1)
    expect(asks.ask).toHaveBeenCalledWith(expect.objectContaining({ question: QUESTION }))
    expect(result.current.turns).toHaveLength(1)
    expect(result.current.turns[0]).toMatchObject({ status: 'done', answer: 'Загляните на сайт.' })
    expect(result.current.turns[0].plan).toBeUndefined()
  })

  it('отмена посетителем: ход остановлен, вопрос за него не повторяется', async () => {
    const asks = askClient()
    const plans = planClient({ plan: null, aborted: true })
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: asks.client, planClient: plans.client }))
    await act(async () => {
      await result.current.ask(QUESTION)
    })
    expect(asks.ask).not.toHaveBeenCalled()
    expect(result.current.turns[0].status).toBe('aborted')
  })

  it('обычный вопрос, вопрос со страницы материала и клиент без плана идут в /ai/ask', async () => {
    const asks = askClient()
    const plans = planClient({ plan: PLAN, aborted: false })
    const plain = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: asks.client, planClient: plans.client }))
    await act(async () => {
      await plain.result.current.ask('Сколько дней нужно на Краков?')
    })
    await act(async () => {
      await plain.result.current.ask('Куда съездить на выходные в Беларуси?')
    })
    expect(plans.plan).not.toHaveBeenCalled()
    expect(asks.ask).toHaveBeenCalledTimes(2)

    const page = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: asks.client, planClient: plans.client, source: { type: 'travel', id: 816 }, loadSource: async () => null }))
    await act(async () => {
      await page.result.current.ask(QUESTION)
    })
    expect(plans.plan).not.toHaveBeenCalled()

    const noPlan = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: asks.client }))
    await act(async () => {
      await noPlan.result.current.ask(QUESTION)
    })
    expect(noPlan.result.current.turns[0].plan).toBeUndefined()
    expect(asks.ask).toHaveBeenCalledTimes(4)
  })

  it('провайдер llamacpp плана не получает', async () => {
    const plans = planClient({ plan: PLAN, aborted: false })
    const generator: Generator = { generate: async () => ({ text: 'На сайте такого материала пока нет.', usage: { prompt_tokens: 1, completion_tokens: 1, ttft_ms: 1, tokens_per_s: 1 } }) }
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', generator, planClient: plans.client }))
    await act(async () => {
      await result.current.ask(QUESTION)
    })
    expect(plans.plan).not.toHaveBeenCalled()
    expect(result.current.turns[0].plan).toBeUndefined()
  })
})

const turnOf = (plan: AiTripPlan): AssistantTurn => ({ id: 't1', question: QUESTION, answer: '', sources: [], status: 'done', removedLinks: 0, retryAfterSec: null, usage: null, offTopicStrikes: null, plan })

const renderTurn = async (plan: AiTripPlan, narrow = false) => {
  const hook = await renderHook(() => useThemedColors())
  const colors = hook.result.current
  const styles = createAssistantStyles(colors, narrow)
  return render(<AssistantTurnCard turn={turnOf(plan)} styles={styles} colors={colors} busy={false} onRetry={jest.fn()} onOpenCatalog={jest.fn()} narrow={narrow} />)
}

describe('карточка хода: план по дням (#3298)', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    authState.isAuthenticated = true
    authState.authReady = true
    await AsyncStorage.clear()
  })

  it('дни с карточками материалов и временем; пустого ответа и повтора нет', async () => {
    await renderTurn(PLAN)
    expect(screen.getByTestId('assistant-plan')).toBeTruthy()
    expect(screen.getByText('День 1')).toBeTruthy()
    expect(screen.getByText('День 2')).toBeTruthy()
    // Сумма часов дня и время на материал.
    expect(screen.getByText('около 6 ч')).toBeTruthy()
    expect(screen.getByText('около 4,5 ч')).toBeTruthy()
    expect(screen.getByTestId('assistant-plan-cards-1')).toBeTruthy()
    expect(screen.getByTestId('assistant-source-card-travel-568')).toBeTruthy()
    expect(screen.getByTestId('assistant-source-card-quest-246')).toBeTruthy()
    expect(screen.getByTestId('assistant-source-card-travel-636')).toBeTruthy()
    expect(screen.getAllByText('≈ 4 ч').length).toBeGreaterThan(0)
    expect(screen.getAllByText('≈ 2 ч').length).toBeGreaterThan(0)
    // Действия карточек #3295 на месте.
    expect(screen.getByTestId('assistant-source-map-quest-246')).toBeTruthy()
    expect(screen.queryByTestId('assistant-retry')).toBeNull()
    expect(screen.queryByTestId('assistant-plan-short')).toBeNull()
  })

  it('материалов меньше, чем дней: фраза о том, на сколько дней их хватает', async () => {
    await renderTurn({ ...PLAN, daysRequested: 5 })
    expect(screen.getByTestId('assistant-plan-short').props.children).toBe('Материалов сайта хватает на 2 дня')
    // Текста модели в блоке нет: все подписи — из локали.
    expect(screen.queryByTestId('assistant-plan-note')).toBeNull()
  })

  it('«Открыть в планировщике»: план кладётся черновиком в хранилище, в адресе формы — только идентификатор', async () => {
    await renderTurn(PLAN)
    await fireEvent.press(screen.getByTestId('assistant-plan-open'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    const href = String(mockPush.mock.calls[0][0])
    expect(href).toMatch(/^\/trips\/plan\/create\?source=plan&draft=[a-z0-9]+$/)
    const draft = (await loadTripPlanDraft(new URLSearchParams(href.split('?')[1]).get('draft')))!
    expect(draft).toMatchObject({ title: QUESTION, days: 2 })
    expect(draft.points.map((point) => [point.title, point.day, point.type, point.sourceId])).toEqual([
      ['Краков: путеводитель по местам', 1, 'travel', 568],
      ['Квест по Кракову: чёрные дамы', 1, 'quest', 246],
      ['Что посмотреть вокруг Кракова', 2, 'travel', 636],
    ])
    expect(draft.description).toBe(
      `${QUESTION}\nДень 1: «Краков: путеводитель по местам» (≈ 4 ч), «Квест по Кракову: чёрные дамы» (≈ 2 ч)\nДень 2: «Что посмотреть вокруг Кракова» (≈ 4,5 ч)`,
    )
    expect(mockAnalytics).toHaveBeenCalledWith(ASSISTANT_PLAN_OPEN_EVENT, { days: 2, items: 3, assembled: 'code' })
  })

  it('двойное нажатие в одном кадре открывает форму один раз', async () => {
    await renderTurn(PLAN)
    const button = screen.getByTestId('assistant-plan-open')
    await act(async () => {
      void fireEvent.press(button)
      void fireEvent.press(button)
    })
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    expect(mockAnalytics).toHaveBeenCalledTimes(1)
  })

  it('гость: вход с намерением «организовать поездку» и возвратом в форму с тем же черновиком', async () => {
    authState.isAuthenticated = false
    await renderTurn(PLAN)
    await fireEvent.press(screen.getByTestId('assistant-plan-open'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    const href = String(mockPush.mock.calls[0][0])
    expect(href).toContain('intent=plan-trip')
    const redirect = new URLSearchParams(href.split('?')[1]).get('redirect')!
    expect(redirect).toMatch(/^\/trips\/plan\/create\?source=plan&draft=[a-z0-9]+$/)
    // Черновик ждёт гостя в хранилище.
    expect(await loadTripPlanDraft(new URLSearchParams(redirect.split('?')[1]).get('draft'))).not.toBeNull()
  })

  it('материал без координат точкой маршрута не становится, а в описании по дням остаётся', () => {
    const plan: AiTripPlan = { ...PLAN, days: [{ items: [{ ...PLAN.days[0].items[0], lat: null, lng: null }, PLAN.days[0].items[1]] }] }
    const draft = planToDraft(QUESTION, plan)
    expect(draft.points.map((point) => point.title)).toEqual(['Квест по Кракову: чёрные дамы'])
    expect(planDescription(QUESTION, plan)).toContain('«Краков: путеводитель по местам»')
    expect(draft.days).toBe(1)
  })
})
