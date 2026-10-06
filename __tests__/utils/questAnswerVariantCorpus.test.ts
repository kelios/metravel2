// #2196: регрессия правил ответа по прод-корпусу.
//
// Фикстура — выгрузка всех шагов `exact`/`exact_any` опубликованных квестов.
// Каждый вариант каждого шага, который шаг принимает под правилом источника
// (`ru` — ровно поведение до #2196), обязан приниматься и в квесте на любом
// другом языке: ответ сверяется ещё и под правилом источника. Ломается этот
// союз — тест называет шаг и вариант.
import corpus from '@/__tests__/fixtures/questAnswerVariantCorpus.json'
import { SUPPORTED_LOCALES } from '@/i18n/config'
import { buildAnswerChecker } from '@/utils/questAdapters'
import { evaluateQuestAnswer } from '@/utils/questAnswerEvaluation'

type CorpusStep = [type: string, value: string]

const steps = corpus.steps as CorpusStep[]

const variantsOf = ([type, value]: CorpusStep): string[] =>
  type === 'exact' ? [value] : (JSON.parse(value) as unknown[]).map(String)

describe('прод-корпус ответов', () => {
  it('корпус не выродился', () => {
    expect(steps.length).toBeGreaterThanOrEqual(1200)
    expect(new Set(steps.map(([type]) => type))).toEqual(new Set(['exact', 'exact_any']))
  })

  it.each([...SUPPORTED_LOCALES, 'de'])(
    'каждый вариант, принятый под ru, принимается в квесте на «%s»',
    (locale) => {
      let checked = 0
      let acceptedBySource = 0
      const lost: string[] = []

      for (const step of steps) {
        const answer = buildAnswerChecker(step[0], step[1])
        for (const variant of variantsOf(step)) {
          checked += 1
          const before = evaluateQuestAnswer({ answer, inputType: 'text' }, variant).ok
          if (!before) continue
          acceptedBySource += 1
          const after = evaluateQuestAnswer({ answer, inputType: 'text', contentLocale: locale }, variant).ok
          if (!after) lost.push(`${step[0]} ${step[1]} → «${variant}»`)
        }
      }

      // Число проверенных вариантов видно в выводе: не меньше корпуса.
      console.info(`[${locale}] вариантов проверено: ${checked}, принято под ru: ${acceptedBySource}`)
      expect(checked).toBeGreaterThanOrEqual(11000)
      expect(lost).toEqual([])
    },
  )
})
