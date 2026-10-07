// #2199: структурные проверки перевода квеста.
//
// Перевод квеста ломается не так, как перевод статьи: потерянный вариант ответа
// делает точку непроходимой, переведённая надпись с таблички — нечитаемой на
// месте. Эти проверки — единственный барьер между агентом-переводчиком и
// публикацией 880 пар «квест + язык», поэтому каждое правило закреплено отказом
// с названием шага и правила, а не только зелёным прогоном.
import { GATE_ID, INTRO_ID, TOWER_ID, makeBundle, makePolishTranslation } from './questTranslate.fixtures'

const fs = require('fs')
const path = require('path')

const {
  SCRIPT_RULES,
  mergeReview,
  missingNumbers,
  runStructuralChecks,
  reviewDigest,
  uploadBlockers,
} = require('@/scripts/lib/questTranslation/checks')
const { getQuestContentLocales } = require('@/scripts/lib/questTranslation/locales')
const {
  GUIDE_PATH,
  ROOT,
  artifactPaths,
  buildReviewTask,
  buildTask,
  collectUiLabels,
  loadGlossary,
  planSteps,
  sourceFromBundle,
} = require('@/scripts/lib/questTranslation/task')

type Check = { step_id: number | null; check: string; ok: boolean; detail: string }

const makeTask = (locale = 'pl', overrides: Record<string, unknown> = {}) => {
  const bundle = makeBundle()
  const source = sourceFromBundle(bundle)
  return {
    ...buildTask({
      bundle,
      locale,
      sourceLocale: 'ru',
      plan: planSteps({ source, statusRow: null, existing: null, force: false }),
      existing: null,
      glossary: [],
      acceptedNames: [],
      paths: artifactPaths('.codex-temp/quest-translations', locale, bundle.quest_id),
      notes: [],
    }),
    ...overrides,
  }
}

const failures = (checks: Check[]) => checks.filter((entry) => !entry.ok)
const run = (translation: unknown, task = makeTask()) => runStructuralChecks({ task, translation }) as Check[]
const stepOf = (translation: ReturnType<typeof makePolishTranslation>, id: number) =>
  translation.steps.find((step) => step.step_id === id)!

describe('источник из бандла', () => {
  it('вступление идёт первым шагом, шаги — по order, id шага — числовой', () => {
    const source = sourceFromBundle(makeBundle())
    expect(source.steps.map((step: { step_id: number }) => step.step_id)).toEqual([INTRO_ID, GATE_ID, TOWER_ID])
    expect(source.steps[1]).toMatchObject({ slug: '1-gate', answer_type: 'exact_any', answer_variants: ['орел', 'орёл', 'eagle', 'orzel'] })
    expect(source.steps[2]).toMatchObject({ answer_type: 'range', answer_variants: [], poi_ticket_price: 'обычный 35 PLN, льготный 25 PLN' })
  })
})

describe('runStructuralChecks', () => {
  it('корректный перевод проходит все проверки и покрывает каждый шаг', () => {
    const checks = run(makePolishTranslation())
    expect(failures(checks)).toEqual([])
    for (const id of [INTRO_ID, GATE_ID, TOWER_ID]) {
      expect(checks.filter((entry) => entry.step_id === id).map((entry) => entry.check)).toEqual(
        expect.arrayContaining(['required_fields', 'script', 'numbers', 'urls', 'length_ratio', 'answer_variants', 'hint_leak']),
      )
    }
  })

  it('пропущенный шаг — отказ с названием шага', () => {
    const translation = makePolishTranslation()
    translation.steps = translation.steps.filter((step) => step.step_id !== GATE_ID)
    const failed = failures(run(translation))
    expect(failed).toHaveLength(1)
    expect(failed[0]).toMatchObject({ step_id: null, check: 'step_set' })
    expect(failed[0].detail).toContain('«1-gate»')
    expect(failed[0].detail).toContain('Флорианские ворота')
  })

  it('лишний и повторяющийся step_id — отказ', () => {
    const translation = makePolishTranslation()
    translation.steps.push({ ...stepOf(translation, GATE_ID) }, { ...stepOf(translation, GATE_ID), step_id: 999 })
    const detail = failures(run(translation)).find((entry) => entry.check === 'step_set')!.detail
    expect(detail).toContain(`step_id ${GATE_ID} повторяется`)
    expect(detail).toContain('лишний step_id 999')
  })

  it('текстовый slug вместо числового id и чужой origin — отказ формы, остальные проверки не идут', () => {
    const translation = makePolishTranslation() as any
    translation.steps[0].step_id = 'intro'
    translation.steps[1].origin = 'agent'
    const checks = run(translation)
    expect(checks).toHaveLength(1)
    expect(checks[0]).toMatchObject({ check: 'shape', ok: false })
    expect(checks[0].detail).toContain('steps[0].step_id')
    expect(checks[0].detail).toContain('steps[1].origin')
  })

  it('кириллица в польском тексте — отказ с названием шага и правила; цитата в «ёлочках» допустима', () => {
    const translation = makePolishTranslation()
    stepOf(translation, GATE_ID).story += ' Рядом стоит Барбакан.'
    const failed = failures(run(translation))
    expect(failed).toEqual([expect.objectContaining({ step_id: GATE_ID, check: 'script' })])
    expect(failed[0].detail).toContain('«1-gate»')
    expect(failed[0].detail).toContain('кириллица')

    const quoted = makePolishTranslation()
    stepOf(quoted, GATE_ID).task += ' Na tablicy jest napis «Здесь жил мастер».'
    expect(failures(run(quoted))).toEqual([])
  })

  it.each([
    ['uk', 'Старе місто — это центр'],
    ['uk', 'Вежа стоїть з ъ'],
    ['be', 'Стары горад и вежа'],
    ['be', 'Плошча Рынак, шчасце і щит'],
  ])('буквы чужого алфавита в %s: «%s» — отказ', (locale, text) => {
    const translation = makePolishTranslation()
    translation.title = text
    const failed = failures(run(translation, makeTask(locale)))
    expect(failed.some((entry) => entry.check === 'script' && entry.step_id === null)).toBe(true)
  })

  it('потерянное число, год и ссылка — отказы по своему шагу', () => {
    const translation = makePolishTranslation()
    stepOf(translation, GATE_ID).story = stepOf(translation, GATE_ID).story.replace('1882', 'XIX')
    stepOf(translation, TOWER_ID).story = stepOf(translation, TOWER_ID).story.replace('https://example.org/tower', 'example.org')
    stepOf(translation, TOWER_ID).poi_ticket_price = 'normalny 35 PLN, ulgowy'
    const failed = failures(run(translation))
    expect(failed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ step_id: GATE_ID, check: 'numbers', detail: expect.stringContaining('1882') }),
        expect.objectContaining({ step_id: TOWER_ID, check: 'numbers', detail: expect.stringContaining('25') }),
        expect.objectContaining({ step_id: TOWER_ID, check: 'urls', detail: expect.stringContaining('https://example.org/tower') }),
      ]),
    )
  })

  it('число сверяется по значению, а не по записи разрядов и десятилетий', () => {
    expect(missingNumbers('1 200 ступеней', '1,200 steps')).toEqual([])
    expect(missingNumbers('1 200 ступеней', '1200 steps')).toEqual([])
    expect(missingNumbers('в 40-е годы', 'in the 1940s')).toEqual([])
    expect(missingNumbers('12.05.2023 в 10:00', '12 May 2023 at 10:00')).toEqual(['05'])
    expect(missingNumbers('82 метра', 'eighty-two metres')).toEqual(['82'])
  })

  it('перевод вдвое короче или вдвое длиннее источника — отказ', () => {
    const short = makePolishTranslation()
    stepOf(short, GATE_ID).story = 'Brama z 1300 i 1882 roku.'
    stepOf(short, GATE_ID).task = 'Jaki to ptak?'
    expect(failures(run(short))).toEqual([expect.objectContaining({ step_id: GATE_ID, check: 'length_ratio' })])

    const long = makePolishTranslation()
    long.finale.text = long.finale.text.repeat(2)
    expect(failures(run(long))).toEqual([expect.objectContaining({ step_id: null, check: 'length_ratio' })])
  })

  it('у exact_any обязан быть вариант на языке перевода; у типа без списка — пустой массив', () => {
    const cyrillicOnly = makePolishTranslation()
    stepOf(cyrillicOnly, GATE_ID).answer_variants = ['орёл']
    expect(failures(run(cyrillicOnly))).toEqual([expect.objectContaining({ step_id: GATE_ID, check: 'answer_variants' })])

    const empty = makePolishTranslation()
    stepOf(empty, GATE_ID).answer_variants = []
    expect(failures(run(empty))).toEqual([expect.objectContaining({ step_id: GATE_ID, check: 'answer_variants' })])

    const extra = makePolishTranslation()
    stepOf(extra, TOWER_ID).answer_variants = ['siedem']
    expect(failures(run(extra))).toEqual([expect.objectContaining({ step_id: TOWER_ID, check: 'answer_variants' })])
  })

  it('подсказка с ответом — отказ, в том числе без диакритики; утечка самого источника не вменяется переводу', () => {
    const leaking = makePolishTranslation()
    stepOf(leaking, GATE_ID).hint = 'Szukaj wysoko: tam jest Orzel w koronie.'
    const failed = failures(run(leaking))
    expect(failed).toEqual([expect.objectContaining({ step_id: GATE_ID, check: 'hint_leak' })])
    expect(failed[0].detail).toContain('orzeł')

    const task = makeTask()
    task.source.steps.find((step: { step_id: number }) => step.step_id === GATE_ID).hint = 'Это орёл под крышей ворот.'
    const tolerated = run(leaking, task).find((entry) => entry.step_id === GATE_ID && entry.check === 'hint_leak')!
    expect(tolerated.ok).toBe(true)
    expect(tolerated.detail).toContain('русском источнике')
  })

  it('пустое поле, непустое в источнике, и потерянный финал — отказы', () => {
    const translation = makePolishTranslation() as any
    stepOf(translation, GATE_ID).hint = ''
    stepOf(translation, TOWER_ID).poi_opening_hours = ''
    translation.finale = null
    expect(failures(run(translation))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ step_id: GATE_ID, check: 'required_fields', detail: expect.stringContaining('hint') }),
        expect.objectContaining({ step_id: TOWER_ID, check: 'required_fields', detail: expect.stringContaining('poi_opening_hours') }),
        expect.objectContaining({ step_id: null, check: 'finale' }),
      ]),
    )
  })

  it('шаг вне задания обязан совпадать с принятым переводом', () => {
    const accepted = makePolishTranslation()
    const task = makeTask('pl', { mode: 'incremental', translate_step_ids: [GATE_ID], existing: accepted })
    expect(failures(run(makePolishTranslation(), task))).toEqual([])

    const edited = makePolishTranslation()
    stepOf(edited, TOWER_ID).task = 'Policz wszystkie wieżyczki wokół iglicy. Ile ich jest?'
    stepOf(edited, GATE_ID).task += ' Dopisano.'
    expect(failures(run(edited, task))).toEqual([expect.objectContaining({ step_id: TOWER_ID, check: 'kept_steps' })])
  })
})

describe('planSteps', () => {
  const source = sourceFromBundle(makeBundle())
  const published = { state: 'published', missing_step_ids: [], stale_step_ids: [TOWER_ID] }

  it('без перевода и для черновика — полный перевод', () => {
    expect(planSteps({ source, statusRow: null, existing: null, force: false })).toEqual({
      mode: 'full',
      translate: [INTRO_ID, GATE_ID, TOWER_ID],
      locked: [],
      finaleOutdated: true,
    })
    const draft = planSteps({ source, statusRow: { ...published, state: 'draft' }, existing: makePolishTranslation(), force: false })
    expect(draft.mode).toBe('full')
  })

  it('опубликованный перевод дополняется только устаревшим и недостающим', () => {
    const existing = makePolishTranslation()
    existing.steps = existing.steps.filter((step) => step.step_id !== INTRO_ID)
    expect(planSteps({ source, statusRow: published, existing, force: false })).toEqual({
      mode: 'incremental',
      translate: [INTRO_ID, TOWER_ID],
      locked: [],
      finaleOutdated: false,
    })
  })

  it('устаревший, недостающий или лишний финал — тоже работа, даже если шаги актуальны', () => {
    const fresh = { ...published, stale_step_ids: [] }
    const staleFinale = makePolishTranslation() as any
    staleFinale.finale.stale = true
    expect(planSteps({ source, statusRow: fresh, existing: staleFinale, force: false })).toMatchObject({ translate: [], finaleOutdated: true })
    const noFinale = { ...makePolishTranslation(), finale: null }
    expect(planSteps({ source, statusRow: fresh, existing: noFinale, force: false })).toMatchObject({ finaleOutdated: true })
    const withoutSourceFinale = { ...source, finale: null }
    expect(planSteps({ source: withoutSourceFinale, statusRow: fresh, existing: makePolishTranslation(), force: false })).toMatchObject({ finaleOutdated: true })
    expect(planSteps({ source, statusRow: fresh, existing: makePolishTranslation(), force: false })).toMatchObject({ translate: [], finaleOutdated: false })
  })

  it('ручной перевод без --force не переводится даже устаревший', () => {
    const existing = makePolishTranslation()
    stepOf(existing, TOWER_ID).origin = 'human'
    expect(planSteps({ source, statusRow: published, existing, force: false })).toMatchObject({ translate: [], locked: [TOWER_ID] })
    expect(planSteps({ source, statusRow: published, existing, force: true })).toMatchObject({
      mode: 'full',
      translate: [INTRO_ID, GATE_ID, TOWER_ID],
      locked: [],
    })
  })
})

describe('смысловая проверка и гейт публикации', () => {
  const task = makeTask()
  const translation = makePolishTranslation()
  const structural = run(translation, task)
  const verdicts = [INTRO_ID, GATE_ID, TOWER_ID, null].map((id) => ({ step_id: id, ok: true, detail: '' }))
  const review = { kind: 'quest-translation-review', translation_sha256: reviewDigest({ task, translation }), verdicts }

  it('задание проверяющему несёт хеш перевода и объединённые ответы шага', () => {
    const reviewTask = buildReviewTask({ task, translation, paths: artifactPaths('.codex-temp/quest-translations', 'pl', 'demo-quest') })
    expect(reviewTask.translation_sha256).toBe(review.translation_sha256)
    expect(reviewTask.steps[1].accepted_answers).toEqual(['orzeł', 'orzel', 'orła', 'орел', 'орёл', 'eagle'])
    expect(reviewTask.output_path).toMatch(/pl\/demo-quest\.review\.json$/)
  })

  it('нет вердикта — записей semantic нет, публикация закрыта, черновик открыт', () => {
    expect(mergeReview({ task, translation, review: null })).toEqual([])
    expect(uploadBlockers(structural, { publish: false })).toEqual([])
    expect(uploadBlockers(structural, { publish: true })).toEqual(['semantic: смысловая проверка не проведена'])
  })

  it('зелёный вердикт по каждому шагу и финалу открывает публикацию', () => {
    const semantic = mergeReview({ task, translation, review })
    expect(semantic).toHaveLength(4)
    expect(uploadBlockers([...structural, ...semantic], { publish: true })).toEqual([])
  })

  it('отказ проверяющего и шаг без вердикта закрывают публикацию', () => {
    const partial = { ...review, verdicts: [{ step_id: INTRO_ID, ok: true, detail: '' }, { step_id: GATE_ID, ok: false, detail: 'ответ недостижим' }] }
    const semantic = mergeReview({ task, translation, review: partial }) as Check[]
    expect(failures(semantic).map((entry) => [entry.step_id, entry.detail])).toEqual([
      [GATE_ID, 'ответ недостижим'],
      [TOWER_ID, 'нет вердикта проверяющего'],
      [null, 'нет вердикта проверяющего'],
    ])
    expect(uploadBlockers([...structural, ...semantic], { publish: true })).toHaveLength(3)
  })

  it('без финала вердикт по названию (step_id null) всё равно обязателен и учитывается', () => {
    const noFinaleTask = { ...task, source: { ...task.source, finale: null } }
    const noFinaleReview = { ...review, translation_sha256: reviewDigest({ task: noFinaleTask, translation }) }
    const rejectedTitle = { ...noFinaleReview, verdicts: [...verdicts.slice(0, 3), { step_id: null, ok: false, detail: 'название искажено' }] }
    expect(failures(mergeReview({ task: noFinaleTask, translation, review: rejectedTitle })).map((entry) => entry.step_id)).toEqual([null])
    const withoutTitle = { ...noFinaleReview, verdicts: verdicts.slice(0, 3) }
    expect(failures(mergeReview({ task: noFinaleTask, translation, review: withoutTitle })).map((entry) => entry.detail)).toEqual([
      'нет вердикта проверяющего',
    ])
  })

  it('переведённый шаг с origin: human не пишется даже черновиком', () => {
    const marked = makePolishTranslation()
    stepOf(marked, GATE_ID).origin = 'human'
    const checks = run(marked, task)
    expect(failures(checks)).toEqual([expect.objectContaining({ step_id: GATE_ID, check: 'origin' })])
    expect(uploadBlockers(checks, { publish: false })).toHaveLength(1)
  })

  it('правка перевода после проверки делает вердикт недействительным; статус на хеш не влияет', () => {
    const edited = makePolishTranslation()
    stepOf(edited, GATE_ID).answer_variants.push('orzełek')
    expect(failures(mergeReview({ task, translation: edited, review }))).toHaveLength(4)
    expect(reviewDigest({ task, translation: { ...translation, status: 'published', checks: structural } })).toBe(
      review.translation_sha256,
    )
  })

  it('правка русского источника после проверки тоже делает вердикт недействительным', () => {
    const changed = makeTask()
    changed.source.steps[1].task += ' Назови двумя словами.'
    expect(failures(mergeReview({ task: changed, translation, review }))).toHaveLength(4)
    expect(mergeReview({ task: makeTask(), translation, review }).every((entry: Check) => entry.ok)).toBe(true)
  })

  it('черновик не пишется при потерянном шаге, но пишется при отказе стиля', () => {
    const lost = makePolishTranslation()
    lost.steps.pop()
    expect(uploadBlockers(run(lost, task), { publish: false })).toHaveLength(1)

    const styled = makePolishTranslation()
    stepOf(styled, GATE_ID).hint = 'To orzeł.'
    expect(uploadBlockers(run(styled, task), { publish: false })).toEqual([])
    expect(uploadBlockers(run(styled, task), { publish: true }).length).toBeGreaterThan(0)
  })
})

describe('локали и справочные данные', () => {
  const { targets, sourceLocale } = getQuestContentLocales()

  it('целевые локали берутся из i18n/config.ts, и у каждой есть правило письма', () => {
    expect(sourceLocale).toBe('ru')
    expect(targets.length).toBeGreaterThan(0)
    expect(targets).not.toContain(sourceLocale)
    expect(Object.keys(SCRIPT_RULES).sort()).toEqual([...targets].sort())
  })

  it('скрипт не содержит собственного списка локалей', () => {
    const files = [
      'scripts/quest-translate.js',
      ...fs.readdirSync(path.join(ROOT, 'scripts/lib/questTranslation')).map((name: string) => `scripts/lib/questTranslation/${name}`),
    ]
    const codes = [sourceLocale, ...targets].join('|')
    const localeList = new RegExp(`\\[\\s*(['"\`])(?:${codes})\\1\\s*,\\s*(['"\`])(?:${codes})\\2`)
    for (const file of files) {
      expect({ file, hasList: localeList.test(fs.readFileSync(path.join(ROOT, file), 'utf8')) }).toEqual({ file, hasList: false })
    }
  })

  it('глоссарий стайл-гайда читается и покрывает каждую целевую локаль', () => {
    for (const locale of targets) {
      const rows = loadGlossary(locale)
      expect(rows.length).toBeGreaterThanOrEqual(20)
      for (const row of rows) expect({ ru: row.ru, filled: Boolean(row[locale]) }).toEqual({ ru: row.ru, filled: true })
    }
    expect(fs.existsSync(path.join(ROOT, GUIDE_PATH))).toBe(true)
  })

  it('подпись кнопки из текста квеста берётся из интерфейса на языке перевода; кнопки мастера — всегда', () => {
    const source = sourceFromBundle(makeBundle())
    for (const locale of targets) {
      const labels = collectUiLabels({ source, sourceLocale, locale })
      // Процитированный «Начать квест» и есть первая кнопка мастера — дубля нет.
      expect(labels.map((label: { source: string }) => label.source)).toEqual([
        'Начать квест',
        'Далее',
        'Проверить ответ',
        'Пропустить',
        'Подсказка',
      ])
      for (const label of labels) expect(label.target).toBeTruthy()
    }
  })
})
