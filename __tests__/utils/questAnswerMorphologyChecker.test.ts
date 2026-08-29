/**
 * #1631: чекер целиком. Проверяем на ИСХОДНОМ словаре шага 136
 * `brest-fortress / holmskie` — том самом, который 25.08.2026 девять раз подряд
 * отклонил верный ответ живого игрока. Словарь на проде с тех пор расширен
 * руками, но механизм обязан работать и без ручного расширения: иначе следующий
 * такой шаг снова найдёт игрок, а не проверка.
 */
import { buildAnswerChecker } from '@/utils/questAdapters'

const HOLMSKIE_BEFORE_PATCH = '["пули","пуль","снаряды","осколки","от пуль","обстрел","выстрелы","пулі"]'

describe('buildAnswerChecker — словоформа поверх строгого сравнения', () => {
  it('исходный словарь шага 136 теперь принимает отклонённые тогда ответы', () => {
    const check = buildAnswerChecker('exact_any', HOLMSKIE_BEFORE_PATCH)

    expect(check('снаряд')).toBe(true)
    expect(check('пуля')).toBe(true)
  })

  it('беглая гласная суффикса покрыта: `осколок` при словаре `осколки`', () => {
    // `осколок` и `осколки` расходятся не окончанием, а основой (`оскол-ок` /
    // `оскол-ки`), и сравнением хвостов такую пару не свести. Её закрывает
    // отдельный шаг правила — усечение выпадающей гласной суффикса `-ок`/`-ец`.
    expect(buildAnswerChecker('exact_any', HOLMSKIE_BEFORE_PATCH)('осколок')).toBe(true)
  })

  it('и по-прежнему отклоняет то, что игрок вводил неверно', () => {
    const check = buildAnswerChecker('exact_any', HOLMSKIE_BEFORE_PATCH)

    // Реальные попытки 4–9 того же прохождения: выбоины оставило не «оружие».
    expect(check('оружие')).toBe(false)
    expect(check('ружье')).toBe(false)
    expect(check('кирпич')).toBe(false)
  })

  it('exact тоже принимает словоформу эталона', () => {
    expect(buildAnswerChecker('exact', 'колонна')('колонны')).toBe(true)
    expect(buildAnswerChecker('exact', 'колонна')('арка')).toBe(false)
  })

  it('range и число остаются строгими: другое число — другой ответ', () => {
    const check = buildAnswerChecker('range', '{"min":3,"max":3}')

    expect(check('3')).toBe(true)
    // Реальные попытки шага 160 `mir-castle / church`.
    expect(check('12')).toBe(false)
    expect(check('13')).toBe(false)
  })

  it('пустой ввод не проходит по словоформе', () => {
    expect(buildAnswerChecker('exact_any', HOLMSKIE_BEFORE_PATCH)('')).toBe(false)
  })
})
