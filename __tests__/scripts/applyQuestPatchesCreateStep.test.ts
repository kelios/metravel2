/**
 * #2423: новая обязательная точка квеста через `apply-quest-patches.js`.
 * Квест с точками меньше пола добирается вставкой, а не удалением шагов:
 * order новой точки — сразу за `after_step_id`, хвост сдвигается двухфазно,
 * чтобы unique (quest, order) не сработал посреди сдвига.
 */

const { applyCreate, applyPatch, applyReorder, planInsert, validateCreate } = require('@/scripts/apply-quest-patches')

const STEPS = [
  { id: 10, step_id: 'intro', order: 0, is_intro: true },
  { id: 11, step_id: 'a', order: 1, point_role: 'required' },
  { id: 12, step_id: 'b', order: 2, point_role: 'required' },
  { id: 13, step_id: 'c', order: 3, point_role: 'final' },
]

const SPEC = {
  step_id: 'new-point',
  title: 'Новая точка',
  location: 'Площадь',
  story: 'История.',
  task: 'Что написано на табличке?',
  answer_pattern: JSON.stringify({ type: 'exact', value: 'слово' }),
  lat: 52.1,
  lng: 23.7,
}

const patch = (over = {}) => ({ quest_id: 'q', quest_db_id: 7, after_step_id: 'a', create_step: { ...SPEC }, ...over })

describe('apply-quest-patches create_step #2423', () => {
  it('planInsert ставит точку за after_step_id и сдвигает хвост на +1', () => {
    const plan = planInsert(STEPS, 'a')
    expect(plan.order).toBe(2)
    expect(plan.shifts).toEqual([
      { pk: 12, step_id: 'b', from: 2, to: 3 },
      { pk: 13, step_id: 'c', from: 3, to: 4 },
    ])
    expect(plan.tempOrder).toBe(5003)
  })

  it('после финальной точки и после несуществующей вставлять нельзя', () => {
    expect(() => planInsert(STEPS, 'c')).toThrow('финальная')
    expect(() => planInsert(STEPS, 'zzz')).toThrow('нет точки zzz')
    expect(() => planInsert(STEPS, 'intro')).toThrow('нет точки intro')
  })

  it('validateCreate требует поля, запрещает order и роль final', () => {
    const ok = validateCreate(patch(), 'f')
    expect(ok.payload).toMatchObject({
      step_id: 'new-point', point_role: 'required', is_intro: false, input_type: 'text',
      maps_url: 'https://maps.google.com/?q=52.1,23.7',
    })
    expect(() => validateCreate(patch({ create_step: { ...SPEC, story: ' ' } }), 'f')).toThrow('пустое story')
    expect(() => validateCreate(patch({ create_step: { ...SPEC, order: 3 } }), 'f')).toThrow('after_step_id')
    expect(() => validateCreate(patch({ create_step: { ...SPEC, point_role: 'final' } }), 'f')).toThrow('required|optional')
    expect(() => validateCreate(patch({ create_step: { ...SPEC, step_id: 'Bad Id' } }), 'f')).toThrow('кривой step_id')
    expect(() => validateCreate(patch({ after_step_id: undefined }), 'f')).toThrow('after_step_id')
    expect(() => validateCreate(patch({ create_step: { ...SPEC, answer_pattern: '{"type":"nope"}' } }), 'f')).toThrow('неизвестный type')
  })

  const bundle = (steps = STEPS) => ({
    id: 7,
    intro: { ...steps[0] },
    steps: steps.slice(1),
  })

  function recorder() {
    const calls: Array<[string, string, Record<string, unknown>]> = []
    const session = {
      request: async (endpoint: string, { method, json }: { method: string; json: Record<string, unknown> }) => {
        calls.push([method, endpoint, json])
        return { ok: true, json: async () => (method === 'POST' ? { id: 99 } : {}) }
      },
    }
    return { calls, transport: { api: 'https://x', session, dryRun: false } }
  }

  it('POST с временным order, затем хвост через +10000 и точка на своё место', async () => {
    const { calls, transport } = recorder()
    const res = await applyCreate(patch(), 'f', transport, { fetchBundle: async () => [bundle()] })
    expect(res.skipped).toBe(false)
    expect(calls.map(([m, e, j]) => `${m} ${e} ${j.order}`)).toEqual([
      'POST /api/quest-steps/ 5003',
      'PATCH /api/quest-steps/12/ 10002',
      'PATCH /api/quest-steps/13/ 10003',
      'PATCH /api/quest-steps/12/ 3',
      'PATCH /api/quest-steps/13/ 4',
      'PATCH /api/quest-steps/99/ 2',
    ])
    expect(calls[0][2]).toMatchObject({ quest: 7, step_id: 'new-point', point_role: 'required' })
  })

  it('step_id уже на проде — повтор не создаёт точку второй раз', async () => {
    const { calls, transport } = recorder()
    const withNew = [...STEPS, { id: 99, step_id: 'new-point', order: 2 }]
    const res = await applyCreate(patch(), 'f', transport, { fetchBundle: async () => [bundle(withNew)] })
    expect(res.skipped).toBe(true)
    expect(calls).toEqual([])
  })

  it('точка на проде, но не на своём месте — отказ, а не тихий SKIP', async () => {
    const { calls, transport } = recorder()
    const stuck = [...STEPS, { id: 99, step_id: 'new-point', order: 5003 }]
    await expect(applyCreate(patch(), 'f', transport, { fetchBundle: async () => [bundle(stuck)] }))
      .rejects.toThrow('order 5003 ≠ 2')
    expect(calls).toEqual([])
  })

  it('чужой quest_db_id — отказ до записи', async () => {
    const { calls, transport } = recorder()
    await expect(applyCreate(patch({ quest_db_id: 8 }), 'f', transport, { fetchBundle: async () => [bundle()] }))
      .rejects.toThrow('quest_db_id 8')
    expect(calls).toEqual([])
  })

  it('dry-run последовательно моделирует перестановку, две вставки и смену роли без HTTP-записей и мутации снимка', async () => {
    const original = { id: 7, quest_id: 'q', intro: JSON.stringify(STEPS[0]), steps: JSON.stringify(STEPS.slice(1)) }
    const before = JSON.parse(JSON.stringify(original))
    const fetchBundle = jest.fn().mockResolvedValue([original])
    const request = jest.fn()
    const transport = { api: 'https://x', dryRun: true, session: { request } }
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const options = { fetchBundle }
    try {
      await applyReorder({ quest_id: 'q', quest_db_id: 7, reorder: ['b', 'a', 'c'] }, 'f', transport, options)
      await applyCreate(patch(), 'f', transport, options)
      await applyCreate(patch({ after_step_id: 'new-point', create_step: { ...SPEC, step_id: 'second-point' } }), 'f', transport, options)
      // This reorder is invalid until the earlier role change is simulated.
      const finalOrder = { quest_id: 'q', quest_db_id: 7, reorder: ['a', 'new-point', 'second-point', 'c', 'b'] }
      await expect(applyReorder(finalOrder, 'f', transport, options)).rejects.toThrow('после финала c')
      await applyPatch({ quest_id: 'q', step_id: 'b', step_db_id: 12, changes: { point_role: 'optional', poi_info: null } }, 'f', transport, options)
      await applyReorder(finalOrder, 'f', transport, options)
      expect((await applyReorder(finalOrder, 'f', transport, options)).skipped).toBe(true)
      expect((await applyCreate(patch(), 'f', transport, options)).skipped).toBe(true)
      expect((await applyCreate(patch({ after_step_id: 'new-point', create_step: { ...SPEC, step_id: 'second-point' } }), 'f', transport, options)).skipped).toBe(true)
      const createdEndpoints = log.mock.calls
        .filter((args) => args[0] === '[DRY] PATCH' && !/\/(11|12|13)\/$/.test(String(args[1])))
        .map((args) => args[1])
      expect(new Set(createdEndpoints).size).toBe(2)
      expect(request).not.toHaveBeenCalled()
      expect(fetchBundle).toHaveBeenCalledTimes(1)
      expect(original).toEqual(before)
      // A new invocation must not inherit the previous invocation's additions.
      await expect(applyReorder(finalOrder, 'f', { ...transport }, options)).rejects.toThrow('лишние new-point,second-point')
    } finally {
      log.mockRestore()
    }
  })
})
