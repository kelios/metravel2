import fs from 'node:fs'
import path from 'node:path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

type Message = { role: string; content: string }
type Row = { id: string; key: string; kind: string; set: string; license: string; messages: Message[] }
type Facts = Record<string, string | number | boolean | null>
type Card = { title: string; url: string; snippet: string; facts: Facts }
type Scenario = { kind: string; number: number; requirements: Facts; cards: Card[] }
type Bundle = { rows: Row[]; scenarios: Scenario[]; splits: Row[][]; deterministic: boolean }
const TRAIN = path.resolve(process.cwd(), 'scripts/ai-train')
let home: string
let data: Bundle

const rowFor = (scenario: Scenario, variant = 0) => data.rows.find((row) => row.id === `${scenario.kind}:${(scenario.number - 1) % 15}:${variant}`)!
const target = (row: Row) => row.messages.at(-1)!.content
const selectedCard = (scenario: Scenario, row = rowFor(scenario)) => scenario.cards.find((card) => target(row).includes(card.url))!

beforeAll(() => {
  home = makeTempDir('constraints-unit-', { root: path.join(process.cwd(), '.codex-temp') })
  const code = `import json,sys\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1])\nfrom sets.constraints import build,make_scenario,KINDS\nfrom sets.common import split\nctx={'seed':20261017}\nrows=build(ctx,{})\nscenarios=[make_scenario(kind,i) for kind in KINDS for i in range(15)]\nPath(sys.argv[2]).write_text(json.dumps({'rows':rows,'scenarios':scenarios,'splits':split(rows,.03,.02),'deterministic':rows==build(ctx,{})},ensure_ascii=False),encoding='utf-8')`
  const result = runCli('python3', ['-I', '-c', code, TRAIN, path.join(home, 'bundle.json')])
  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
  data = JSON.parse(fs.readFileSync(path.join(home, 'bundle.json'), 'utf8'))
})
afterAll(() => { if (home) removeDir(home) })

describe('v5 independent grounded constraint training', () => {
  it('builds 480 deterministic records in 120 whole scenario groups', () => {
    expect(data.deterministic).toBe(true)
    expect(data.rows).toHaveLength(480)
    expect(new Set(data.rows.map((row) => row.id)).size).toBe(480)
    const groups = new Map<string, Row[]>()
    for (const row of data.rows) groups.set(row.key, [...(groups.get(row.key) ?? []), row])
    expect(groups.size).toBe(120)
    expect([...groups.values()].every((rows) => rows.length === 4)).toBe(true)
    expect(new Set(data.rows.map((row) => row.kind)).size).toBe(8)
    expect(data.rows.every((row) => row.set === 'constraints' && row.license.includes('synthetic'))).toBe(true)
    for (const part of data.splits) expect(part.length).toBeGreaterThan(0)
    const splitKeys = data.splits.map((rows) => new Set(rows.map((row) => row.key)))
    for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) expect([...splitKeys[a]].filter((key) => splitKeys[b].has(key))).toEqual([])
  })

  it('retains every full condition and distractor in every current prompt', () => {
    const snapshot = JSON.parse(fs.readFileSync(path.join(TRAIN, 'assistant_prompt.json'), 'utf8'))
    for (const scenario of data.scenarios) {
      for (let variant = 0; variant < 4; variant += 1) {
        const row = rowFor(scenario, variant)
        expect(row.messages[0].content).toBe(snapshot.system.ru)
        const current = row.messages.at(-2)!.content
        for (const card of scenario.cards) {
          expect(current).toContain(card.snippet)
          expect(current).toContain(card.url)
          expect(card.snippet.length).toBeLessThanOrEqual(400)
          expect(card.title).toMatch(/^Учебный /)
          expect(card.url).toMatch(/\/train-constraints-/)
        }
        expect(current.split('Вопрос посетителя: ').at(-1)!.length).toBeLessThanOrEqual(500)
      }
    }
  })

  it('changes card order without changing the correct answer identity', () => {
    for (const scenario of data.scenarios.filter((item) => ['date_time', 'rain_budget', 'wheelchair', 'lowvision'].includes(item.kind) && !/^(Не успеете|Ни один)/.test(target(rowFor(item))))) {
      const positions = new Set<number>()
      const correct = selectedCard(scenario)
      for (let variant = 0; variant < 4; variant += 1) {
        const row = rowFor(scenario, variant)
        expect(selectedCard(scenario, row).url).toBe(correct.url)
        const heads = row.messages.at(-2)!.content.split('\n').filter((line) => /^\[\d\]/.test(line))
        positions.add(heads.findIndex((line) => line.includes(correct.url)))
      }
      expect([...positions].sort()).toEqual([0, 1, 2])
    }
  })

  it('uses opening dates and exact remaining minutes, rejecting two different near misses', () => {
    for (const scenario of data.scenarios.filter((item) => item.kind === 'date_time' && target(rowFor(item)).startsWith('Подходит'))) {
      const req = scenario.requirements
      const card = selectedCard(scenario)
      const remaining = Number(card.facts.closes) - Number(req.arrival)
      expect(String(card.facts.opens) <= String(req.date)).toBe(true)
      expect(Number(card.facts.opens_at)).toBeLessThanOrEqual(Number(req.arrival))
      expect(card.snippet).toContain('Часы работы 09:00–')
      expect(remaining).toBeGreaterThanOrEqual(Number(card.facts.duration))
      expect(target(rowFor(scenario))).toContain(`До закрытия ${remaining} мин.`)
      expect(target(rowFor(scenario))).toContain(`осмотр занимает ${card.facts.duration} мин.`)
      expect(String(scenario.cards[1].facts.opens) > String(req.date)).toBe(true)
      expect(Number(scenario.cards[1].facts.closes) - Number(req.arrival)).toBeGreaterThanOrEqual(Number(scenario.cards[1].facts.duration))
      expect(String(scenario.cards[2].facts.opens) <= String(req.date)).toBe(true)
      expect(Number(scenario.cards[2].facts.closes) - Number(req.arrival)).toBeLessThan(Number(scenario.cards[2].facts.duration))
      expect(String(req.date)).toMatch(/^2026-(11|12)-/)
    }
  })

  it('teaches a negative temporal answer when every already-open visit exceeds the remaining time', () => {
    const negatives = data.scenarios.filter((item) => item.kind === 'date_time' && Number(item.cards[0].facts.closes) - Number(item.requirements.arrival) < Number(item.cards[0].facts.duration))
    expect(negatives).toHaveLength(5)
    for (const scenario of negatives) {
      const remaining = Number(scenario.cards[0].facts.closes) - Number(scenario.requirements.arrival)
      expect(Number(scenario.cards[2].facts.closes) - Number(scenario.requirements.arrival)).toBeLessThan(Number(scenario.cards[2].facts.duration))
      expect(String(scenario.cards[1].facts.opens) > String(scenario.requirements.date)).toBe(true)
      for (let variant = 0; variant < 4; variant += 1) {
        const answer = target(rowFor(scenario, variant))
        expect(answer).toContain(`до закрытия ${remaining} мин., осмотр ${scenario.cards[0].facts.duration} мин.`)
        expect(answer).toContain('Не успеете')
        expect(answer).toContain('Подходящего варианта нет')
        expect(answer).not.toMatch(/бюджет|помещен|руб\./)
      }
    }
  })

  it('does not infer opening hours from the calendar date and respects exact time boundaries', () => {
    const code = `import sys\nsys.path.insert(0,sys.argv[1])\nfrom sets.constraints import make_scenario,eligible\ns=make_scenario('date_time',0)\nf=s['cards'][0]['facts']\ns['requirements']['arrival']=f['opens_at']-1\nassert eligible(s,f) is False\ns['requirements']['arrival']=f['opens_at']\nassert eligible(s,f) is True\ns['requirements']['arrival']=f['closes']-f['duration']\nassert eligible(s,f) is True\ns['requirements']['arrival']+=1\nassert eligible(s,f) is False`
    const result = runCli('python3', ['-I', '-c', code, TRAIN])
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })

  it('does not turn a wide door or an easy/family label into a continuous accessible route', () => {
    for (const scenario of data.scenarios.filter((item) => item.kind === 'wheelchair')) {
      const card = selectedCard(scenario)
      expect(card.facts.continuous_stepfree).toBe(true)
      expect(Number(card.facts.route_width)).toBeGreaterThanOrEqual(Number(scenario.requirements.device_width))
      expect(scenario.cards[1].facts.continuous_stepfree).toBe(true)
      expect(Number(scenario.cards[1].facts.route_width)).toBeLessThan(Number(scenario.requirements.device_width))
      expect(Number(scenario.cards[2].facts.route_width)).toBeGreaterThanOrEqual(Number(scenario.requirements.device_width))
      expect(scenario.cards[2].facts.continuous_stepfree).toBe(false)
      expect(target(rowFor(scenario))).toContain('не гарантия всех аспектов доступности')
    }
  })

  it('satisfies every rain/budget/time requirement or has one explicit failing condition per option', () => {
    for (const scenario of data.scenarios.filter((item) => ['rain_budget', 'none_fit'].includes(item.kind))) {
      const violations = scenario.cards.map((card) => [
        card.facts.indoor !== true,
        Number(card.facts.cost) > Number(scenario.requirements.budget),
        Number(card.facts.duration) > Number(scenario.requirements.max_duration),
      ].filter(Boolean).length)
      expect(violations).toEqual(scenario.kind === 'none_fit' ? [1, 1, 1] : [0, 1, 1])
      if (scenario.kind === 'rain_budget') {
        expect(selectedCard(scenario).url).toBe(scenario.cards[0].url)
        expect(target(rowFor(scenario))).toContain(`вход ${scenario.cards[0].facts.cost} руб.`)
      }
    }
  })

  it('keeps gurney dimensions unknown and distinguishes unknown metadata from no feasible option', () => {
    const gurney = data.rows.filter((row) => row.kind === 'gurney_unknown')
    expect(gurney).toHaveLength(60)
    for (const row of gurney) {
      expect(target(row)).toContain('Подтвердить проезд нельзя')
      expect(target(row)).toContain('ширина и длина санитарной каталки')
      expect(target(row)).toContain('размеры всех проходов и поворотов')
      expect(target(row)).not.toContain('http')
    }
    for (const scenario of data.scenarios.filter((item) => item.kind === 'unknown_info' && item.requirements.requested === 'child_price')) {
      const row = rowFor(scenario)
      expect(target(row)).toContain('нет детского тарифа')
      expect(target(row)).toContain('назвать нельзя')
      expect(target(row)).not.toMatch(/\d+ руб/)
    }
    for (const row of data.rows.filter((item) => item.kind === 'none_fit')) {
      expect(target(row)).toContain('Ни один вариант не подходит')
      expect(target(row)).not.toContain('нужно уточнить')
      expect(target(row)).not.toContain('http')
    }
  })

  it('distinguishes solo access from required accompaniment and only charges actual visitors', () => {
    const scenarios = data.scenarios.filter((item) => item.kind === 'lowvision')
    expect(scenarios.some((scenario) => scenario.requirements.has_companion === true)).toBe(true)
    expect(scenarios.some((scenario) => scenario.requirements.has_companion === false)).toBe(true)
    for (const scenario of scenarios.filter((item) => !target(rowFor(item)).startsWith('Ни один'))) {
      const card = selectedCard(scenario)
      expect(Boolean(card.facts.audio || card.facts.tactile)).toBe(true)
      const hasCompanion = scenario.requirements.has_companion === true
      const total = Number(card.facts.cost) + (hasCompanion ? Number(card.facts.companion_cost) : 0)
      expect(total).toBeLessThanOrEqual(Number(scenario.requirements.budget))
      expect(target(rowFor(scenario))).toContain(`${hasCompanion ? 'Вместе' : 'Билет'} ${total} руб.`)
      if (!hasCompanion) {
        expect(card.facts.allows_solo).toBe(true)
        expect(card.facts.requires_companion).toBe(false)
        expect(target(rowFor(scenario))).toContain('самостоятельное посещение разрешено')
        expect(scenario.cards[1].facts.audio).toBe(true)
        expect(scenario.cards[1].facts.requires_companion).toBe(true)
        expect(target(rowFor(scenario))).not.toContain(scenario.cards[1].url)
      }
    }
    const negatives = scenarios.filter((scenario) => target(rowFor(scenario)).startsWith('Ни один'))
    expect(negatives).toHaveLength(3)
    for (const scenario of negatives) {
      expect(scenario.requirements.has_companion).toBe(false)
      for (const index of [0, 2]) expect(Number(scenario.cards[index].facts.cost)).toBeGreaterThan(Number(scenario.requirements.budget))
      expect(scenario.cards[1].facts.requires_companion).toBe(true)
      expect(target(rowFor(scenario))).toContain('требует сопровождающего')
      expect(target(rowFor(scenario))).toContain('самостоятельные варианты дороже бюджета')
    }
  })

  it('keeps specific weather/access unknown while still answering the known duration constraint', () => {
    const scenarios = data.scenarios.filter((item) => item.kind === 'unknown_info')
    for (const requested of ['child_price', 'forecast', 'access']) expect(scenarios.filter((scenario) => scenario.requirements.requested === requested)).toHaveLength(5)
    for (const scenario of scenarios.filter((item) => item.requirements.requested !== 'child_price')) {
      for (let variant = 0; variant < 4; variant += 1) {
        const row = rowFor(scenario, variant)
        const firstUrl = row.messages.at(-2)!.content.split('\n').find((line) => /^\[1\]/.test(line))!
        const card = scenario.cards.find((item) => firstUrl.includes(item.url))!
        const answer = target(row)
        expect(answer).toContain(`${card.facts.duration} мин. при лимите ${scenario.requirements.max_duration} мин.`)
        expect(answer).toContain(Number(card.facts.duration) <= Number(scenario.requirements.max_duration) ? '— укладывается' : '— не укладывается')
        if (scenario.requirements.requested === 'forecast') {
          expect(answer).toContain('Прогноз дождя')
          expect(answer).toContain('обещать сухую погоду нельзя')
          expect(card.facts.forecast).toBeNull()
        } else {
          expect(answer).toContain('самостоятельное посещение не подтверждены карточкой')
          expect(answer).toContain('не означает, что их нет')
          expect(card.facts.audio).toBeNull()
          expect(card.facts.allows_solo).toBeNull()
        }
        expect(answer).not.toContain('нет статьи')
      }
    }
  })

  it('grounds a five-message follow-up in the prior ordered answer rather than current source order', () => {
    for (const scenario of data.scenarios.filter((item) => item.kind === 'followup')) {
      for (let variant = 0; variant < 4; variant += 1) {
        const row = rowFor(scenario, variant)
        expect(row.messages.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user', 'assistant'])
        const prior = row.messages[2].content
        expect(prior.indexOf(scenario.cards[0].url)).toBeLessThan(prior.indexOf(scenario.cards[1].url))
        expect(target(row)).toContain(scenario.cards[1].url)
        expect(target(row)).not.toContain(scenario.cards[0].url)
        expect(target(row)).toContain(`${scenario.cards[1].facts.duration} мин.`)
        expect(row.messages[3].content).toContain('втор')
      }
    }
  })
})
