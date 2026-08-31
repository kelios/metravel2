/**
 * #1631: второй проход проверки ответа — словоформа эталона.
 *
 * Правило узкое сознательно. Оно обязано принимать `снаряд` при словаре
 * `снаряды` (шаг 136 `brest-fortress / holmskie` отклонил такой ответ девять
 * раз подряд у живого игрока) и обязано НЕ принимать другое слово, отличающееся
 * ровно окончанием. Проверка на реальных данных: все 113 исторических
 * отклонённых вводов из `quest_answer_attempt` остаются отклонёнными.
 */
import {
  ENDINGS,
  MAX_ENDING_LENGTH,
  MIN_COMMON_PREFIX,
  MIN_WORD_LENGTH,
  isSameWordForm,
  matchesAnyWordForm,
} from '@/utils/questAnswerMorphology'
import { QUEST_MORPHOLOGY_BOUNDARY_PAIRS } from '@/__tests__/fixtures/questMorphologyBoundaryPairs'

describe('словоформа эталона', () => {
  it('принимает единственное число при словаре во множественном', () => {
    expect(isSameWordForm('снаряд', 'снаряды')).toBe(true)
    expect(isSameWordForm('пуля', 'пули')).toBe(true)
    expect(isSameWordForm('выстрел', 'выстрелы')).toBe(true)
  })

  it('принимает падежные формы', () => {
    expect(isSameWordForm('драконом', 'дракон')).toBe(true)
    expect(isSameWordForm('куполов', 'купол')).toBe(true)
    expect(isSameWordForm('богородицы', 'богородица')).toBe(true)
  })

  it('принимает белорусские формы', () => {
    expect(isSameWordForm('кальцо', 'кальца')).toBe(true)
    expect(isSameWordForm('калоны', 'калона')).toBe(true)
  })

  it('беглая гласная суффикса покрыта в обе стороны', () => {
    expect(isSameWordForm('щенка', 'щенок')).toBe(true)
    expect(isSameWordForm('петушка', 'петушок')).toBe(true)
    expect(isSameWordForm('отец', 'отца')).toBe(true)
  })

  it('беглая гласная внутри корня не покрывается — предел правила', () => {
    // `орел` / `орла`: выпадает гласная самого корня, а не суффикса `-ок`/`-ец`,
    // и общая часть `ор` короче порога. Такие формы перечисляет редактор.
    expect(isSameWordForm('орла', 'орел')).toBe(false)
  })

  it('не роднит разные слова с общим корнем длиннее хвоста', () => {
    expect(isSameWordForm('пулемет', 'пули')).toBe(false)
    expect(isSameWordForm('дракончик', 'дракон')).toBe(false)
  })

  it('не роднит короткие пары разных слов', () => {
    // `рот` короче четырёх букв — до разбора такая пара не доходит. Держит её
    // именно `MIN_WORD_LENGTH`, а не состав `ENDINGS`: хвосты «» и «а» оба
    // валидны (нулевое окончание в списке есть), поэтому на пороге 3 правило
    // склеило бы эти слова. Замер — в блоке «границы правила» ниже.
    expect(isSameWordForm('рот', 'рота')).toBe(false)
    expect(isSameWordForm('пол', 'пола')).toBe(false)
  })

  it('числительные сравниваются строго: количество против порядка', () => {
    expect(isSameWordForm('пятый', 'пять')).toBe(false)
    expect(isSameWordForm('одна', 'одно')).toBe(false)
  })

  it('числа не считаются словоформой друг друга', () => {
    expect(isSameWordForm('1941', '1945')).toBe(false)
    expect(isSameWordForm('33', '3')).toBe(false)
  })

  it('составные ответы сравниваются пословно при равном числе слов', () => {
    expect(isSameWordForm('от пуль', 'от пули')).toBe(true)
    expect(isSameWordForm('белого коня', 'белый конь')).toBe(true)
  })

  it('составные ответы с разным числом слов не сравниваются', () => {
    expect(isSameWordForm('белый орел', 'орел')).toBe(false)
    expect(isSameWordForm('от пуль и снарядов', 'от пуль')).toBe(false)
  })

  it('служебное слово в составном ответе должно совпасть буквально', () => {
    expect(isSameWordForm('из кирпича', 'от кирпича')).toBe(false)
  })

  it('хвост длиннее трёх букв окончанием не считается', () => {
    expect(isSameWordForm('короткий', 'коровник')).toBe(false)
  })

  it('matchesAnyWordForm ищет по всему словарю', () => {
    const dict = ['пули', 'обстрел', 'выстрелы']
    expect(matchesAnyWordForm('пуля', dict)).toBe(true)
    expect(matchesAnyWordForm('кирпич', dict)).toBe(false)
  })
})

/**
 * Границы правила. Живёт в файле самого модуля сознательно: приёмка 31.08.2026
 * опустила `MIN_COMMON_PREFIX` с 3 до 2 и получила зелёные 20 из 20 — потому
 * что единственный чувствительный к этому порогу страж лежал в файле, чьё имя
 * не попадает под `npx jest __tests__/utils/questAnswerMorphology`. Тот, кто
 * правит правило, запускает тесты правила; значит, охрана порогов обязана
 * падать здесь, а не только в соседнем файле.
 *
 * Глубокий разбор каждого порога с обеими сторонами пробы —
 * `questAnswerMorphologyBoundaries.test.ts`.
 */
describe('границы правила', () => {
  it('пороги закреплены на измеренных значениях', () => {
    // Проверка значения, а не поведения: она не доказывает правильность порога,
    // она обязывает того, кто его меняет, прочитать замер и обновить пары в
    // `questMorphologyBoundaryPairs`. Поведение проверяют тесты ниже.
    expect({ MIN_WORD_LENGTH, MIN_COMMON_PREFIX, MAX_ENDING_LENGTH }).toEqual({
      MIN_WORD_LENGTH: 4,
      MIN_COMMON_PREFIX: 3,
      MAX_ENDING_LENGTH: 3,
    })
  })

  it('ни одна пара-граница не принимается правилом', () => {
    // Красная при `MIN_COMMON_PREFIX` 3 → 2: у каждой пары общая часть ровно в
    // две буквы, а хвосты — валидные окончания.
    const accepted = QUEST_MORPHOLOGY_BOUNDARY_PAIRS.filter((pair) =>
      isSameWordForm(pair.input, pair.variant),
    )
    expect(accepted.map((pair) => `${pair.input} ~ ${pair.variant} (${pair.why})`)).toEqual([])
  })

  it('поднять MAX_ENDING_LENGTH в одиночку нечем: в списке нет окончаний длиннее порога', () => {
    // Отсюда следует, что отдельной пары-стража этот порог не требует: пока
    // самое длинное окончание короче порога, его рост ничего не добавляет.
    const longest = Math.max(...[...ENDINGS].map((ending) => ending.length))
    expect(longest).toBeLessThanOrEqual(MAX_ENDING_LENGTH)
  })
})
