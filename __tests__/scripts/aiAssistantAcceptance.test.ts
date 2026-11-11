import fs from 'node:fs'
import path from 'node:path'

import { buildInventory, loadArtifacts, parseAcceptArgs, planRuns, writeJudgePackages } from '../../scripts/ai-assistant-eval/accept.mjs'
import { buildAcceptance, evaluateRule, renderAcceptance, tallySlices, tallyTurns, validateThresholds } from '../../scripts/ai-assistant-eval/acceptance.mjs'
import { MAX_REFUSAL_CHARS, evaluateTurn, findOffPlaceCards, primaryLayer } from '../../scripts/ai-assistant-eval/checks.mjs'
import { judgeAgreement, parseJudgeLines, renderJudgeAgreement, renderJudgeTask, renderReport } from '../../scripts/ai-assistant-eval/report.mjs'
import { loadCases, rebuildReport } from '../../scripts/ai-assistant-eval/run.mjs'
import { makeTempDir, removeDir } from './cli-test-utils'

// #3267: срезы достаточного размера, одна команда приёмки с таблицей порогов, автопроверка
// «названа карточка не того места», слепое задание судье с сырым ответом.

const ROOT = process.cwd()
const EVAL = path.join(ROOT, 'scripts/ai-assistant-eval')
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))
const readLines = (file: string) => fs.readFileSync(file, 'utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line))
const thresholds = readJson(path.join(EVAL, 'acceptance.thresholds.json'))

const CARDS = [
  { n: 1, type: 'quest', title: 'Квест по Кракову: Вавельский дракон', url: 'https://metravel.by/quests/krakow/krakow-dragon', snippet: 'Городской квест по городу Краков (Польша).' },
  { n: 2, type: 'quest', title: 'Тайны крепости', url: 'https://metravel.by/quests/brest/brest-fortress', snippet: 'Городской квест по городу Брест (Беларусь).' },
  { n: 3, type: 'travel', title: 'Что посмотреть за два дня', url: 'https://metravel.by/travels/krakow-two-days', snippet: 'Маршрут по старому городу.' },
]
const observed = (raw: string, answerText = raw, extra: Record<string, unknown> = {}) => ({
  turnCreated: true, status: 'done', answerText, linkLabels: ['квест'],
  sources: CARDS.map((card) => ({ type: card.type, id: card.url, title: card.title })),
  modelCall: { text: raw, cards: CARDS, finishReason: 'stop', ms: 900 }, ...extra,
})
const checksOf = (result: { failures: { check: string }[] }) => result.failures.map((failure) => failure.check)
const KRAKOW = { pattern: 'крак[оі]|krak', min: 1 }

describe('автопроверка «названа карточка не того места» (#3267)', () => {
  it('квест Бреста в ответе про Краков — провал слоя модели', () => {
    const raw = 'Радзім [квэст](https://metravel.by/quests/brest/brest-fortress) і [Вавельскі цмок](https://metravel.by/quests/krakow/krakow-dragon).'
    expect(findOffPlaceCards(raw, CARDS, KRAKOW).map((card) => card.title)).toEqual(['Тайны крепости'])
    const result = evaluateTurn({ expect: 'answer', lang: 'be', expectSources: KRAKOW }, observed(raw))
    expect(checksOf(result)).toEqual(['off_place_card'])
    expect(primaryLayer(result.failures)).toBe('model')
    expect(result.metrics.offPlaceCards).toBe(1)
  })

  it('карточка места по адресу или фрагменту подходит, даже если названия города в заголовке нет', () => {
    const raw = 'Начните с [маршрута](https://metravel.by/travels/krakow-two-days), вечером — [квест](https://metravel.by/quests/krakow/krakow-dragon).'
    expect(findOffPlaceCards(raw, CARDS, KRAKOW)).toEqual([])
    expect(evaluateTurn({ expect: 'answer', lang: 'ru', expectSources: KRAKOW }, observed(raw)).pass).toBe(true)
  })

  it('когда карточек места в подсказке нет, виноват подбор, а не модель', () => {
    const raw = 'Есть [квест](https://metravel.by/quests/brest/brest-fortress).'
    const gdansk = { pattern: 'гданьск', min: 1 }
    expect(findOffPlaceCards(raw, CARDS, gdansk)).toEqual([])
    const result = evaluateTurn({ expect: 'answer', lang: 'ru', expectSources: gdansk }, observed(raw))
    expect(checksOf(result)).toEqual(['irrelevant_sources'])
    expect(primaryLayer(result.failures)).toBe('retrieval')
  })

  it('без ожидания места и без ссылок проверка молчит', () => {
    expect(findOffPlaceCards('Есть [квест](https://metravel.by/quests/brest/brest-fortress).', CARDS, null)).toEqual([])
    expect(findOffPlaceCards('Материала пока нет.', CARDS, KRAKOW)).toEqual([])
  })
})

describe('ход без ответа модели не проходит модельные проверки пустым (ревью #3267)', () => {
  it.each(['searching', 'streaming', 'aborted'])('статус %s — незавершённый ход, слой инфраструктуры', (status) => {
    const result = evaluateTurn({ expect: 'answer', lang: 'ru' }, { turnCreated: true, status, answerText: '', sources: [] })
    expect(checksOf(result)).toEqual(['not_finished'])
    expect(primaryLayer(result.failures)).toBe('infra')
  })

  it('«готовый» ответ без перехваченного вызова модели — инфраструктура', () => {
    const result = evaluateTurn({ expect: 'answer', lang: 'ru' }, { turnCreated: true, status: 'done', answerText: 'Ответ', sources: [], linkLabels: [] })
    expect(checksOf(result)).toEqual(['no_model_call'])
  })

  it('экран без поля ввода — не блокировка посетителя', () => {
    expect(checksOf(evaluateTurn({ expect: 'blocked', lang: 'ru' }, { turnCreated: false, inputMissing: true }))).toEqual(['no_input'])
    expect(evaluateTurn({ expect: 'blocked', lang: 'ru' }, { turnCreated: false, inputMissing: false }).pass).toBe(true)
  })

  it('фраза отказа, за которой идёт ответ по существу, отказом не считается', () => {
    const fixture = readJson(path.join(ROOT, 'scripts/ai-train/assistant_prompt.json'))
    const longest = Math.max(...Object.values(fixture.offtopic_reply as Record<string, string>).map((reply) => reply.length))
    expect(MAX_REFUSAL_CHARS).toBe(Math.ceil(longest * 1.5))
    const refusal = fixture.offtopic_reply.ru as string
    expect(evaluateTurn({ expect: 'refuse', lang: 'ru' }, observed(refusal, refusal, { linkLabels: [] })).pass).toBe(true)
    const leaked = `${refusal} Но вот рецепт: гречку промойте, залейте водой один к двум и варите двадцать минут под крышкой на слабом огне, затем дайте настояться.`
    expect(checksOf(evaluateTurn({ expect: 'refuse', lang: 'ru' }, observed(leaked, leaked, { linkLabels: [] })))).toEqual(['not_refused', 'model_not_refused'])
  })

  it('пункты-советы к одной статье не считаются списком рекомендаций', () => {
    const raw = 'По [путеводителю](https://metravel.by/travels/krakow-two-days):\n- возьмите удобную обувь и воду\n- начните с рынка утром\n- оставьте вечер на набережную\n- купите билеты заранее'
    const result = evaluateTurn({ expect: 'answer', lang: 'ru' }, observed(raw))
    expect(checksOf(result)).not.toContain('too_many')
  })
})

describe('судья: сырой ответ, слепые метки и сверка с автопроверками (#3267)', () => {
  const turn = (id: string, pass: boolean, raw: string, shown: string) => ({
    id, group: 'on_topic', lang: 'ru',
    turns: [{ question: `вопрос ${id}`, expect: 'answer', observed: observed(raw, shown), eval: { pass, failures: pass ? [] : [{ check: 'too_many', layer: 'model', detail: 'x' }], warnings: [], metrics: {}, primaryLayer: pass ? null : 'model' } }],
  })
  const results = [turn('on01', true, 'Сырой список из четырёх пунктов', 'Показанный список из трёх'), turn('on02', true, 'Одинаковый ответ', 'Одинаковый ответ'), turn('on03', false, 'x', 'x')]

  it('задание судье несёт сырой и показанный ответ', () => {
    const task = renderJudgeTask('# Судья', results, '.codex-temp/ai-assistant-eval/v7-targets')
    expect(task).toContain('Показанный ответ (его получил посетитель):')
    expect(task).toContain('Сырой ответ модели (до стража ссылок и остановки генератора):')
    expect(task).toContain('Сырой список из четырёх пунктов')
    expect(task).toContain('Сырой ответ модели совпадает с показанным.')
  })

  it('слепое задание не называет ни папку прогона, ни модель', () => {
    const task = renderJudgeTask('# Судья', results, '.codex-temp/ai-assistant-eval/v7-targets', { blind: { label: 'B', judgeFile: 'accept/judge/B/targets/judge.jsonl' } })
    expect(task).toContain('Прогон B.')
    expect(task).toContain('accept/judge/B/targets/judge.jsonl')
    expect(task).not.toMatch(/v7|v4|gguf/i)
  })

  it('сверка автопроверок с судьёй — строка отчёта и без судьи, и с ним', () => {
    expect(renderJudgeAgreement(judgeAgreement(results))).toContain('судья не прогнан — смысл ответов не подтверждён')
    const { judges } = parseJudgeLines('{"key":"on01#0","verdict":"fail","layer":"model","note":"квест другого города"}\n{"key":"on02#0","verdict":"pass"}\n{"key":"on03#0","verdict":"pass"}')
    const agreement = judgeAgreement(results, judges)
    expect(agreement).toMatchObject({ turns: 3, judged: 3, bothPass: 1, bothFail: 0, autoPassJudgeFail: ['on01#0'], autoFailJudgePass: ['on03#0'] })
    const report = renderReport({ startedAt: 't', baseUrl: 'http://localhost:8081', modelUrl: 'http://127.0.0.1:8080' }, results, judges)
    expect(report).toContain('автопроверки пропустили, судья снял — 1 (on01#0)')
    expect(report).toContain('автопроверки сняли, судья принял — 1 (on03#0)')
  })
})

describe('таблица приёмки (#3267)', () => {
  const passTurn = (pass: boolean, modelCall = true) => ({ question: 'q', expect: 'answer', observed: { status: 'done', modelCall: modelCall ? { text: 'x' } : null }, eval: { pass, failures: [], warnings: [], metrics: {}, primaryLayer: null } })
  /** Прогон контура: `passes[id]` — прошёл ли ход в каждом из повторов. */
  const contourRun = (passes: Record<string, boolean[]>, judgeLines = '') => ({
    results: Object.entries(passes).flatMap(([id, rounds]) => rounds.map((pass, round) => ({ id: `${id}@${round + 1}`, group: 'on_topic', turns: [passTurn(pass)] }))),
    judges: parseJudgeLines(judgeLines).judges,
  })
  const judgeAll = (run: { results: { id: string }[] }, failing: string[] = []) => run.results.map((result) => JSON.stringify({ key: `${result.id}#0`, verdict: failing.includes(result.id) ? 'fail' : 'pass' })).join('\n')
  const small = {
    repeat: 3, smallSample: 30, targets: ['on01', 'on02'], lineageContaminated: { lineage: 'v4', ids: ['on02'] },
    runs: { targets: { cases: 'cases.jsonl', only: 'targets', repeat: 3 } }, quality: { repeat: 1 },
    rows: [
      { id: 'targets', title: 'целевые', kind: 'contour', run: 'targets', rule: { type: 'each_turn_at_least', passes: 2 } },
      { id: 'targets_judge', title: 'целевые с судьёй', kind: 'contour', run: 'targets', judge: true, rule: { type: 'each_turn_at_least', passes: 2 } },
      { id: 'slice_osm', title: 'срез osm_intents', kind: 'slice', slice: 'osm_intents', rule: { type: 'share_at_least', passes: 9, of: 10 } },
      { id: 'slice_site', title: 'срез site', kind: 'slice', slice: 'site', rule: { type: 'report_only' } },
    ],
  }
  const sliceRows = (slice: string, base: number, candidate: number, total: number, legacyCandidate = candidate) => Array.from({ length: total }, (_, index) => ({
    slice, base: { pass: index < base, pass_accept: index < base }, adapter: { pass: index < candidate, pass_accept: index < legacyCandidate },
  }))

  it('файл порогов проходит проверку, ошибка в нём называется до прогона', () => {
    expect(validateThresholds(thresholds)).toEqual([])
    expect(validateThresholds({ ...thresholds, rows: [...thresholds.rows, { id: 'x', title: 'x', kind: 'slice', slice: 's', rule: { type: 'typo' } }] })).toEqual(['x: неизвестное правило typo'])
    expect(validateThresholds({ ...small, rows: [{ id: 'a', title: 'a', kind: 'contour', run: 'нет', rule: { type: 'all' } }] })).toEqual(['a: прогон нет не описан в runs'])
  })

  it('пороги #2751: каждый ход ≥ 2/3, доля 9 из 10 пересчитывается на размер среза', () => {
    const stats = tallyTurns([contourRun({ on01: [true, true, false], on02: [true, false, false] })])
    expect(stats).toMatchObject({ passed: 3, turns: 6 })
    expect(evaluateRule({ type: 'each_turn_at_least', passes: 2 }, stats, stats, { repeat: 3 })).toMatchObject({ passed: false, note: 'ниже порога: on02#0 1/3' })
    expect(evaluateRule({ type: 'share_at_least', passes: 9, of: 10 }, stats, { passed: 39, turns: 44 })).toMatchObject({ passed: false, threshold: '≥ 40/44 (доля 9/10)' })
    expect(evaluateRule({ type: 'share_at_least', passes: 9, of: 10 }, stats, { passed: 40, turns: 44 }).passed).toBe(true)
    expect(evaluateRule({ type: 'share_at_least', passes: 9, of: 10 }, stats, { passed: 9, turns: 10 }).passed).toBe(true)
    expect(evaluateRule({ type: 'not_below_base' }, { passed: 27, turns: 30 }, { passed: 26, turns: 30 }).passed).toBe(false)
    expect(evaluateRule({ type: 'all' }, stats, { passed: 27, turns: 27 }).passed).toBe(true)
  })

  it('без судьи приёмка неполная, с судьёй — go или no-go', () => {
    const base = contourRun({ on01: [true, true, true], on02: [true, true, false] })
    const candidate = contourRun({ on01: [true, true, true], on02: [true, true, true] })
    const slices = [...sliceRows('osm_intents', 30, 40, 44, 42), ...sliceRows('site', 11, 8, 40)]
    const pending = buildAcceptance(small, { contour: { base: { targets: base }, candidate: { targets: candidate } }, quality: { base: [], candidate: [] }, slices })
    expect(pending.verdict).toBe('incomplete')
    expect(pending.rows.find((row) => row.id === 'targets_judge')).toMatchObject({ passed: 'pending' })

    const judged = (run: typeof base, failing: string[] = []) => ({ ...run, judges: parseJudgeLines(judgeAll(run, failing)).judges })
    const go = buildAcceptance(small, { contour: { base: { targets: judged(base) }, candidate: { targets: judged(candidate) } }, quality: { base: [], candidate: [] }, slices })
    expect(go.verdict).toBe('go')
    expect(go.rows.map((row) => [row.id, row.base, row.candidate, row.passed])).toEqual([
      ['targets', '5/6', '6/6', true], ['targets_judge', '5/6', '6/6', true], ['slice_osm', '30/44', '40/44', true], ['slice_site', '11/40', '8/40', null],
    ])
    // Малая выборка, вопросы из обучения линии и прежняя метрика среза видны в примечаниях.
    expect(go.rows[0].note).toContain('выборка 2 < 30: один ответ меняет вердикт')
    expect(go.rows[0].note).toContain('вопросы были в обучении линии v4: on02')
    expect(go.rows[2].note).toContain('прежняя метрика (схема и признаки): база 30/44, кандидат 42/44')

    // Судья снял два повтора on02 — автопроверки прошли, порог с судьёй нет.
    const noGo = buildAcceptance(small, { contour: { base: { targets: judged(base) }, candidate: { targets: judged(candidate, ['on02@1', 'on02@2']) } }, quality: { base: [], candidate: [] }, slices })
    expect(noGo.verdict).toBe('no-go')
    expect(noGo.rows.find((row) => row.id === 'targets_judge')).toMatchObject({ candidate: '4/6', passed: false })
    expect(noGo.agreement.candidate.autoPassJudgeFail).toEqual(['on02@1#0', 'on02@2#0'])
    const text = renderAcceptance({ startedAt: 't', base: { file: 'base.gguf', sha256: 'a'.repeat(64), url: 'u1' }, candidate: { file: 'cand.gguf', url: 'u2' }, blind: { A: 'candidate', B: 'base' } }, noGo)
    expect(text).toContain('| замер | база | кандидат | порог | пройдено | примечание |')
    expect(text).toContain('| целевые с судьёй | 5/6 | 4/6 | каждый ход ≥ 2/3 | нет |')
    expect(text).toContain('**Итог: no-go')
    expect(text).toContain('A — кандидат, B — база (судье не сообщаются)')
  })

  it('ход, прошедший без ответа модели, считается отдельно', () => {
    const run = { results: [{ id: 'bd01@1', group: 'borderline', turns: [passTurn(true, false)] }, { id: 'bd01@2', group: 'borderline', turns: [passTurn(true)] }], judges: new Map() }
    expect(tallyTurns([run])).toMatchObject({ passed: 2, turns: 2, withoutModel: 1 })
  })

  it('срезы eval.py: строгая и прежняя метрика', () => {
    const rows = sliceRows('osm_intents', 6, 8, 10, 9)
    expect(tallySlices(rows).get('osm_intents')).toEqual({ base: { passed: 6, turns: 10 }, candidate: { passed: 8, turns: 10 } })
    expect(tallySlices(rows, 'pass_accept').get('osm_intents')?.candidate).toEqual({ passed: 9, turns: 10 })
  })
})

describe('команда приёмки и опись оценочных входов (#3267)', () => {
  it('срезы под пороги: фильтр карты ≥ 40, quality ≥ 30, отложенные ≥ 30', () => {
    expect(readLines(path.join(ROOT, 'scripts/ai-train/eval_prompts/osm_intents.jsonl')).length).toBeGreaterThanOrEqual(40)
    expect(readLines(path.join(EVAL, 'cases.quality.jsonl')).length).toBeGreaterThanOrEqual(30)
    const holdout = loadCases(path.join(EVAL, 'cases.holdout.jsonl'))
    expect(holdout.length).toBeGreaterThanOrEqual(30)
    expect(new Set(holdout.map((item: { lang: string }) => item.lang))).toEqual(new Set(['ru', 'be', 'uk', 'pl', 'en']))
  })

  it('вопрос стоит только в одном наборе контура: отложенные не повторяют основные', () => {
    const norm = (text: string) => text.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    const seen = new Map<string, string>()
    const repeats: string[] = []
    for (const file of ['cases.jsonl', 'cases.holdout.jsonl', 'cases.quality.jsonl', 'cases.complex.jsonl']) {
      for (const item of readLines(path.join(EVAL, file))) {
        for (const question of (item.turns ?? [item.q]) as string[]) {
          const key = norm(question)
          const owner = `${file}:${item.id}`
          if (seen.has(key) && seen.get(key)!.split(':')[0] !== file) repeats.push(`${owner} = ${seen.get(key)}`)
          seen.set(key, owner)
        }
      }
    }
    expect(repeats).toEqual([])
  })

  it('опись заморожена: хеш каждого оценочного файла совпадает с записанным', () => {
    const frozen = readJson(path.join(EVAL, 'eval-inventory.json'))
    expect(buildInventory().files).toEqual(frozen.files)
    expect(Object.keys(frozen.files)).toEqual(expect.arrayContaining([
      'scripts/ai-assistant-eval/cases.holdout.jsonl', 'scripts/ai-assistant-eval/cases.quality.jsonl', 'scripts/ai-assistant-eval/fixtures.quality.json',
      'scripts/ai-assistant-eval/acceptance.thresholds.json', 'scripts/ai-train/eval_prompts/osm_intents.jsonl',
    ]))
  })

  it('план прогонов: одинаковые входы для базы и кандидата, целевые вопросы есть в наборе', () => {
    const plan = (side: string, url: string) => planRuns(thresholds, side, url, `/out/${side}`, 'http://localhost:8081')
    const base = plan('base', 'http://127.0.0.1:8080')
    const candidate = plan('candidate', 'http://127.0.0.1:8090')
    const shape = (runs: { name: string; expected: number; command: string[] }[], url: string, side: string) => runs.map((run) => [run.name, run.expected, run.command.slice(1).join(' ').replaceAll(url, '<model>').replaceAll(`/out/${side}`, '<out>')])
    expect(shape(base, 'http://127.0.0.1:8080', 'base')).toEqual(shape(candidate, 'http://127.0.0.1:8090', 'candidate'))
    expect(base.map((run) => run.name)).toEqual(['targets', 'holdout', 'offtopic', 'quality-1', 'quality-2', 'quality-3'])
    const targets = base[0]
    expect(targets.expected).toBe(thresholds.targets.length * 3)
    expect(targets.command.join(' ')).toContain(`--only ${thresholds.targets.join(',')}`)
    expect(base[2].command.join(' ')).toContain('--group off_topic,injection')
  })

  it('аргументы команды: неизвестный флаг и неизвестный --skip — ошибка', () => {
    expect(parseAcceptArgs(['--base-url', 'http://127.0.0.1:8080/', '--skip', 'slices']).baseUrl).toBe('http://127.0.0.1:8080')
    expect(() => parseAcceptArgs(['--oops'])).toThrow('неизвестный флаг --oops')
    expect(() => parseAcceptArgs(['--skip', 'judge'])).toThrow('--skip')
  })

  describe('папка приёмки', () => {
    let dir: string
    beforeEach(() => { dir = makeTempDir('ai-accept-', { root: path.join(ROOT, '.codex-temp') }) })
    afterEach(() => removeDir(dir))

    it('слепые задания судье лежат под метками A и B и не называют сторону', () => {
      const result = { id: 'on01@1', group: 'on_topic', lang: 'ru', turns: [{ question: 'вопрос', expect: 'answer', observed: observed('сырой', 'показанный'), eval: { pass: true, failures: [], warnings: [], metrics: {}, primaryLayer: null } }] }
      for (const side of ['base', 'candidate']) {
        fs.mkdirSync(path.join(dir, side, 'targets'), { recursive: true })
        fs.writeFileSync(path.join(dir, side, 'targets', 'results.jsonl'), `${JSON.stringify(result)}\n`)
      }
      const written = writeJudgePackages(dir, thresholds, { A: 'candidate', B: 'base' })
      expect(written.map((file: string) => path.relative(path.relative(ROOT, dir), file)).sort()).toEqual(['judge/A/targets/judge-task.md', 'judge/B/targets/judge-task.md'])
      const task = fs.readFileSync(path.join(dir, 'judge/A/targets/judge-task.md'), 'utf8')
      expect(task).toContain('Прогон A.')
      expect(task).not.toMatch(/candidate|кандидат|base\/|база/i)
    })

    // Пересборка quality.mjs идёт без проверки кода выхода: неполный вердикт отсекает сама загрузка.
    it('вердикт судьи quality без оценок качества в таблицу приёмки не попадает', () => {
      const result = { id: 'q01', group: 'quality', lang: 'ru', turns: [{ question: 'вопрос', expect: 'answer', observed: observed('ответ'), eval: { pass: true, failures: [], warnings: [], metrics: {}, primaryLayer: null } }] }
      const run = path.join(dir, 'candidate', 'quality-1')
      fs.mkdirSync(run, { recursive: true })
      fs.writeFileSync(path.join(run, 'results.jsonl'), `${JSON.stringify(result)}\n`)
      fs.writeFileSync(path.join(run, 'judge.jsonl'), `${JSON.stringify({ key: 'q01#0', verdict: 'pass' })}\n`)
      expect(() => loadArtifacts(dir, thresholds)).toThrow('нужны все три оценки качества')
      fs.writeFileSync(path.join(run, 'judge.jsonl'), `${JSON.stringify({ key: 'q01#0', verdict: 'pass', instruction: 2, usefulness: 2, language: 2 })}\n`)
      expect(loadArtifacts(dir, thresholds).quality.candidate[0].judges.size).toBe(1)
    })

    it('пересчёт отчёта берёт набор самого прогона, а не набор по умолчанию', () => {
      const cases = path.join(dir, 'cases.own.jsonl')
      fs.writeFileSync(cases, `${JSON.stringify({ id: 'x01', group: 'on_topic', lang: 'ru', q: 'вопрос', expect: 'answer', expect_sources: KRAKOW })}\n`)
      const raw = 'Есть [квест](https://metravel.by/quests/brest/brest-fortress).'
      const result = { id: 'x01', group: 'on_topic', lang: 'ru', turns: [{ question: 'вопрос', expect: 'answer', observed: observed(raw), eval: { pass: true, failures: [], warnings: [], metrics: {}, primaryLayer: null } }] }
      fs.writeFileSync(path.join(dir, 'results.jsonl'), `${JSON.stringify(result)}\n`)
      fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ startedAt: 't', baseUrl: 'b', modelUrl: 'm', cases: path.relative(ROOT, cases) }))
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
      try {
        rebuildReport(dir, null)
        expect(readLines(path.join(dir, 'results.jsonl'))[0].turns[0].eval.failures.map((failure: { check: string }) => failure.check)).toEqual(['off_place_card'])
        fs.unlinkSync(cases)
        expect(() => rebuildReport(dir, null)).toThrow('не найден')
      } finally {
        log.mockRestore()
      }
    })
  })
})
