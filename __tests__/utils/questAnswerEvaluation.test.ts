// #1276: единая точка оценки ответа. Вердикты обязаны совпадать с прежним
// поведением карточки шага один в один — до выноса проверка жила во вью
// (`questWizardStepCard`), и любое расхождение здесь = изменение правил
// прохождения квеста для игрока.
import {
  describeQuestAnswer,
  evaluateQuestAnswer,
  normalizeQuestAnswerInput,
} from '@/utils/questAnswerEvaluation'
import { buildAnswerChecker } from '@/utils/questAdapters'

const stepWith = (answerType: string, answerValue: string, inputType?: 'number' | 'text') => ({
  answer: buildAnswerChecker(answerType, answerValue),
  inputType,
})

describe('normalizeQuestAnswerInput', () => {
  it('числовой шаг принимает запятую как десятичный разделитель', () => {
    expect(normalizeQuestAnswerInput(' 50,5 ', 'number')).toBe('50.5')
  })

  it('текстовый шаг схлопывает пробелы и приводит к нижнему регистру', () => {
    expect(normalizeQuestAnswerInput('  Чёрный   Кот ', 'text')).toBe('чёрный кот')
  })

  it('пустой ввод остаётся пустым', () => {
    expect(normalizeQuestAnswerInput('   ')).toBe('')
  })
})

describe('evaluateQuestAnswer — вердикты по всем типам buildAnswerChecker', () => {
  // Пары «тип → принимаемый / отклоняемый ввод» повторяют контракты чекеров
  // из questAdapters. Тип `function` покрыт отдельно: он приходит из легаси.
  const cases: Array<{
    answerType: string
    answerValue: string
    inputType?: 'number' | 'text'
    accepted: string[]
    rejected: string[]
  }> = [
    { answerType: 'any', answerValue: '', accepted: ['что угодно', ''], rejected: [] },
    { answerType: 'exact', answerValue: 'дракон', accepted: ['Дракон', ' дракон '], rejected: ['кот'] },
    { answerType: 'exact', answerValue: '42', inputType: 'number', accepted: ['42'], rejected: ['43'] },
    {
      answerType: 'exact_any',
      answerValue: '["кот","собака"]',
      accepted: ['Кот', 'собака'],
      rejected: ['ёж'],
    },
    {
      answerType: 'range',
      answerValue: '{"min":10,"max":20}',
      inputType: 'number',
      accepted: ['10', '15', '20'],
      rejected: ['9', '21'],
    },
    {
      answerType: 'any_text',
      answerValue: '{"min_length":3}',
      accepted: ['вода', 'тут красиво'],
      rejected: ['ок'],
    },
    {
      answerType: 'any_number',
      answerValue: '',
      inputType: 'number',
      accepted: ['7', '2014'],
      rejected: ['семь'],
    },
    {
      answerType: 'approx',
      answerValue: '{"target":50.5,"tolerance":0.5}',
      inputType: 'number',
      accepted: ['50.5', '50,2'],
      rejected: ['52'],
    },
    { answerType: 'unknown_type', answerValue: '', accepted: [], rejected: ['что угодно'] },
  ]

  it.each(cases)('$answerType', ({ answerType, answerValue, inputType, accepted, rejected }) => {
    const step = stepWith(answerType, answerValue, inputType)

    for (const input of accepted) {
      expect(evaluateQuestAnswer(step, input).ok).toBe(true)
    }
    for (const input of rejected) {
      expect(evaluateQuestAnswer(step, input).ok).toBe(false)
    }
  })

  it('нормализация в результате — ровно тот ввод, что ушёл в чекер', () => {
    const step = stepWith('exact_any', '["кот"]')
    expect(evaluateQuestAnswer(step, '  КОТ  ').normalized).toBe('кот')
  })

  it('повреждённый JSON паттерна не проходит ответ (как и раньше)', () => {
    expect(evaluateQuestAnswer(stepWith('exact_any', 'not json'), 'кот').ok).toBe(false)
    expect(evaluateQuestAnswer(stepWith('range', 'bad'), '15').ok).toBe(false)
  })
})

describe('describeQuestAnswer — приватность и режим карточки', () => {
  it('свободные типы помечены isFreeText: сырой ввод не покидает устройство', () => {
    expect(describeQuestAnswer(stepWith('any_text', '{"min_length":3}')).isFreeText).toBe(true)
    expect(describeQuestAnswer(stepWith('any', '')).isFreeText).toBe(true)
  })

  it('закрытые типы ответа не помечены isFreeText', () => {
    for (const answerType of ['exact', 'exact_any', 'range', 'approx', 'any_number']) {
      const value =
        answerType === 'exact_any'
          ? '["кот"]'
          : answerType === 'range'
            ? '{"min":1,"max":2}'
            : answerType === 'approx'
              ? '{"target":1,"tolerance":1}'
              : '1'
      expect(describeQuestAnswer(stepWith(answerType, value)).isFreeText).toBe(false)
    }
  })

  it('порог свободного ответа доезжает до карточки', () => {
    expect(describeQuestAnswer(stepWith('any_text', '{"min_length":10}')).freeTextMinLength).toBe(10)
    expect(describeQuestAnswer(stepWith('exact', '2014')).freeTextMinLength).toBeUndefined()
  })

  it('шаг без проверяемого ответа проходится кнопкой, а не полем ввода', () => {
    expect(describeQuestAnswer(stepWith('any', '')).isAutoPass).toBe(true)
    expect(describeQuestAnswer(stepWith('exact', 'дракон')).isAutoPass).toBe(false)
  })

  it('чекер без типа (легаси) не считается закрытым ответом по ошибке', () => {
    const legacy = Object.assign((input: string) => input.length > 2, {})
    expect(describeQuestAnswer({ answer: legacy }).answerType).toBe('unknown')
    expect(describeQuestAnswer({ answer: legacy }).isFreeText).toBe(false)
  })
})
