/**
 * Регрессия на два дефекта одного экрана, найденные разбором телеметрии
 * `quest_answer_attempt` (прохождения 285/286 от 15.08.2026):
 *
 * - #1428: между неверными попытками не было паузы, поэтому узкий диапазон
 *   ответов подбирался перебором (`2 → 3 → 1 → 4` за 11 секунд), а зависший
 *   игрок бесконечно тыкал наугад (6 отказов за 77 секунд, затем уход).
 * - #1430: единственным сигналом игроку было предложение подсказки уже после
 *   первой ошибки; кнопка «Пропустить шаг» не читалась как выход, и на сломанном
 *   шаге игрок не пользовался ни тем, ни другим.
 *
 * Тесты держат обе гарантии, включая локализацию приглашения пропустить шаг:
 * хардкод RU-строки уронит параметризованный кейс.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native'

import { QuestStepCard, clearQuestCooldowns } from '@/components/quests/questWizardStepCard'
import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { getThemedColors } from '@/constants/designSystem'
import { i18n, translate as i18nT } from '@/i18n'
import { buildAnswerChecker } from '@/utils/questAdapters'

jest.mock('@/utils/questAnswerTelemetry', () => ({
  recordQuestAnswerAttempt: jest.fn(),
}))

const colors = getThemedColors(false) as any
const styles = createQuestWizardStyles(colors, true, 390)

const baseStep = {
  id: 'step-1',
  title: 'Успенская церковь',
  location: 'Браслав',
  story: 'История',
  task: 'Сколько ярусов у колокольни?',
  hint: 'Посчитайте снизу вверх',
  lat: 55.64,
  lng: 27.04,
  inputType: 'number' as const,
}

// Паузы живут в модульной карте `stepCooldowns` и переживают unmount — это и
// есть их смысл. Чтобы состояние не перетекало между кейсами, каждый рендер по
// умолчанию получает собственный квест; тесты, которым нужен ОДИН и тот же шаг
// (перемонтирование), передают `questNumericId` явно.
let questIdSeq = 1000

const renderCard = (overrides: Record<string, unknown> = {}) => {
  const props = {
    colors,
    styles,
    step: { ...baseStep, answer: buildAnswerChecker('range', '{"min":2,"max":5}') },
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
    questNumericId: (questIdSeq += 1),
    showMap: false,
    onToggleMap: jest.fn(),
    showLocationControls: false,
    ...overrides,
  } as any

  return { ...render(<QuestStepCard {...props} />), props }
}

const submitAnswer = (screen: ReturnType<typeof render>, answer: string) => {
  fireEvent.changeText(screen.getByPlaceholderText(/Ваш ответ/), answer)
  fireEvent.press(screen.getByTestId('quest-step-check'))
}

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('ru')
})

describe('#1428 — пауза между неверными попытками', () => {
  // Пауза измеряется таймером, поэтому только здесь время под контролем теста.
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  // Типы `answer_pattern`, где ответ добывается перебором, а не решением.
  const bruteForceableCases: Array<[string, string, string]> = [
    ['range', '{"min":2,"max":5}', '9'],
    ['exact', '1896', '1900'],
    ['exact_any', '["синий","голубой"]', 'зелёный'],
    ['approx', '{"target":30,"tolerance":2}', '99'],
  ]

  it.each(bruteForceableCases)(
    'после неверного ответа на шаге %s кнопка проверки уходит на паузу',
    (answerType, answerValue, wrongAnswer) => {
      const screen = renderCard({
        step: { ...baseStep, answer: buildAnswerChecker(answerType, answerValue) },
      })

      submitAnswer(screen, wrongAnswer)

      expect(screen.getByTestId('quest-step-cooldown-note')).toBeTruthy()
      expect(screen.getByTestId('quest-step-check').props.accessibilityState.disabled).toBe(true)
    },
  )

  it('вторая попытка не отправляется, пока пауза не истекла', () => {
    const screen = renderCard()
    const { props } = screen

    submitAnswer(screen, '9')
    expect(props.onWrongAttempt).toHaveBeenCalledTimes(1)

    // Игрок пытается продолжить перебор сразу же — и кнопкой, и с клавиатуры.
    fireEvent.press(screen.getByTestId('quest-step-check'))
    fireEvent(screen.getByPlaceholderText(/Ваш ответ/), 'submitEditing')
    expect(props.onWrongAttempt).toHaveBeenCalledTimes(1)

    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(screen.queryByTestId('quest-step-cooldown-note')).toBeNull()
    fireEvent.press(screen.getByTestId('quest-step-check'))
    expect(props.onWrongAttempt).toHaveBeenCalledTimes(2)
  })

  it('верный ответ с первой попытки уходит без паузы', () => {
    const screen = renderCard()

    submitAnswer(screen, '3')

    expect(screen.queryByTestId('quest-step-cooldown-note')).toBeNull()
    expect(screen.props.onWrongAttempt).not.toHaveBeenCalled()
  })

  it('пауза переживает уход на соседний шаг и возврат — обхода в два тапа нет', () => {
    // Полоса шагов на том же экране пускает на любой открытый шаг, а карточка
    // при этом перемонтируется: раньше дедлайн жил только в её стейте.
    const remountStep = {
      ...baseStep,
      id: 'step-remount',
      answer: buildAnswerChecker('range', '{"min":2,"max":5}'),
    }
    const first = renderCard({ questNumericId: 777, step: remountStep })
    submitAnswer(first, '9')
    expect(first.getByTestId('quest-step-cooldown-note')).toBeTruthy()

    first.unmount()
    const returned = renderCard({ questNumericId: 777, step: remountStep })

    expect(returned.getByTestId('quest-step-cooldown-note')).toBeTruthy()
    fireEvent.changeText(returned.getByPlaceholderText(/Ваш ответ/), '8')
    fireEvent.press(returned.getByTestId('quest-step-check'))
    expect(returned.props.onWrongAttempt).not.toHaveBeenCalled()
  })

  it('сброс прогресса уносит и паузу: переигровка начинается с первой ступени', () => {
    // Лестница 3 → 5 → 8 с считается по неверным попыткам, и без сброса
    // переигровка в той же вкладке встречала бы игрока унаследованной ступенью.
    const replayStep = {
      ...baseStep,
      id: 'step-replay',
      answer: buildAnswerChecker('range', '{"min":2,"max":5}'),
    }
    const before = renderCard({ questNumericId: 555, step: replayStep })
    submitAnswer(before, '9')
    expect(before.getByTestId('quest-step-cooldown-note')).toBeTruthy()
    before.unmount()

    clearQuestCooldowns(555)
    const replay = renderCard({ questNumericId: 555, step: replayStep })

    expect(replay.queryByTestId('quest-step-cooldown-note')).toBeNull()
  })

  it('шаг с ответом «любое число» паузы не получает: подбирать там нечего', () => {
    const screen = renderCard({
      step: { ...baseStep, id: 'step-any-number', answer: buildAnswerChecker('any_number', '') },
    })

    submitAnswer(screen, 'три')

    expect(screen.queryByTestId('quest-step-cooldown-note')).toBeNull()
  })

  it('свободный ответ паузу не получает: подбирать там нечего', () => {
    const screen = renderCard({
      step: {
        ...baseStep,
        inputType: 'text' as const,
        answer: buildAnswerChecker('any_text', '{"min_length":20}'),
      },
    })

    fireEvent.changeText(screen.getByPlaceholderText(/Опиши своими словами/), 'коротко')
    fireEvent.press(screen.getByTestId('quest-step-check'))

    expect(screen.queryByTestId('quest-step-cooldown-note')).toBeNull()
  })
})

describe('#1430 — выход вперёд после серии неудач', () => {
  it('после трёх неверных попыток подряд подсказка уступает место приглашению пропустить шаг', () => {
    const before = renderCard({ attempts: 2 })
    expect(before.queryByTestId('quest-step-skip-prompt')).toBeNull()

    const after = renderCard({ attempts: 3 })
    expect(after.getByTestId('quest-step-skip-prompt')).toBeTruthy()
  })

  it('приглашение уводит со шага так, чтобы квест остался завершаемым', () => {
    // Обычная ссылка «Пропустить» продолжает маршрут, но оставляет шаг в гейте
    // финала. Приглашение обещает «идти дальше», поэтому оно идёт через
    // `onSkipStuckStep` — тот же механизм, что снимает с гейта далёкую точку.
    const screen = renderCard({ attempts: 3 })

    fireEvent.press(screen.getByTestId('quest-step-skip-prompt'))

    expect(screen.props.onSkipStuckStep).toHaveBeenCalledTimes(1)
    expect(screen.props.onSkip).not.toHaveBeenCalled()
  })

  it('пока показано приглашение, серой ссылки «Пропустить» рядом нет', () => {
    const withPrompt = renderCard({ attempts: 3 })

    expect(withPrompt.queryByText('Пропустить')).toBeNull()
  })

  it('свободный ответ приглашения не получает: «слишком коротко» — не тупик', () => {
    const screen = renderCard({
      attempts: 3,
      step: {
        ...baseStep,
        id: 'step-free-text',
        inputType: 'text' as const,
        answer: buildAnswerChecker('any_text', '{"min_length":20}'),
      },
    })

    expect(screen.queryByTestId('quest-step-skip-prompt')).toBeNull()
  })

  it.each(['ru', 'be', 'uk', 'pl', 'en'])(
    'текст приглашения приходит из @/i18n на локали %s',
    async (locale) => {
      await act(async () => {
        await i18n.changeLanguage(locale)
      })

      const screen = renderCard({ attempts: 3 })
      const expected = i18nT('quests:components.quests.questWizardStepCard.skipPrompt')

      // Незалокализованный хардкод дал бы одинаковый текст на всех пяти языках.
      expect(expected).not.toContain('questWizardStepCard')
      expect(screen.getByText(expected)).toBeTruthy()
    },
  )
})
