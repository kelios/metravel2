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

  const setup = () => {
    scrollTo = jest.fn()
    const scrollRef = {
      current: { scrollTo, ...measurable(VIEWPORT_TOP, windowHeight - VIEWPORT_TOP) } as unknown as ScrollView,
    }
    return renderHook(() => useQuestKeyboardReveal(scrollRef))
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

  it('при закрытой клавиатуре обратную связь не трогает, а на следующем фокусе раскрывает поле вместе с ней', async () => {
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

  it('раскрытая подсказка — тоже обратная связь: метка переезжает за неё', () => {
    const screen = renderCard()
    const onAnswerFeedback = screen.props.onAnswerFeedback as jest.Mock
    onAnswerFeedback.mockClear()

    screen.rerender(<QuestStepCard {...screen.props} hintVisible />)

    expect(onAnswerFeedback).toHaveBeenCalledTimes(1)
    expect(onAnswerFeedback.mock.calls[0][0]).toBeTruthy()
  })
})
