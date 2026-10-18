import { act, fireEvent, render, screen } from '@testing-library/react-native'

import Route from '@/app/(tabs)/assistant'
// Прогрев: экран грузится React.lazy, а первая трансформация дерева в Jest
// длиннее таймаута findBy; статический импорт кладёт модуль в реестр заранее.
import '@/components/screens/assistant/AssistantScreen'

const mockChatState = {
  turns: [] as Array<Record<string, unknown>>,
  remaining: 20 as number | null,
  inputError: null as 'tooLong' | 'limit' | null,
  busy: false,
  generatorConfigured: true,
  ask: jest.fn(async () => undefined),
  stop: jest.fn(),
  retry: jest.fn(),
  clearInputError: jest.fn(),
}

jest.mock('@/app/[...missing].tsx', () => {
  const { Text } = require('react-native')
  return { NotFoundContent: () => <Text testID="not-found">not-found</Text> }
})
jest.mock('@/components/screens/assistant/useAssistantChat', () => ({
  useAssistantChat: () => mockChatState,
}))
jest.mock('@/components/layout/bottomChromeInset', () => ({
  useScrollBottomPadding: () => 16,
  asBottomDimension: (value: number) => value,
}))
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ width: 1280, isPhone: false, isLargePhone: false }),
}))

describe('/assistant route under feature flag (#2460)', () => {
  const originalFlag = process.env.EXPO_PUBLIC_AI_ASSISTANT
  afterEach(() => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = originalFlag
    mockChatState.turns = []
    mockChatState.remaining = 20
    mockChatState.inputError = null
    mockChatState.busy = false
    jest.clearAllMocks()
  })

  it('без флага отдаёт «страница не найдена» и не рендерит ассистента', async () => {
    delete process.env.EXPO_PUBLIC_AI_ASSISTANT
    render(<Route />)
    expect(screen.getByTestId('not-found')).toBeTruthy()
    expect(screen.queryByTestId('assistant-screen')).toBeNull()
  })

  it('с флагом показывает пустое состояние, примеры и композер; пример отправляется в чат', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    render(<Route />)
    expect(await screen.findByTestId('assistant-screen', {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.getByTestId('assistant-empty')).toBeTruthy()
    expect(screen.getByTestId('assistant-input')).toBeTruthy()
    expect(screen.getByTestId('assistant-composer-meta').props.children).toContain('20')

    const examples = screen.getAllByTestId('assistant-example')
    expect(examples).toHaveLength(3)
    await act(async () => {
      fireEvent.press(examples[1])
    })
    expect(mockChatState.ask).toHaveBeenCalledWith('Какие квесты есть в Минске?')
  })

  it('ввод и кнопка «Спросить»: пустой ввод заблокирован, непустой уходит в ask', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    render(<Route />)
    await screen.findByTestId('assistant-screen')
    const send = screen.getByTestId('assistant-send')
    expect(send.props.accessibilityState?.disabled).toBe(true)

    fireEvent.changeText(screen.getByTestId('assistant-input'), 'Куда поехать под Гродно?')
    await act(async () => {
      fireEvent.press(screen.getByTestId('assistant-send'))
    })
    expect(mockChatState.ask).toHaveBeenCalledWith('Куда поехать под Гродно?')
  })

  it('ответ с источниками, состояние «недоступен» с повтором и исчерпанный лимит', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    mockChatState.turns = [
      {
        id: 't1',
        question: 'Куда поехать?',
        answer: 'Под Гродно: https://metravel.by/travels/vyhodnye-pod-grodno',
        sources: [
          { type: 'travel', source_id: '1', title: 'Выходные под Гродно', url: 'https://metravel.by/travels/vyhodnye-pod-grodno', path: '/travels/vyhodnye-pod-grodno', snippet: '', score: 1 },
        ],
        status: 'done',
        removedLinks: 1,
        retryAfterSec: null,
        usage: null,
      },
      { id: 't2', question: 'Ещё?', answer: '', sources: [], status: 'unavailable', removedLinks: 0, retryAfterSec: null, usage: null },
    ]
    mockChatState.remaining = 0
    render(<Route />)
    await screen.findByTestId('assistant-screen')

    expect(screen.getByTestId('assistant-answer-text')).toBeTruthy()
    expect(screen.getByText(/Под Гродно/)).toBeTruthy()
    // Ссылка карточки в тексте ответа нажимаема и ведёт внутрь приложения.
    expect(screen.getAllByTestId('assistant-answer-link')).toHaveLength(1)
    expect(screen.getByTestId('assistant-links-removed')).toBeTruthy()
    const sourceRow = screen.getByTestId('assistant-source-travel-1')
    fireEvent.press(sourceRow)
    const { router } = jest.requireMock('expo-router')
    expect(router.push).toHaveBeenCalledWith('/travels/vyhodnye-pod-grodno')

    fireEvent.press(screen.getByTestId('assistant-retry'))
    expect(mockChatState.retry).toHaveBeenCalledWith('t2')

    expect(screen.getByTestId('assistant-send').props.accessibilityState?.disabled).toBe(true)
    expect(screen.getByTestId('assistant-composer-meta').props.children).not.toContain('20')
  })

  it('остановленный ответ не остаётся пустой карточкой: подпись и повтор', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    mockChatState.turns = [
      { id: 't3', question: 'Куда поехать?', answer: '', sources: [], status: 'aborted', removedLinks: 0, retryAfterSec: null, usage: null },
    ]
    render(<Route />)
    await screen.findByTestId('assistant-screen')

    expect(screen.getByText('Ответ остановлен.')).toBeTruthy()
    fireEvent.press(screen.getByTestId('assistant-retry'))
    expect(mockChatState.retry).toHaveBeenCalledWith('t3')
  })
})
