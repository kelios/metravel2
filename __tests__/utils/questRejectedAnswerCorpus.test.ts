/**
 * #1631: страж границ морфологического прохода.
 *
 * С 29.08.2026 проверка ответа двухпроходная: строгое сравнение, а следом
 * `utils/questAnswerMorphology.ts`, принимающий словоформу уже принимаемого
 * слова. Проход умеет только ДОБАВЛЯТЬ принимаемые формы, и ошибка такого
 * расширения тихая — игрок, чей неверный ответ засчитали, об этом не сообщит.
 * Юнит-тесты правила проверяют десяток пар; здесь проверяется весь корпус
 * реальных отказов, которые продукт вынес до появления прохода.
 *
 * Чувствительность стража проверена, а не предположена. Если отключить список
 * `ENDINGS` (считать окончанием любой хвост ≤3 букв), тест падает и называет
 * пять конкретных вводов — `бирюзованя`, `папороть кветка` и другие описки,
 * которые продукт отклонял. Предел честно измерен тем же способом: снижение
 * `MIN_COMMON_PREFIX` с 3 до 2 корпус НЕ ловит — на 83 записях такой пары
 * просто нет. Корпус сторожит состав окончаний, а пороги длины остаются на
 * юнит-тестах правила; чувствительность вырастет вместе с трафиком, когда
 * корпус пополнится.
 */
import {
  QUEST_REJECTED_ANSWER_CORPUS,
  type RejectedAnswerCase,
} from '@/__tests__/fixtures/questRejectedAnswerCorpus'
import { buildAnswerChecker } from '@/utils/questAdapters'

const describeCase = (item: RejectedAnswerCase): string =>
  `${item.quest}/${item.step} (шаг ${item.stepDbId}): «${item.input}» при словаре ${item.answerValue}`

describe('корпус отклонённых ответов остаётся отклонённым', () => {
  it('корпус не выродился: записи есть и покрывают закрытые типы ответа', () => {
    // Пустой или усохший корпус прошёл бы «зелёным», ничего не проверив.
    expect(QUEST_REJECTED_ANSWER_CORPUS.length).toBeGreaterThanOrEqual(80)
    expect(new Set(QUEST_REJECTED_ANSWER_CORPUS.map((item) => item.answerType)))
      .toEqual(new Set(['exact_any', 'range', 'exact']))
  })

  it('каждый словарь корпуса разбирается: чекер не должен быть «отклоняю всё»', () => {
    // `buildAnswerChecker` на битом `value` возвращает `() => false`. Тогда
    // основная проверка ниже прошла бы по ложной причине — не потому, что
    // правило держит границы, а потому, что шаг не принимает вообще ничего.
    const broken = QUEST_REJECTED_ANSWER_CORPUS.filter((item) => {
      if (item.answerType !== 'exact_any') return false
      try {
        return !Array.isArray(JSON.parse(item.answerValue))
      } catch {
        return true
      }
    })

    expect(broken.map(describeCase)).toEqual([])
  })

  it('ни один исторически отклонённый ответ не принимается двухпроходной проверкой', () => {
    const nowAccepted = QUEST_REJECTED_ANSWER_CORPUS.filter((item) =>
      buildAnswerChecker(item.answerType, item.answerValue)(item.input),
    )

    expect(nowAccepted.map(describeCase)).toEqual([])
  })

  it('корпус живой: те же вводы принимаются, если положить их в словарь', () => {
    // Контроль самого метода — иначе тест выше остался бы зелёным и на чекере,
    // который просто всегда отвечает «нет».
    const sample = QUEST_REJECTED_ANSWER_CORPUS.find((item) => item.answerType === 'exact_any')!
    const widened = JSON.stringify([...JSON.parse(sample.answerValue), sample.input])

    expect(buildAnswerChecker('exact_any', widened)(sample.input)).toBe(true)
  })
})
