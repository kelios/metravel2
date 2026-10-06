/**
 * #1072: раскрытие над клавиатурой — обязанность одного хука. Поле ответа он
 * доматывал только на фокусе, а блок «Неверный ответ» с «Подсказкой» и
 * «Пропустить», появившийся ПОСЛЕ отправки при открытой клавиатуре, оставался
 * под ней. Кейсы держат оба события раздельно: старый автоскролл на фокус и
 * новое раскрытие обратной связи, плюс гарантию «поле не уезжает за верх».
 */
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react-native'
import { Keyboard, Platform, useWindowDimensions, type ScrollView } from 'react-native'

import { useQuestKeyboardReveal } from '@/components/quests/hooks/useQuestKeyboardReveal'
import { QuestStepCard } from '@/components/quests/questWizardStepCard'
import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { getThemedColors } from '@/constants/designSystem'
import { buildAnswerChecker } from '@/utils/questAdapters'

jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  const insetValue = { top: 0, right: 0, bottom: 24, left: 0 }
  const mod = {
    __esModule: true,
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    SafeAreaInsetsContext: React.createContext(insetValue),
    useSafeAreaInsets: () => insetValue,
  }
  return { ...mod, default: mod }
})

jest.mock('@/utils/questAnswerTelemetry', () => ({
  recordQuestAnswerAttempt: jest.fn(),
}))

const NAV_BAR_INSET = 24
const KEYBOARD_HEIGHT = 300
const GAP = 16
const VIEWPORT_TOP = 80
const INPUT_HEIGHT = 48
const SETTLE_MS = 60

// Высота окна — та же, что видит хук (jest-сетап подменяет useWindowDimensions).
const windowHeight = renderHook(() => useWindowDimensions()).result.current.height
const visibleBottom = windowHeight - KEYBOARD_HEIGHT - NAV_BAR_INSET

const measurable = (y: number, height = 0) => ({
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, y, 300, height),
})

describe('useQuestKeyboardReveal (#1072)', () => {
  const originalOS = Platform.OS
  let listeners: Record<string, (e: any) => void>
  let scrollTo: jest.Mock

  const setup = (viewportBottom = windowHeight, bottomChromePx = 0) => {
    scrollTo = jest.fn()
    const scrollRef = {
      current: { scrollTo, ...measurable(VIEWPORT_TOP, viewportBottom - VIEWPORT_TOP) } as unknown as ScrollView,
    }
    return renderHook(() => useQuestKeyboardReveal(scrollRef, bottomChromePx))
  }

  const openKeyboard = async () => {
    // Таймер раскрытия ставит эффект на новый inset — он виден только после
    // коммита, поэтому часы двигаем вторым проходом.
    act(() => {
      listeners.keyboardDidShow?.({ endCoordinates: { height: KEYBOARD_HEIGHT } })
    })
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SETTLE_MS)
    })
  }

  beforeAll(() => {
    Platform.OS = 'android'
  })

  afterAll(() => {
    Platform.OS = originalOS
  })

  beforeEach(() => {
    jest.useFakeTimers()
    listeners = {}
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: (e: any) => void) => {
      listeners[event] = cb
      return { remove: jest.fn() }
    }) as any)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('на фокусе доматывает поле над клавиатурой, как и раньше', async () => {
    const { result } = setup()
    const inputY = visibleBottom + 100

    act(() => result.current.handleInputFocus(measurable(inputY, INPUT_HEIGHT)))
    await openKeyboard()

    expect(result.current.keyboardInset).toBe(KEYBOARD_HEIGHT + NAV_BAR_INSET)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 100 + INPUT_HEIGHT + GAP, animated: true })
  })

  it('после неверного ответа при открытой клавиатуре раскрывает блок ошибки и действия под полем', async () => {
    const { result } = setup()
    // Поле уже стоит над клавиатурой — фокусный автоскролл ничего не делает.
    const inputY = visibleBottom - GAP - INPUT_HEIGHT
    act(() => result.current.handleInputFocus(measurable(inputY, INPUT_HEIGHT)))
    await openKeyboard()
    expect(scrollTo).not.toHaveBeenCalled()

    // «Неверный ответ» + «Подсказка · Пропустить» — 120px под полем.
    const feedbackBottom = inputY + INPUT_HEIGHT + 120
    act(() => result.current.handleAnswerFeedback(measurable(feedbackBottom)))
    expect(scrollTo).not.toHaveBeenCalled()
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SETTLE_MS)
    })

    const delta = feedbackBottom + GAP - visibleBottom
    expect(scrollTo).toHaveBeenLastCalledWith({ y: delta, animated: true })
    // Низ обратной связи над клавиатурой, а поле осталось в области прокрутки.
    expect(feedbackBottom - delta + GAP).toBeLessThanOrEqual(visibleBottom)
    expect(inputY - delta).toBeGreaterThanOrEqual(VIEWPORT_TOP + GAP)
  })

  it('высокую обратную связь раскрывает ровно до упора поля в верх области прокрутки', async () => {
    const { result } = setup()
    const inputY = visibleBottom - GAP - INPUT_HEIGHT
    act(() => result.current.handleInputFocus(measurable(inputY, INPUT_HEIGHT)))
    await openKeyboard()

    // Раскрытая длинная подсказка: целиком над клавиатурой вместе с полем не влезает.
    act(() => result.current.handleAnswerFeedback(measurable(inputY + windowHeight)))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SETTLE_MS)
    })

    expect(scrollTo).toHaveBeenLastCalledWith({ y: inputY - VIEWPORT_TOP - GAP, animated: true })
  })

  it('при закрытой клавиатуре видимую обратную связь не трогает, а на следующем фокусе раскрывает поле вместе с ней', async () => {
    const { result } = setup()
    const inputY = visibleBottom - GAP - INPUT_HEIGHT
    const feedbackBottom = inputY + INPUT_HEIGHT + 120

    act(() => result.current.handleAnswerFeedback(measurable(feedbackBottom)))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SETTLE_MS)
    })
    expect(scrollTo).not.toHaveBeenCalled()

    act(() => result.current.handleInputFocus(measurable(inputY, INPUT_HEIGHT)))
    await openKeyboard()

    expect(scrollTo).toHaveBeenLastCalledWith({ y: feedbackBottom + GAP - visibleBottom, animated: true })
  })

  describe('без клавиатуры (#2271)', () => {
    // Desktop 1280×800: под областью прокрутки футер, её низ выше низа окна.
    const viewportBottom = windowHeight - 100
    const inputY = viewportBottom - 200

    const showFeedback = async (
      result: { current: ReturnType<typeof useQuestKeyboardReveal> },
      feedbackBottom: number,
      input: ReturnType<typeof measurable> | null = measurable(inputY, INPUT_HEIGHT),
    ) => {
      act(() => result.current.handleAnswerFeedback(measurable(feedbackBottom), input))
      await act(async () => {
        await jest.advanceTimersByTimeAsync(SETTLE_MS)
      })
    }

    it('вердикт под нижним краем области прокрутки доматывается ровно до него', async () => {
      const { result } = setup(viewportBottom)
      const feedbackBottom = viewportBottom + 35

      await showFeedback(result, feedbackBottom)

      expect(scrollTo).toHaveBeenCalledTimes(1)
      expect(scrollTo).toHaveBeenLastCalledWith({ y: 35 + GAP, animated: true })
    })

    it('видимый вердикт не дёргает экран', async () => {
      const { result } = setup(viewportBottom)

      await showFeedback(result, viewportBottom - GAP - 10)

      expect(scrollTo).not.toHaveBeenCalled()
    })

    it('фокус снят отправкой — вердикт раскрывается по последнему полю ответа', async () => {
      const { result } = setup(viewportBottom)
      act(() => result.current.handleInputFocus(measurable(inputY, INPUT_HEIGHT)))
      act(() => result.current.handleInputBlur())

      await showFeedback(result, viewportBottom + 60, null)

      expect(scrollTo).toHaveBeenLastCalledWith({ y: 60 + GAP, animated: true })
    })

    it('высокий вердикт не уводит поле за верх области прокрутки', async () => {
      const { result } = setup(viewportBottom)

      await showFeedback(result, viewportBottom + windowHeight)

      expect(scrollTo).toHaveBeenLastCalledWith({ y: inputY - VIEWPORT_TOP - GAP, animated: true })
    })

    it('на телефоне вердикт не прячется под нижней панелью поверх области прокрутки', async () => {
      // Android-замер: ScrollView до 2154 px, панель навигации поверх неё с 1982 px.
      const dock = 86
      const { result } = setup(windowHeight, dock)
      const feedbackBottom = windowHeight - dock + 20

      await showFeedback(result, feedbackBottom, measurable(windowHeight - dock - 300, INPUT_HEIGHT))

      expect(scrollTo).toHaveBeenLastCalledWith({ y: 20 + GAP, animated: true })
    })

    it('начальная обратная связь шага (из сохранённого прогресса) экран без клавиатуры не двигает', async () => {
      const { result } = setup(viewportBottom)

      act(() => result.current.handleAnswerFeedback(measurable(viewportBottom + 300), measurable(inputY, INPUT_HEIGHT), false))
      await act(async () => {
        await jest.advanceTimersByTimeAsync(SETTLE_MS)
      })

      expect(scrollTo).not.toHaveBeenCalled()
    })

    it('фокус на поле без клавиатуры ничего не доматывает', async () => {
      const { result } = setup(viewportBottom)
      act(() => result.current.handleInputFocus(measurable(viewportBottom + 50, INPUT_HEIGHT)))
      await act(async () => {
        await jest.advanceTimersByTimeAsync(SETTLE_MS)
      })

      expect(scrollTo).not.toHaveBeenCalled()
    })
  })

  it('без обратной связи (null) фокус раскрывает только поле', async () => {
    const { result } = setup()
    const inputY = visibleBottom - GAP - INPUT_HEIGHT

    act(() => result.current.handleAnswerFeedback(measurable(inputY + INPUT_HEIGHT + 120)))
    act(() => result.current.handleAnswerFeedback(null))
    act(() => result.current.handleInputFocus(measurable(inputY, INPUT_HEIGHT)))
    await openKeyboard()

    expect(scrollTo).not.toHaveBeenCalled()
  })
})

describe('QuestStepCard отдаёт обратную связь по ответу владельцу раскрытия (#1072)', () => {
  const colors = getThemedColors(false) as any
  const styles = createQuestWizardStyles(colors, true, 390)

  const renderCard = (overrides: Record<string, unknown> = {}) => {
    const props = {
      colors,
      styles,
      step: {
        id: 'clue-1',
        title: 'Улика 1',
        location: 'Брест',
        story: 'История',
        task: 'Какое слово на табличке?',
        hint: 'Смотрите над входом',
        lat: 52.09,
        lng: 23.68,
        inputType: 'text' as const,
        answer: buildAnswerChecker('exact', 'крепость'),
      },
      index: 1,
      attempts: 0,
      hintVisible: false,
      continueLabel: 'Дальше',
      onContinue: jest.fn(),
      onSubmit: jest.fn(),
      onWrongAttempt: jest.fn(),
      onToggleHint: jest.fn(),
      onSkip: jest.fn(),
      onSkipFarStep: jest.fn(),
      onSkipStuckStep: jest.fn(),
      questNumericId: 1072,
      showMap: false,
      onToggleMap: jest.fn(),
      showLocationControls: false,
      onAnswerFeedback: jest.fn(),
      ...overrides,
    } as any
    return { ...render(<QuestStepCard {...props} />), props }
  }

  afterEach(() => {
    cleanup()
  })

  it('без обратной связи сообщает null, после неверного ответа — метку её конца', () => {
    const screen = renderCard()
    const onAnswerFeedback = screen.props.onAnswerFeedback as jest.Mock
    expect(onAnswerFeedback).toHaveBeenLastCalledWith(null)

    fireEvent.changeText(screen.getByPlaceholderText(/Ваш ответ/), 'мост')
    fireEvent.press(screen.getByTestId('quest-step-check'))

    expect(screen.getByText('Неверный ответ')).toBeTruthy()
    expect(onAnswerFeedback.mock.calls.at(-1)?.[0]).toBeTruthy()
    // Поле ответа — для верхней границы раскрытия: фокус к этому моменту снят (#2271).
    expect(onAnswerFeedback.mock.calls.at(-1)?.[1]).toBeTruthy()
  })

  it('повторный отказ с тем же текстом ошибки снова отдаёт метку — игрок мог отмотать вверх', () => {
    const screen = renderCard()
    const onAnswerFeedback = screen.props.onAnswerFeedback as jest.Mock
    fireEvent.changeText(screen.getByPlaceholderText(/Ваш ответ/), 'мост')
    fireEvent.press(screen.getByTestId('quest-step-check'))
    screen.rerender(<QuestStepCard {...screen.props} attempts={1} />)
    onAnswerFeedback.mockClear()

    fireEvent.press(screen.getByTestId('quest-step-check'))
    screen.rerender(<QuestStepCard {...screen.props} attempts={2} />)

    expect(onAnswerFeedback).toHaveBeenCalledTimes(1)
    expect(onAnswerFeedback.mock.calls[0][0]).toBeTruthy()
  })

  it.each([
    ['раскрытой подсказкой', { hintVisible: true }],
    ['третьей попыткой', { attempts: 3 }],
  ])('вход на шаг с %s из прогресса — начальное состояние, не свежая обратная связь (#2271)', (_label, state) => {
    const screen = renderCard(state)
    const onAnswerFeedback = screen.props.onAnswerFeedback as jest.Mock

    expect(onAnswerFeedback).toHaveBeenCalledTimes(1)
    expect(onAnswerFeedback.mock.calls[0][0]).toBeTruthy()
    expect(onAnswerFeedback.mock.calls[0][2]).toBe(false)
  })

  it('раскрытая подсказка — тоже обратная связь: метка переезжает за неё', () => {
    const screen = renderCard()
    const onAnswerFeedback = screen.props.onAnswerFeedback as jest.Mock
    onAnswerFeedback.mockClear()

    screen.rerender(<QuestStepCard {...screen.props} hintVisible />)

    expect(onAnswerFeedback).toHaveBeenCalledTimes(1)
    expect(onAnswerFeedback.mock.calls[0][0]).toBeTruthy()
  })
})
