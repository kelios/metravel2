// Правило структурных ролей точек квеста (#1802). Правило одно на три
// потребителя — бэкфилл прода, скан-гвардию и заливщик новых квестов, — поэтому
// зафиксировано тестом здесь, а не в каждом из них.
const {
  isOptionalByTitle,
  expectedRoles,
  findRoleMismatches,
  endsWithOptional,
} = require('@/scripts/lib/questPointRoles')

const step = (over: Record<string, unknown> = {}) => ({
  id: 1,
  step_id: 'point-1',
  title: 'Обычная точка',
  order: 1,
  is_intro: false,
  answer_pattern: '{"type":"exact","value":"1"}',
  point_role: 'required',
  ...over,
})

describe('isOptionalByTitle', () => {
  it('видит обещание «по желанию» в любом написании', () => {
    expect(isOptionalByTitle(step({ title: '☕ Просто Кофе (по желанию)' }))).toBe(true)
    expect(isOptionalByTitle(step({ title: 'Акрополь — по желанию' }))).toBe(true)
    expect(isOptionalByTitle(step({ title: 'Музей, опционально' }))).toBe(true)
  })

  it('не считает необязательной обычную точку маршрута', () => {
    expect(isOptionalByTitle(step({ title: 'Ратуша и её часы' }))).toBe(false)
  })

  it('принимает иконку привала только вместе со свободным ответом', () => {
    const free = { title: '☕ Кофейня на углу', answer_pattern: '{"type":"any","value":""}' }
    const asked = { title: '☕ Кофейня на углу', answer_pattern: '{"type":"exact","value":"кофе"}' }
    expect(isOptionalByTitle(step(free))).toBe(true)
    // Вопросная точка с кофейней в названии остаётся обязательной: иначе под
    // правило попал бы шаг с настоящим вопросом (#1652).
    expect(isOptionalByTitle(step(asked))).toBe(false)
  })

  it('читает answer_pattern и объектом, и строкой', () => {
    expect(isOptionalByTitle(step({ title: 'Привал у реки', answer_pattern: { type: 'any' } }))).toBe(true)
    expect(isOptionalByTitle(step({ title: 'Привал у реки', answer_pattern: 'не json' }))).toBe(false)
  })
})

describe('expectedRoles', () => {
  const steps = [
    step({ id: 10, step_id: 'intro', is_intro: true, order: 0, title: 'Интро' }),
    step({ id: 11, step_id: '1-a', order: 1, title: 'Первая точка' }),
    step({ id: 12, step_id: 'cafe', order: 2, title: '☕ Кофе (по желанию)', answer_pattern: '{"type":"any","value":""}' }),
    step({ id: 13, step_id: '2-b', order: 3, title: 'Последняя точка' }),
  ]

  it('ставит optional по заголовку, final последней точке, required остальным', () => {
    expect([...expectedRoles(steps)]).toEqual([[11, 'required'], [12, 'optional'], [13, 'final']])
  })

  it('интро не трогает — его роль ставит бэкенд', () => {
    expect(expectedRoles(steps).has(10)).toBe(false)
  })

  it('порядок берёт из order, а не из позиции в массиве', () => {
    const shuffled = [steps[3], steps[1], steps[2], steps[0]]
    expect(expectedRoles(shuffled).get(13)).toBe('final')
    expect(expectedRoles(shuffled).get(11)).toBe('required')
  })

  it('не назначает финалом точку, которую сам квест объявил необязательной', () => {
    const endsOptional = [
      step({ id: 21, step_id: '1-a', order: 1, title: 'Первая точка' }),
      step({ id: 22, step_id: 'spot', order: 2, title: '✨ Бар (по желанию)', answer_pattern: '{"type":"any","value":""}' }),
    ]
    expect([...expectedRoles(endsOptional)]).toEqual([[21, 'required'], [22, 'optional']])
    expect(endsWithOptional(endsOptional)).toBe(true)
  })
})

describe('findRoleMismatches', () => {
  it('находит ровно расхождения и молчит на совпадениях', () => {
    const bundle = { quest_id: 'demo-quest' }
    const steps = [
      step({ id: 31, step_id: '1-a', order: 1, title: 'Первая', point_role: 'required' }),
      step({ id: 32, step_id: 'cafe', order: 2, title: 'Кофе (по желанию)', point_role: 'required', answer_pattern: '{"type":"any","value":""}' }),
      step({ id: 33, step_id: '2-b', order: 3, title: 'Финал', point_role: 'final' }),
    ]

    expect(findRoleMismatches(bundle, steps)).toEqual([
      expect.objectContaining({ questId: 'demo-quest', stepId: 'cafe', have: 'required', want: 'optional' }),
    ])
  })

  it('считает расхождением пустую роль', () => {
    const rows = findRoleMismatches({ quest_id: 'demo-quest' }, [
      step({ id: 41, step_id: '1-a', order: 1, point_role: null }),
    ])
    expect(rows).toEqual([expect.objectContaining({ have: null, want: 'final' })])
  })
})
