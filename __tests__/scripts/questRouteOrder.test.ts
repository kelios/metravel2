/**
 * #2426: крюк маршрута квеста, а не «возврат по 1D-оси».
 *
 * Прежний `quest-geocheck --route-only` проецировал точки на главную ось и
 * считал возвратом любой шаг назад по ней — кольцевой маршрут краснел целиком
 * (72 находки по корпусу, почти все ложные). Теперь крюк — это другой порядок
 * точек между стартом и финалом, который короче; кольцо уже кратчайшее.
 * Необязательные точки (кафе, «классное место») двигаются свободно — в
 * data-файлах они остались в хвосте, хотя на проде стоят по ходу маршрута.
 * Роль — правилом `scripts/lib/questPointRoles.js` (#1802): объявленный
 * `point_role`, иначе обещание в заголовке; свободный ответ роли не задаёт.
 *
 * Здесь же — инструменты исправления: перестановка точек на проде
 * (`apply-quest-patches` `reorder`) и перенос порядка прода в data-файл
 * (`sync-quest-data-from-prod`), которому сигналит `scan-quest-prod-drift`.
 */

const { analyzeRouteOrder } = require('@/scripts/quest-geocheck')
const { applyReorder, planReorder } = require('@/scripts/apply-quest-patches')
const { diffOrder } = require('@/scripts/lib/questProdDiff')
const { reorderByAst } = require('@/scripts/sync-quest-data-from-prod')

const LAT0 = 53.9
const M_PER_LNG = 111320 * Math.cos((LAT0 * Math.PI) / 180)

/** Точка в метрах от начала координат (x — на восток, y — на север). */
const at = (step_id: string, x: number, y = 0, over: Record<string, unknown> = {}) => ({
  step_id,
  title: step_id,
  lat: LAT0 + y / 110540,
  lng: 27.56 + x / M_PER_LNG,
  answer_pattern: { type: 'exact', value: 'x' },
  ...over,
})
const optional = { title: '☕ Кофейня (по желанию)', answer_pattern: { type: 'any', value: '' } }
const ordered = (steps: Array<Record<string, unknown>>) => steps.map((s, i) => ({ ...s, order: i + 1 }))

describe('analyzeRouteOrder — крюк, а не шаг назад по оси', () => {
  it('кольцо без находок: обход по кругу уже кратчайший', () => {
    const ring = Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4
      return at(`p${i}`, 400 * Math.cos(a), 400 * Math.sin(a))
    })
    const route = analyzeRouteOrder(ordered(ring), 150)
    expect(route.analyzed).toBe(true)
    expect(route.backtracks).toEqual([])
    expect(route.suggested_order).toBeNull()
  })

  it('линия с возвратом к старту — крюк и порядок без него', () => {
    const steps = ordered([at('a', 0), at('b', 300), at('c', 600), at('back', 50), at('d', 900), at('e', 1200)])
    const route = analyzeRouteOrder(steps, 150)
    expect(route.backtracks).toHaveLength(1)
    expect(route.backtracks[0]).toMatchObject({ kind: 'relocate', steps: ['4 back'], after: '1 a' })
    expect(route.backtracks[0].gain_m).toBeGreaterThan(1000)
    expect(route.suggested_order).toEqual(['a', 'back', 'b', 'c', 'd', 'e'])
  })

  it('необязательная точка в хвосте уходит по ходу маршрута, финал остаётся последним', () => {
    const steps = ordered([at('a', 0), at('b', 300), at('c', 600), at('final', 900), at('cafe', 150, 0, optional)])
    const route = analyzeRouteOrder(steps, 150)
    expect(route.suggested_order).toEqual(['a', 'cafe', 'b', 'c', 'final'])
  })

  it('обязательная точка за финал не уезжает: старт и финал закреплены', () => {
    // Короче было бы закончить в «b», но финал выбирает автор, а не геометрия.
    // 0→500→900→1000 короче на 500 м, но уводит финал с места — такой порядок не предлагается.
    const steps = ordered([at('start', 0), at('b', 1000), at('c', 900), at('final', 500)])
    const route = analyzeRouteOrder(steps, 150)
    expect(route.analyzed).toBe(true)
    expect(route.backtracks).toEqual([])
  })

  it('выигрыш меньше 5% длинного маршрута — шум метрики, не крюк', () => {
    const steps = ordered([at('a', 0), at('b', 10000), at('c', 10400), at('d', 10200), at('e', 20000)])
    const route = analyzeRouteOrder(steps, 150)
    expect(route.min_gain_m).toBeGreaterThan(1000)
    expect(route.backtracks).toEqual([])
  })

  it('--backtrack-m=0 выключает анализ порядка, длину меряет', () => {
    const route = analyzeRouteOrder(ordered([at('a', 0), at('b', 300), at('c', 600), at('d', 50)]), 0)
    expect(route.analyzed).toBe(false)
    expect(route.length.total_m).toBeGreaterThan(1000)
  })

  it('свободный ответ на обязательной точке не делает её необязательной', () => {
    // Квесты из статей (#1652): `any` стоит на обязательных точках; такая точка
    // в хвосте — финал, и за него обязательные точки не уезжают.
    const free = { answer_pattern: JSON.stringify({ type: 'any', value: '' }) }
    const steps = ordered([at('a', 0), at('b', 300), at('c', 600), at('d', 900), at('last', 150, 0, free)])
    // Считай её кафе — ушла бы ко второй точке с выигрышем ~1 км; финалом она закреплена.
    expect(analyzeRouteOrder(steps, 150).backtracks).toEqual([])
    const declared = ordered([at('a', 0), at('b', 300), at('c', 600), at('final', 900), at('opt', 150, 0, { point_role: 'optional' })])
    expect(analyzeRouteOrder(declared, 150).suggested_order).toEqual(['a', 'opt', 'b', 'c', 'final'])
  })
})

describe('apply-quest-patches reorder', () => {
  const STEPS = [
    { id: 10, step_id: 'intro', order: 0, is_intro: true },
    { id: 11, step_id: 'a', order: 1, point_role: 'required' },
    { id: 12, step_id: 'b', order: 2, point_role: 'required' },
    { id: 13, step_id: 'cafe', order: 3, point_role: 'optional' },
    { id: 14, step_id: 'c', order: 4, point_role: 'final' },
  ]
  const patch = (reorder: string[], over = {}) => ({ quest_id: 'q', quest_db_id: 7, reorder, ...over })
  const bundle = (steps = STEPS) => ({ id: 7, intro: { ...steps[0] }, steps: steps.slice(1) })

  function recorder() {
    const calls: string[] = []
    const session = {
      request: async (endpoint: string, { method, json }: { method: string; json: { order: number } }) => {
        calls.push(`${method} ${endpoint} ${json.order}`)
        return { ok: true, json: async () => ({}) }
      },
    }
    return { calls, transport: { api: 'https://x', session, dryRun: false } }
  }

  it('planReorder раздаёт order 1..n в новой последовательности', () => {
    expect(planReorder(STEPS, ['a', 'cafe', 'b', 'c']).moves).toEqual([
      { pk: 13, step_id: 'cafe', from: 3, to: 2 },
      { pk: 12, step_id: 'b', from: 2, to: 3 },
    ])
  })

  it('состав не совпал или обязательная точка за финалом — отказ', () => {
    expect(() => planReorder(STEPS, ['a', 'b', 'c'])).toThrow('пропущены cafe')
    expect(() => planReorder(STEPS, ['a', 'b', 'cafe', 'c', 'x'])).toThrow('лишние x')
    expect(() => planReorder(STEPS, ['a', 'b', 'b', 'c'])).toThrow('состав точек')
    expect(() => planReorder(STEPS, ['a', 'c', 'b', 'cafe'])).toThrow('после финала c')
    expect(planReorder(STEPS, ['a', 'b', 'c', 'cafe']).moves).toHaveLength(2)
  })

  it('двухфазно: сначала парковка на +10000, потом целевые слоты', async () => {
    const { calls, transport } = recorder()
    const res = await applyReorder(patch(['a', 'cafe', 'b', 'c']), 'f', transport, { fetchBundle: async () => [bundle()] })
    expect(res.skipped).toBe(false)
    expect(calls).toEqual([
      'PATCH /api/quest-steps/13/ 10003',
      'PATCH /api/quest-steps/12/ 10002',
      'PATCH /api/quest-steps/13/ 2',
      'PATCH /api/quest-steps/12/ 3',
    ])
  })

  it('порядок уже стоит — SKIP без записи; упавший прогон досдвигается с парковки', async () => {
    const done = recorder()
    const res = await applyReorder(patch(['a', 'b', 'cafe', 'c']), 'f', done.transport, { fetchBundle: async () => [bundle()] })
    expect(res.skipped).toBe(true)
    expect(done.calls).toEqual([])

    const parked = STEPS.map((s) => (s.step_id === 'cafe' ? { ...s, order: 10003 } : s))
    const resume = recorder()
    await applyReorder(patch(['a', 'cafe', 'b', 'c']), 'f', resume.transport, { fetchBundle: async () => [bundle(parked)] })
    expect(resume.calls).toEqual([
      'PATCH /api/quest-steps/12/ 10002',
      'PATCH /api/quest-steps/13/ 2',
      'PATCH /api/quest-steps/12/ 3',
    ])
  })

  it('упал посреди второй фазы — повтор не даёт двух точек на одном order', async () => {
    // cafe уже на целевом 2, b запаркован на 10002: слот b — 3 по списку, а не 2.
    const midway = STEPS.map((s) => (s.step_id === 'cafe' ? { ...s, order: 2 } : s.step_id === 'b' ? { ...s, order: 10002 } : s))
    const { calls, transport } = recorder()
    await applyReorder(patch(['a', 'cafe', 'b', 'c']), 'f', transport, { fetchBundle: async () => [bundle(midway)] })
    expect(calls).toEqual(['PATCH /api/quest-steps/12/ 3'])
  })

  it('чужой quest_db_id — отказ до записи', async () => {
    const { calls, transport } = recorder()
    await expect(applyReorder(patch(['a', 'b', 'cafe', 'c'], { quest_db_id: 8 }), 'f', transport, { fetchBundle: async () => [bundle()] }))
      .rejects.toThrow('quest_db_id 8')
    expect(calls).toEqual([])
  })
})

describe('порядок точек: data-файл против прода', () => {
  const prod = [
    { step_id: 'intro', order: 0, is_intro: true },
    { step_id: 'a', order: 1 },
    { step_id: 'cafe', order: 2 },
    { step_id: 'b', order: 3 },
    { step_id: 'prod-only', order: 4 },
  ]

  it('diffOrder сравнивает только общие точки и молчит при совпадении', () => {
    expect(diffOrder([{ step_id: 'a' }, { step_id: 'cafe' }, { step_id: 'b' }, { step_id: 'local-only' }], prod)).toBeNull()
    expect(diffOrder([{ step_id: 'a' }, { step_id: 'b' }, { step_id: 'cafe' }], prod)).toEqual({
      local: ['a', 'b', 'cafe'],
      prod: ['a', 'cafe', 'b'],
    })
  })

  it('reorderByAst переставляет объекты шагов целиком, остальное не трогает', () => {
    const text = [
      'module.exports = [',
      '    {',
      "        quest_id: 'q',",
      '        steps: [',
      "            { step_id: 'a', title: 'A' },",
      '            // соседний комментарий остаётся на месте',
      "            { step_id: 'b', title: 'B', story: 'Текст, с запятой.' },",
      "            { step_id: 'cafe', title: 'C' },",
      "            { step_id: 'local-only', title: 'L' },",
      '        ],',
      '    },',
      "    { quest_id: 'other', steps: [{ step_id: 'b' }, { step_id: 'cafe' }] },",
      ']',
    ].join('\n')
    const result = reorderByAst(text, 'q', ['a', 'cafe', 'b', 'prod-only'])
    expect(result.ok).toBe(true)
    const data = new Function('module', `${result.text}; return module.exports`)({ exports: null })
    expect(data[0].steps.map((s: { step_id: string }) => s.step_id)).toEqual(['a', 'cafe', 'b', 'local-only'])
    expect(data[0].steps[2].story).toBe('Текст, с запятой.')
    expect(data[1].steps.map((s: { step_id: string }) => s.step_id)).toEqual(['b', 'cafe'])
    expect(result.text).toContain('// соседний комментарий остаётся на месте')
  })

  it('шаг не литералом объекта — перестановка не делается', () => {
    const text = "const base = { step_id: 'b' }\nmodule.exports = [{ quest_id: 'q', steps: [{ step_id: 'a' }, base] }]"
    expect(reorderByAst(text, 'q', ['b', 'a'])).toEqual({ text, ok: false })
  })
})
