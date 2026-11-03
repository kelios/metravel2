// #2963: скан сквозной нити квеста. Партии «проверяемых ответов» (`0a92351a8`,
// `3aed14bb2`) прошли `quest:gates` зелёными, хотя разрезали объекты на пары
// шагов («Та же табличка») и заменили рассказ точки фразами о самом задании.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const {
  BASELINE_CONTRACT_VERSION,
  BASELINE_PATH,
  SAME_POINT_M,
  findingKeys,
  inspectQuest,
  parseArgs,
  stemOf,
} = require('@/scripts/scan-quest-story-thread')
const { buildCommands } = require('@/scripts/quest-gates')
const { loadBaseline } = require('@/scripts/lib/scanBaseline')
const { UsageError } = require('@/scripts/lib/cli-contract')

const INTRO =
  'Мельник Ян спрятал в старом посёлке у реки свою мельничную печать. ' +
  'Чтобы найти её, пройди по следам мельника: от плотины к амбару, от амбара к часовне. ' +
  'На каждой остановке мельник оставил знак, и вместе знаки складываются в адрес тайника.'

type Step = Record<string, unknown>

const step = (index: number, over: Step = {}): Step => ({
  step_id: `${index}-stop`,
  title: `Знак мельника ${index}`,
  location: `Улица Мельничная, ${index}`,
  story:
    `Здесь мельник Ян оставил свой ${index}-й знак. Плотину у этой точки ставили в ${1800 + index} году, ` +
    'и вода до сих пор крутит колесо у старого амбара.',
  task: 'Сколько лопастей у колеса?',
  answer_pattern: { type: 'exact_any', value: JSON.stringify(['восемь', '8']) },
  lat: 53.9 + index / 500,
  lng: 27.5,
  ...over,
})

const quest = (steps: Step[]) => ({
  quest_id: 'demo-story-thread',
  title: 'Печать мельника Яна',
  city: { name: 'Демо' },
  intro: { step_id: 'intro', title: 'Тайник мельника', story: INTRO },
  steps,
})

const normal = () => [1, 2, 3, 4].map((index) => step(index))
const kinds = (result: { findings: { step_id: string; kind: string }[] }) =>
  result.findings.map((f) => `${f.step_id}:${f.kind}`)

describe('scan-quest-story-thread — фикстуры', () => {
  it('норма: один объект на шаг, story связаны с нитью — находок нет', () => {
    expect(inspectQuest(quest(normal())).findings).toEqual([])
  })

  it('дубль объекта подряд: «Та же табличка» и координаты в 0 м краснеют', () => {
    const steps = normal()
    steps.splice(1, 0, step(1, {
      step_id: '1a-same-plate',
      title: 'Второе слово мельника',
      location: 'Та же табличка на улице Мельничной, 1',
      lat: steps[0].lat,
      lng: steps[0].lng,
    }))
    expect(kinds(inspectQuest(quest(steps)))).toEqual(['1a-same-plate:same-object'])
  })

  it('story без нити: ни слова с интро и названием, ни мостика к соседям — краснеет', () => {
    const steps = normal()
    steps[2] = step(3, {
      story:
        'Торговый центр открылся в две тысячи пятом году. На первом этаже работают аптека, ' +
        'химчистка и салон мобильной связи, парковка рассчитана на триста автомобилей.',
    })
    expect(kinds(inspectQuest(quest(steps)))).toEqual(['3-stop:no-thread'])
  })

  it('шаблонная «вода» из правок-источников краснеет', () => {
    const steps = normal()
    steps[1] = step(2, {
      story: `${steps[1].story} Здесь не нужно искать скрытую табличку или заходить внутрь.`,
    })
    expect(kinds(inspectQuest(quest(steps)))).toEqual(['2-stop:filler'])
  })
})

describe('scan-quest-story-thread — границы эвристик', () => {
  it('кофейня «по желанию» у точки не дубль: пара считается по обязательным шагам', () => {
    const steps = normal()
    steps.splice(1, 0, step(9, {
      step_id: 'cafe',
      title: 'Кофейня у плотины (по желанию)',
      answer_pattern: { type: 'any' },
      lat: steps[0].lat,
      lng: steps[0].lng,
    }))
    expect(inspectQuest(quest(steps)).findings).toEqual([])
  })

  it('заявленная роль авторитетнее заголовка, как у quest-geocheck', () => {
    const steps = normal()
    steps.splice(1, 0, step(9, {
      step_id: 'declared-required',
      title: 'Кофейня у плотины (по желанию)',
      point_role: 'required',
      lat: steps[0].lat,
      lng: steps[0].lng,
    }))
    expect(kinds(inspectQuest(quest(steps)))).toEqual(['declared-required:same-object'])
  })

  it('соседние отдельные объекты дальше порога координат и с общим адресом в 50 м — не дубль', () => {
    const steps = normal()
    steps[1] = step(2, { location: steps[0].location, lat: Number(steps[0].lat) + 0.00045, lng: steps[0].lng })
    expect(SAME_POINT_M).toBeLessThan(10)
    expect(inspectQuest(quest(steps)).findings).toEqual([])
  })

  it('«один и тот же знак» в task — повтор внутри объекта, не отсылка к прошлому шагу', () => {
    const steps = normal()
    steps[1] = step(2, { task: 'На двери повторяется один и тот же знак. Какой?', lat: Number(steps[0].lat) + 0.0002 })
    expect(inspectQuest(quest(steps)).findings).toEqual([])
  })

  it('основа слова снимает окончание и беглую гласную', () => {
    expect(stemOf('осколок')).toBe(stemOf('осколков'))
    expect(stemOf('мельника')).toBe(stemOf('мельник'))
  })
})

describe('scan-quest-story-thread — правки-источники и baseline', () => {
  it('старый «Тракторный посёлок» (0a92351a8) краснеет дублями объекта', () => {
    // Снимок шагов-пар из версии 0a92351a8: та же табличка трактора, тот же торец.
    const steps = [
      step(1, { step_id: '1-prohodnaya', lat: 53.8893635, lng: 27.6181877 }),
      step(2, { step_id: '1a-tractor-name', location: 'Та же табличка на постаменте в сквере «70 лет МТЗ»', lat: 53.8893635, lng: 27.6181877 }),
      step(3, { step_id: '3-koshevogo', lat: 53.8870304, lng: 27.6100916 }),
      step(4, { step_id: '3a-board-city', location: 'Тот же торец дома по улице Олега Кошевого, 5', lat: 53.8870304, lng: 27.6100916 }),
    ]
    expect(kinds(inspectQuest(quest(steps)))).toEqual(['1a-tractor-name:same-object', '3a-board-city:same-object'])
  })

  it('baseline держит контракт и не содержит переработанных минских квестов (#2958–#2961)', () => {
    const baseline = loadBaseline(path.join(process.cwd(), BASELINE_PATH), BASELINE_CONTRACT_VERSION)
    const files = Object.keys(baseline.known)
    for (const reworked of ['minsk-traktorny', 'minsk-cmok', 'minsk-cipher', 'minsk-loshitsa']) {
      expect(files).not.toContain(`scripts/${reworked}-quest-data.js`)
    }
    for (const [file, keys] of Object.entries(baseline.known) as [string, string[]][]) {
      expect(fs.existsSync(path.join(process.cwd(), file))).toBe(true)
      for (const key of keys) expect(key).toMatch(/^[a-z0-9-]+\|[^|]+\|(same-object|no-thread|filler)$/)
    }
    expect(findingKeys({ quest_id: 'q', step_id: 's', kind: 'filler' })).toEqual(['q|s|filler'])
  })

  it('quest-gates гоняет скан с тем же baseline', () => {
    const src = '.codex-temp/quests-plan/x/x-quest-data.js'
    const cmd = buildCommands(src).find((c: { name: string }) => c.name === 'scan-quest-story-thread')
    expect(cmd.args).toEqual(['scripts/scan-quest-story-thread.js', `--source=${src}`, `--baseline=${BASELINE_PATH}`])
  })

  it('CLI: опечатка во флаге — UsageError', () => {
    expect(() => parseArgs(['--sorce=x.js'])).toThrow(UsageError)
  })

  it('CLI: --quest-id без --source — неверный вызов, а не молчаливый скан корпуса', () => {
    const run = spawnSync(process.execPath, ['scripts/scan-quest-story-thread.js', '--quest-id=x'], { encoding: 'utf8' })
    expect(run.status).toBe(2)
    expect(run.stderr).toContain('--quest-id работает только с --source')
  })
})
