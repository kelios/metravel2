// Задание переводчику и проверяющему (#2199): две находки перевода 07.10.2026.
//
// 1. Кнопки мастера («Далее», «Проверить ответ», «Пропустить», «Подсказка»,
//    «Начать квест») идут в `ui_labels` всегда, а не только когда источник
//    процитировал их дословно: переводчики искали подписи по i18n сами.
// 2. У шага без списка вариантов (`range`, `approx`, `any_text`, …) задание
//    проверяющему несло пустой `accepted_answers`, и достижимость числа по
//    переведённому заданию оценить было нельзя (lida-castle 153,
//    luxembourg-melusina 1483, krakow-dragon 111).
import { GATE_ID, INTRO_ID, TOWER_ID, makeBundle, makePolishTranslation } from './questTranslate.fixtures'

const {
  WIZARD_UI_LABEL_KEYS,
  artifactPaths,
  buildReviewTask,
  buildTask,
  collectUiLabels,
  describeAnswerRule,
  planSteps,
  sourceAnswerRule,
  sourceFromBundle,
} = require('@/scripts/lib/questTranslation/task')

const sourceWithoutQuotes = () => {
  const source = sourceFromBundle(makeBundle())
  for (const step of source.steps) step.task = step.task.replace(/«[^»]*»/g, 'кнопку')
  return source
}

describe('collectUiLabels — кнопки мастера всегда в задании', () => {
  it('без единой цитаты в источнике задание всё равно знает «Далее» и «Проверить ответ»', () => {
    const labels = collectUiLabels({ source: sourceWithoutQuotes(), sourceLocale: 'ru', locale: 'pl' })
    const sources = labels.map((label: { source: string }) => label.source)
    expect(sources).toEqual(expect.arrayContaining(['Начать квест', 'Далее', 'Проверить ответ', 'Пропустить', 'Подсказка']))
    for (const label of labels) {
      expect(typeof label.target).toBe('string')
      expect(label.target.trim()).not.toBe('')
    }
  })

  it('процитированная подпись не дублирует кнопку мастера', () => {
    const labels = collectUiLabels({ source: sourceFromBundle(makeBundle()), sourceLocale: 'ru', locale: 'pl' })
    const starts = labels.filter((label: { source: string }) => label.source === 'Начать квест')
    expect(starts).toHaveLength(1)
    expect(labels[0].source).toBe('Начать квест')
  })

  it('ключи кнопок мастера существуют в каждой локали приложения', () => {
    for (const locale of ['ru', 'be', 'uk', 'pl', 'en']) {
      const labels = collectUiLabels({ source: sourceWithoutQuotes(), sourceLocale: 'ru', locale })
      expect(labels).toHaveLength(WIZARD_UI_LABEL_KEYS.length)
    }
  })
})

describe('sourceAnswerRule / describeAnswerRule — правило ответа без списка', () => {
  it('range: границы из JSON-строки и из объекта читаются одинаково', () => {
    expect(sourceAnswerRule({ type: 'range', value: '{"min":6,"max":8}' })).toEqual({ type: 'range', min: 6, max: 8 })
    expect(sourceAnswerRule({ type: 'range', value: { min: 3, max: 3 } })).toEqual({ type: 'range', min: 3, max: 3 })
  })

  it('exact/exact_any правила не имеют — у них список', () => {
    expect(sourceAnswerRule({ type: 'exact', value: '1' })).toBeNull()
    expect(sourceAnswerRule({ type: 'exact_any', value: '["а"]' })).toBeNull()
  })

  it('строка для проверяющего по каждому типу', () => {
    expect(describeAnswerRule({ type: 'range', min: 6, max: 8 })).toBe('число от 6 до 8')
    expect(describeAnswerRule({ type: 'range', min: 3, max: 3 })).toBe('число 3')
    expect(describeAnswerRule(sourceAnswerRule({ type: 'approx', value: '{"target":82,"tolerance":5}' }))).toBe('число около 82 (±5)')
    expect(describeAnswerRule(sourceAnswerRule({ type: 'any_text', value: '{"min_length":4}' }))).toBe('любой текст не короче 4 символов')
    expect(describeAnswerRule(sourceAnswerRule({ type: 'any_number', value: '' }))).toBe('любое число')
    expect(describeAnswerRule(sourceAnswerRule({ type: 'any', value: '' }))).toBe('любой ответ (шаг без проверки)')
    expect(describeAnswerRule(sourceAnswerRule({ type: 'range', value: 'не json' }))).toBe('число в диапазоне (границы в источнике не заданы)')
    expect(describeAnswerRule(null)).toBeNull()
  })
})

describe('buildReviewTask — accepted_answers у счётного шага', () => {
  it('range-шаг получает правило строкой, exact_any — объединение вариантов', () => {
    const bundle = makeBundle()
    const source = sourceFromBundle(bundle)
    const paths = artifactPaths('.codex-temp/quest-translations-test', 'pl', bundle.quest_id)
    const task = buildTask({
      bundle,
      locale: 'pl',
      sourceLocale: 'ru',
      plan: planSteps({ source, statusRow: null, existing: null, force: false }),
      existing: null,
      glossary: [],
      acceptedNames: [],
      paths,
      notes: [],
    })
    const review = buildReviewTask({ task, translation: makePolishTranslation(), paths })
    const byId = new Map(review.steps.map((step: { step_id: number }) => [step.step_id, step]))
    expect(byId.get(TOWER_ID)).toMatchObject({
      answer_type: 'range',
      accepted_answers: ['число от 6 до 8'],
      answer_rule: { type: 'range', min: 6, max: 8 },
    })
    expect(byId.get(INTRO_ID)).toMatchObject({ accepted_answers: ['любой ответ (шаг без проверки)'] })
    const gate = byId.get(GATE_ID)
    expect(gate.answer_rule).toBeNull()
    expect(gate.accepted_answers).toEqual(expect.arrayContaining(['orzeł', 'орел']))
  })
})
