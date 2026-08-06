// Единственная точка оценки ответа игрока в квесте.
//
// До #1276 нормализация и вызов чекера жили прямо в карточке шага
// (`questWizardStepCard`), поэтому телеметрия попыток не имела единого места
// съёма, а ветка провала теряла сам ввод. Здесь собран весь путь
// «сырой ввод → нормализация → вердикт», а вью получает только результат.
// Прямой вызов `.answer(...)` вне этого модуля запрещён guard'ом
// `scripts/guard-quest-answer-eval.js`.

import type { QuestAnswerChecker } from '@/components/quests/types'

/** Минимум от шага, нужный для оценки ответа. */
export type EvaluableQuestStep = {
  answer: QuestAnswerChecker
  inputType?: 'number' | 'text'
}

export type QuestAnswerEvaluation = {
  /** Вердикт чекера шага. */
  ok: boolean
  /** Нормализованный ввод — ровно тот, что ушёл в чекер. */
  normalized: string
  /** Тип `answer_pattern` шага (`unknown`, если чекер собран не адаптером). */
  answerType: string
  /** Свободная рефлексия: правильного ответа нет, проверяется только длина. */
  isFreeText: boolean
  /** Порог длины свободного ответа — карточка объясняет его игроку. */
  freeTextMinLength?: number
}

/**
 * Типы `answer_pattern` со свободным ответом. Совпадает с серверным правилом
 * приватности (#1275): у таких шагов сырой текст не хранится и не отправляется.
 */
const FREE_TEXT_ANSWER_TYPES = new Set(['any_text', 'any'])

const UNKNOWN_ANSWER_TYPE = 'unknown'

/**
 * Нормализация ввода перед проверкой. Числовой шаг принимает запятую как
 * десятичный разделитель, текстовый — приводится к нижнему регистру со
 * схлопыванием пробелов. Более глубокую нормализацию (пунктуация, «ё») делает
 * сам чекер в `questAdapters.normalize`.
 */
export function normalizeQuestAnswerInput(
  rawInput: string,
  inputType?: 'number' | 'text',
): string {
  const trimmed = String(rawInput ?? '').trim()
  if (!trimmed) return ''
  return inputType === 'number'
    ? trimmed.replace(',', '.').trim()
    : trimmed.toLowerCase().replace(/\s+/g, ' ').trim()
}

export type QuestAnswerDescription = {
  /** Тип `answer_pattern` шага. */
  answerType: string
  /** Свободная рефлексия: проверяется только длина ответа. */
  isFreeText: boolean
  /** Порог длины свободного ответа. */
  freeTextMinLength?: number
  /** Шаг без проверяемого ответа — карточка проходит его кнопкой «Далее». */
  isAutoPass: boolean
}

/**
 * Что карточка шага должна знать об ответе ДО ввода: рисовать поле или кнопку
 * «Далее» и как объяснить свободный ответ. Правила проверки остаются здесь.
 */
export function describeQuestAnswer(step: EvaluableQuestStep): QuestAnswerDescription {
  const checker = step.answer
  const freeTextMinLength = checker?._freeTextMinLength
  const answerType = checker?._answerType ?? (checker?._isAny ? 'any' : UNKNOWN_ANSWER_TYPE)

  return {
    answerType,
    isFreeText:
      FREE_TEXT_ANSWER_TYPES.has(answerType) ||
      checker?._isAny === true ||
      typeof freeTextMinLength === 'number',
    freeTextMinLength,
    // Легаси-чекеры из `function`-паттерна приходят без маркера `_isAny`,
    // поэтому распознаём и их тело — карточка иначе просит ответ там, где
    // подходит любой.
    isAutoPass:
      checker?._isAny === true ||
      (typeof checker === 'function' && /\(\)\s*=>\s*true/.test(checker.toString())),
  }
}

/** Оценивает ответ игрока на шаге квеста. Поведение для игрока не меняется. */
export function evaluateQuestAnswer(
  step: EvaluableQuestStep,
  rawInput: string,
): QuestAnswerEvaluation {
  const normalized = normalizeQuestAnswerInput(rawInput, step.inputType)
  const checker = step.answer
  const { answerType, isFreeText, freeTextMinLength } = describeQuestAnswer(step)

  return {
    ok: typeof checker === 'function' ? checker(normalized) : false,
    normalized,
    answerType,
    isFreeText,
    freeTextMinLength,
  }
}
