/**
 * #2905: мягкий старт первой обязательной точки. 55 % стартовавших уходили, не
 * ответив ни разу: строгий отказ на первой же загадке читался как «не для меня».
 * На карточке шага это означает: ссылка «Пропустить» становится «Открыть ответ и
 * идти дальше», отказ — спокойная заметка без красного и кнопка того же выхода,
 * а шаг-пауза тоже пишет попытку ответа в воронку.
 */
import { cleanup, fireEvent, render } from '@testing-library/react-native'

import { QuestStepCard, clearQuestCooldowns } from '@/components/quests/questWizardStepCard'
import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { getThemedColors } from '@/constants/designSystem'
import { translate as i18nT } from '@/i18n'
import { buildAnswerChecker } from '@/utils/questAdapters'

jest.mock('@/utils/questAnswerTelemetry', () => ({
  recordQuestAnswerAttempt: jest.fn(),
}))

const colors = getThemedColors(false) as any
const styles = createQuestWizardStyles(colors, true, 390)
const REVEAL = i18nT('quests:components.quests.questWizardStepCard.softStart.reveal')
const SKIP = i18nT('quests:components.quests.questWizardStepCard.propustit_0358f4b6')
const WRONG = i18nT('quests:components.quests.questWizardStepCard.nevernyy_otvet_22371740')
const SOFT_WRONG = i18nT('quests:components.quests.questWizardStepCard.softStart.wrong')

const baseStep = {
  id: 'step-1',
  title: 'Коложская церковь',
  location: 'Гродно',
  story: 'История',
  task: 'Из чего сложены стены?',
  hint: 'Ответ — на табличке у входа',
  lat: 53.68,
  lng: 23.82,
}

let questIdSeq = 3000

const renderCard = async (overrides: Record<string, unknown> = {}) => {
  const props = {
    colors,
    styles,
    step: { ...baseStep, answer: buildAnswerChecker('exact', 'камень') },
    index: 1,
    attempts: 0,
    hintVisible: true,
    continueLabel: 'Дальше',
    onContinue: jest.fn(),
    onSubmit: jest.fn(),
    onWrongAttempt: jest.fn(),
    onToggleHint: jest.fn(),
    onSkip: jest.fn(),
    onSkipFarStep: jest.fn(),
    onSkipStuckStep: jest.fn(),
    onAnswerAttempt: jest.fn(),
    onRevealAnswer: jest.fn(),
    softStart: true,
    questNumericId: (questIdSeq += 1),
    showMap: false,
    onToggleMap: jest.fn(),
    showLocationControls: false,
    ...overrides,
  } as any
  const screen = await render(<QuestStepCard {...props} />)
  return { screen, props }
}

afterEach(async () => {
  await cleanup()
  clearQuestCooldowns()
})

it('на мягком старте ссылка «Пропустить» — это «Открыть ответ и идти дальше»', async () => {
  const { screen, props } = await renderCard()
  expect(screen.queryByText(SKIP)).toBeNull()
  await fireEvent.press(screen.getByTestId('quest-step-soft-reveal-link'))
  expect(props.onRevealAnswer).toHaveBeenCalledTimes(1)
  expect(props.onSkip).not.toHaveBeenCalled()
})

it('неверный ответ встречает спокойный текст без красного и кнопку выхода', async () => {
  const { screen, props } = await renderCard()
  await fireEvent.changeText(screen.getByPlaceholderText(/Ваш ответ/), 'дерево')
  await fireEvent.press(screen.getByTestId('quest-step-check'))

  expect(props.onWrongAttempt).toHaveBeenCalledTimes(1)
  expect(props.onAnswerAttempt).toHaveBeenCalledWith({ isCorrect: false, attemptNo: 1 })
  expect(screen.getByTestId('quest-step-soft-error')).toBeTruthy()
  expect(screen.queryByText(SOFT_WRONG)).toBeTruthy()
  expect(screen.queryByText(WRONG)).toBeNull()

  // Визард увеличивает `attempts` — после отказа мягкий выход становится кнопкой.
  await screen.rerender(<QuestStepCard {...props} attempts={1} />)
  await fireEvent.press(screen.getByTestId('quest-step-soft-reveal'))
  expect(props.onRevealAnswer).toHaveBeenCalledTimes(1)
  expect(screen.queryByText(REVEAL)).toBeTruthy()
})

it('без мягкого старта карточка прежняя: «Пропустить» и красный «Неверный ответ»', async () => {
  const { screen, props } = await renderCard({ softStart: false, onRevealAnswer: undefined })
  expect(screen.queryByText(SKIP)).toBeTruthy()
  expect(screen.queryByTestId('quest-step-soft-reveal-link')).toBeNull()
  await fireEvent.changeText(screen.getByPlaceholderText(/Ваш ответ/), 'дерево')
  await fireEvent.press(screen.getByTestId('quest-step-check'))
  expect(screen.queryByText(WRONG)).toBeTruthy()
  expect(screen.queryByTestId('quest-step-soft-error')).toBeNull()
  expect(props.onWrongAttempt).toHaveBeenCalledTimes(1)
})

it('мягкий старт не действует на свободный ответ: открывать там нечего', async () => {
  const { screen } = await renderCard({
    step: { ...baseStep, answer: buildAnswerChecker('any_text', '{"min_length":10}') },
  })
  expect(screen.queryByTestId('quest-step-soft-reveal-link')).toBeNull()
  expect(screen.queryByText(SKIP)).toBeTruthy()
})

it('шаг-пауза («Далее») тоже пишет попытку ответа в воронку', async () => {
  const { screen, props } = await renderCard({
    softStart: false,
    step: { ...baseStep, hint: undefined, answer: buildAnswerChecker('any', '') },
  })
  await fireEvent.press(screen.getByLabelText(i18nT('quests:components.quests.questWizardStepCard.dalee_74add698')))
  expect(props.onAnswerAttempt).toHaveBeenCalledWith({ isCorrect: true, attemptNo: 1 })
  expect(props.onSubmit).toHaveBeenCalledWith('ok')
})
