import { StyleSheet } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'

import Route from '@/app/(tabs)/assistant'
// Прогрев: экран грузится React.lazy, а первая трансформация дерева в Jest
// длиннее таймаута findBy; статический импорт кладёт модуль в реестр заранее.
import '@/components/screens/assistant/AssistantScreen'

const mockChatState = {
  turns: [] as Array<Record<string, unknown>>,
  sourceRef: null as Record<string, unknown> | null,
  sourceCard: null as Record<string, unknown> | null,
  remaining: 20 as number | null,
  inputError: null as 'tooLong' | 'limit' | null,
  busy: false,
  generatorConfigured: true,
  ask: jest.fn(async () => undefined),
  stop: jest.fn(),
  retry: jest.fn(),
  clearInputError: jest.fn(),
}

jest.mock('@/components/screens/NotFoundContent', () => {
  const { Text } = require('react-native')
  return { NotFoundContent: () => <Text testID="not-found">not-found</Text> }
})
const mockChatOptions: { last: Record<string, unknown> | null } = { last: null }
jest.mock('@/components/screens/assistant/useAssistantChat', () => ({
  useAssistantChat: (options: Record<string, unknown>) => {
    mockChatOptions.last = options
    return mockChatState
  },
}))
// #2897: параметр роута `?source=` — через общий мок expo-router из setup.ts.
const mockSearchParams: { current: Record<string, unknown> } = { current: {} }
const expoRouterMock = jest.requireMock('expo-router')
const originalUseLocalSearchParams = expoRouterMock.useLocalSearchParams
beforeAll(() => {
  expoRouterMock.useLocalSearchParams = () => mockSearchParams.current
})
afterAll(() => {
  expoRouterMock.useLocalSearchParams = originalUseLocalSearchParams
})
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
    mockChatState.sourceRef = null
    mockChatState.sourceCard = null
    mockSearchParams.current = {}
    mockChatOptions.last = null
    jest.clearAllMocks()
  })

  it('без флага отдаёт «страница не найдена» и не рендерит ассистента', async () => {
    delete process.env.EXPO_PUBLIC_AI_ASSISTANT
    await render(<Route />)
    expect(screen.getByTestId('not-found')).toBeTruthy()
    expect(screen.queryByTestId('assistant-screen')).toBeNull()
  })

  it('с флагом показывает пустое состояние, примеры и композер; пример отправляется в чат', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    await render(<Route />)
    expect(await screen.findByTestId('assistant-screen', {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.getByTestId('assistant-empty')).toBeTruthy()
    expect(screen.getByTestId('assistant-input')).toBeTruthy()
    expect(screen.getByTestId('assistant-composer-meta').props.children).toContain('20')

    const examples = screen.getAllByTestId('assistant-example')
    expect(examples).toHaveLength(3)
    // #2894: пилюля ограничена шириной ряда, иначе длинный пример на 375 px
    // обрезается с обеих сторон; подпись при этом переносится на 2 строки.
    for (const chip of examples) {
      const style = chip.props.style
      const flat = StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false, hovered: false }) : style)
      expect(flat).toEqual(expect.objectContaining({ maxWidth: '100%', flexShrink: 1 }))
    }
    await act(async () => {
      await fireEvent.press(examples[1])
    })
    expect(mockChatState.ask).toHaveBeenCalledWith('Какие квесты есть в Минске?')
  })

  it('ввод и кнопка «Спросить»: пустой ввод заблокирован, непустой уходит в ask', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    await render(<Route />)
    await screen.findByTestId('assistant-screen')
    const send = screen.getByTestId('assistant-send')
    expect(send.props.accessibilityState?.disabled).toBe(true)

    await fireEvent.changeText(screen.getByTestId('assistant-input'), 'Куда поехать под Гродно?')
    await act(async () => {
      await fireEvent.press(screen.getByTestId('assistant-send'))
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
    await render(<Route />)
    await screen.findByTestId('assistant-screen')

    expect(screen.getByTestId('assistant-answer-text')).toBeTruthy()
    expect(screen.getByText(/Под Гродно/)).toBeTruthy()
    // Ссылка карточки в тексте ответа нажимаема и ведёт внутрь приложения.
    expect(screen.getAllByTestId('assistant-answer-link')).toHaveLength(1)
    expect(screen.getByTestId('assistant-links-removed')).toBeTruthy()
    const sourceRow = screen.getByTestId('assistant-source-travel-1')
    await fireEvent.press(sourceRow)
    const { router } = jest.requireMock('expo-router')
    expect(router.push).toHaveBeenCalledWith('/travels/vyhodnye-pod-grodno')

    await fireEvent.press(screen.getByTestId('assistant-retry'))
    expect(mockChatState.retry).toHaveBeenCalledWith('t2')

    expect(screen.getByTestId('assistant-send').props.accessibilityState?.disabled).toBe(true)
    expect(screen.getByTestId('assistant-composer-meta').props.children).not.toContain('20')
  })

  it('#3291: запасной ответ стража — честная фраза вместо текста, источники на месте, повтор не предлагается', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    mockChatState.turns = [
      {
        id: 't4',
        question: 'Сколько стоит пройти квест?',
        answer: '',
        fallback: true,
        sources: [{ type: 'quest', source_id: '64', title: 'Квест по Софии: Сердика под ногами', url: 'https://metravel.by/quests/sofia/serdica', path: '/quests/sofia/serdica', snippet: '', score: 1 }],
        status: 'done',
        removedLinks: 0,
        retryAfterSec: null,
        usage: null,
      },
    ]
    await render(<Route />)
    await screen.findByTestId('assistant-screen')

    expect(screen.getByTestId('assistant-answer-text')).toBeTruthy()
    expect(screen.getByText('Точного ответа в найденных материалах нет — посмотрите источники ниже.')).toBeTruthy()
    expect(screen.getByTestId('assistant-source-quest-64')).toBeTruthy()
    expect(screen.queryByTestId('assistant-retry')).toBeNull()
    expect(screen.queryByText('Модель не дала ответа. Попробуйте переформулировать вопрос.')).toBeNull()
  })

  it('#3290: режим страницы — страница под «Источники», соседние материалы отдельной группой «Ещё по теме»', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    const source = (id: string, title: string, group?: string) => ({ type: 'travel', source_id: id, title, url: `https://metravel.by/travels/${id}`, path: `/travels/${id}`, snippet: '', score: 1, ...(group ? { group } : {}) })
    mockChatState.turns = [
      {
        id: 't5',
        question: 'Сколько дней занимает поездка?',
        answer: 'На ярмарки хватит двух дней.',
        sources: [source('816', 'Ярмарки Польши', 'page'), source('700', 'Тропа Мюллерталь', 'nearby'), source('701', 'Италия с собакой', 'nearby')],
        status: 'done',
        removedLinks: 0,
        retryAfterSec: null,
        usage: null,
      },
      // Обычный ход: группы нет, второй заголовок не появляется.
      { id: 't6', question: 'Куда поехать?', answer: 'Под Гродно.', sources: [source('1', 'Выходные под Гродно')], status: 'done', removedLinks: 0, retryAfterSec: null, usage: null },
    ]
    await render(<Route />)
    await screen.findByTestId('assistant-screen')

    expect(screen.getAllByText('Источники')).toHaveLength(2)
    expect(screen.getAllByTestId('assistant-sources-nearby')).toHaveLength(1)
    expect(screen.getByText('Ещё по теме')).toBeTruthy()
    for (const id of ['816', '700', '701', '1']) expect(screen.getByTestId(`assistant-source-travel-${id}`)).toBeTruthy()
    await fireEvent.press(screen.getByTestId('assistant-source-travel-700'))
    const { router } = jest.requireMock('expo-router')
    expect(router.push).toHaveBeenCalledWith('/travels/700')
  })

  it('остановленный ответ не остаётся пустой карточкой: подпись и повтор', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    mockChatState.turns = [
      { id: 't3', question: 'Куда поехать?', answer: '', sources: [], status: 'aborted', removedLinks: 0, retryAfterSec: null, usage: null },
    ]
    await render(<Route />)
    await screen.findByTestId('assistant-screen')

    expect(screen.getByText('Ответ остановлен.')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('assistant-retry'))
    expect(mockChatState.retry).toHaveBeenCalledWith('t3')
  })

  it('#2897: `?source=travel:816` уходит в чат как источник; без флага — та же «страница не найдена»', async () => {
    delete process.env.EXPO_PUBLIC_AI_ASSISTANT
    mockSearchParams.current = { source: 'travel:816' }
    const unflagged = await render(<Route />)
    expect(unflagged.getByTestId('not-found')).toBeTruthy()
    expect(mockChatOptions.last).toBeNull()
    await unflagged.unmount()

    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    mockChatState.sourceRef = { type: 'travel', id: 816 }
    mockChatState.sourceCard = { type: 'travel', source_id: '816', title: 'Ярмарки Польши', url: 'https://metravel.by/travels/816', path: '/travels/816', snippet: '', score: 1 }
    await render(<Route />)
    expect(await screen.findByTestId('assistant-screen', {}, { timeout: 5000 })).toBeTruthy()
    expect(mockChatOptions.last).toMatchObject({ locale: expect.any(String), source: { type: 'travel', id: 816 } })
    // Пустое состояние: заголовок страницы и примеры под контекст вместо общих.
    expect(screen.getByText(/Ярмарки Польши/)).toBeTruthy()
    const examples = screen.getAllByTestId('assistant-example')
    expect(examples).toHaveLength(3)
    await act(async () => {
      await fireEvent.press(examples[0])
    })
    expect(mockChatState.ask).toHaveBeenCalledWith('Сколько времени займёт?')
  }, 15000)

  it('#2897: мусорный `?source=` — обычный вход без источника', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    mockSearchParams.current = { source: 'book:1' }
    await render(<Route />)
    await screen.findByTestId('assistant-screen', {}, { timeout: 5000 })
    expect(mockChatOptions.last).toMatchObject({ source: null })
    await act(async () => {
      await fireEvent.press(screen.getAllByTestId('assistant-example')[1])
    })
    expect(mockChatState.ask).toHaveBeenCalledWith('Какие квесты есть в Минске?')
  }, 15000)
})
