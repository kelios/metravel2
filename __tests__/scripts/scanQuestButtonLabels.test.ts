// Скан обращений к кнопке, которой в мастере квеста нет (находка перевода
// 07.10.2026). Мастер шага показывает ровно две кнопки действия: «Далее» на
// шаге без проверки (`any`) и «Проверить ответ» на шаге с полем ввода
// (`components/quests/questWizardStepCard.tsx`). Опциональные привалы при
// этом звали нажать «Ответить» или «Дальше» — кнопки, которых игрок не найдёт,
// а переводчик (#2199) тащил несуществующую подпись в пять локалей.
//
// Эталон подписей скан берёт из i18n (`readQuestUiStrings`), а не из своего
// списка: это тот же источник, что у `ui_labels` задания перевода, поэтому
// «какие кнопки существуют» нигде не дублируется.
const { findUnknownButtonLabels, loadUiLabels, scanQuests } = require('@/scripts/scan-quest-button-labels')

const UI = {
  known: new Set(['далее', 'проверить ответ', 'пропустить', 'подсказка', 'начать квест']),
  next: 'Далее',
  check: 'Проверить ответ',
  start: 'Начать квест',
}

const step = (over: Record<string, unknown> = {}) => ({
  id: 1,
  step_id: 'x',
  task: '',
  story: '',
  hint: '',
  answer_pattern: { type: 'any', value: '' },
  ...over,
})

describe('findUnknownButtonLabels — кнопка, которой нет', () => {
  it('ловит шаблон привала «нажми «Ответить»» (gomel-palace 349 до правки)', () => {
    const hits = findUnknownButtonLabels('Точка по желанию: отдохни и перекуси, а потом нажми «Ответить» и продолжай маршрут.', UI)
    expect(hits).toHaveLength(1)
    expect(hits[0].label).toBe('Ответить')
  })

  it('ловит «жми «Дальше»» — подписи «Дальше» в мастере нет, есть «Далее»', () => {
    expect(findUnknownButtonLabels('Передохни, если хочется, и жми «Дальше».', UI)).toHaveLength(1)
  })

  it('молчит на настоящие подписи мастера, независимо от регистра и ё', () => {
    expect(findUnknownButtonLabels('Нажми «Начать квест» и иди к дворцу.', UI)).toHaveLength(0)
    expect(findUnknownButtonLabels('Постой минуту и нажми «Далее».', UI)).toHaveLength(0)
    expect(findUnknownButtonLabels('Введи число и нажми «проверить ответ».', UI)).toHaveLength(0)
  })

  it('молчит на цитату без приглашения нажать: надписи и названия — не кнопки', () => {
    expect(findUnknownButtonLabels('Найди табличку «Вход» и прочитай год над ней.', UI)).toHaveLength(0)
    expect(findUnknownButtonLabels('Выставка «Между водой и небом» висит на тросах.', UI)).toHaveLength(0)
  })

  it('глагол из соседнего предложения кнопку не создаёт', () => {
    expect(findUnknownButtonLabels('Нажми на звонок. Над дверью табличка «Аптека».', UI)).toHaveLength(0)
  })

  it('«выбери» — выбор предмета, а не кнопки (warsaw-kids / icecream)', () => {
    expect(findUnknownButtonLabels('Задание по желанию: выбери самый «детективный» вкус мороженого.', UI)).toHaveLength(0)
  })
})

describe('scanQuests — какую кнопку мастер показывает на самом деле', () => {
  it('на шаге без проверки ждёт «Далее», на шаге с полем ввода — «Проверить ответ»', () => {
    const quests = [
      {
        id: 15,
        quest_id: 'q',
        intro: step({ id: 173, step_id: 'intro', task: 'Нажми «Старт» и иди к дворцу.' }),
        steps: [
          step({ id: 349, step_id: 'spot', task: 'Отдохни, а потом нажми «Ответить».' }),
          step({
            id: 176,
            step_id: 'chapel',
            answer_pattern: { type: 'any_text', value: '{"min_length":3}' },
            hint: 'Опиши своими словами и нажми «Ответить».',
          }),
          step({ id: 174, step_id: 'palace', answer_pattern: { type: 'exact_any', value: '["а"]' }, task: 'Введи слово.' }),
        ],
      },
    ]
    const { findings, scannedSteps } = scanQuests(quests, UI)
    expect(scannedSteps).toBe(4)
    expect(findings.map((f: { step_db_id: number; field: string; expected: string }) => [f.step_db_id, f.field, f.expected])).toEqual([
      [173, 'task', 'Начать квест'],
      [349, 'task', 'Далее'],
      [176, 'hint', 'Проверить ответ'],
    ])
  })
})

describe('loadUiLabels — эталон из i18n, а не свой список', () => {
  it('знает обе кнопки мастера и «Пропустить»', () => {
    const ui = loadUiLabels()
    expect(ui.next).toBe('Далее')
    expect(ui.check).toBe('Проверить ответ')
    expect(ui.known.has('пропустить')).toBe(true)
    expect(ui.known.has('ответить')).toBe(false)
    expect(ui.known.has('дальше')).toBe(false)
  })
})
