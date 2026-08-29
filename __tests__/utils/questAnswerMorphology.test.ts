/**
 * #1631: второй проход проверки ответа — словоформа эталона.
 *
 * Правило узкое сознательно. Оно обязано принимать `снаряд` при словаре
 * `снаряды` (шаг 136 `brest-fortress / holmskie` отклонил такой ответ девять
 * раз подряд у живого игрока) и обязано НЕ принимать другое слово, отличающееся
 * ровно окончанием. Проверка на реальных данных: все 113 исторических
 * отклонённых вводов из `quest_answer_attempt` остаются отклонёнными.
 */
import { isSameWordForm, matchesAnyWordForm } from '@/utils/questAnswerMorphology'

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
    // `рот` короче четырёх букв — до разбора такая пара не доходит.
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
