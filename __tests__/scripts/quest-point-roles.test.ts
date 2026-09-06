// Правило структурных ролей точек квеста (#1802). Правило одно на три
// потребителя — бэкфилл прода, скан-гвардию и заливщик новых квестов, — поэтому
// зафиксировано тестом здесь, а не в каждом из них.
const {
  isOptionalByTitle,
  expectedRoles,
  findRoleMismatches,
  findAuthoringRoleIssues,
  endsWithOptional,
  orderedSteps,
  stepKey,
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

  // #1810 — 🍦 и 🍨 суррогатные пары: без флага `u` класс символов содержал их
  // половинки, и заголовок с мороженым маркером не опознавался.
  it('видит эмодзи-привал целиком, а не половину суррогатной пары', () => {
    const free = '{"type":"any","value":""}'
    expect(isOptionalByTitle(step({ title: '🍦 Мороженое у фонтана', answer_pattern: free }))).toBe(true)
    expect(isOptionalByTitle(step({ title: '🍨 Пломбир на набережной', answer_pattern: free }))).toBe(true)
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


/**
 * #1810 — вторая форма входа. Локальный `scripts/<city>-quest-data.js` несёт
 * только авторские поля: ни `id`, ни `order`, ни `is_intro`, ни `point_role`.
 * Правило рассчитывали на прод-бандл, и на этой форме оно врало: `Map` по
 * `step.id` схлопывался в одну запись с ключом `undefined`, а компаратор
 * `Number(a.order) - Number(b.order)` возвращал `NaN` на каждой паре.
 */
const localStep = (over: Record<string, unknown> = {}) => ({
  step_id: 'point-1',
  title: 'Обычная точка',
  answer_pattern: '{"type":"exact_any","value":["1"]}',
  ...over,
})

describe('#1810 — форма локального файла квеста (без id/order/point_role)', () => {
  const localSteps = [
    localStep({ step_id: '1-mechet', title: 'Центральная мечеть' }),
    localStep({ step_id: '2-bazar', title: 'Зелёный базар' }),
    localStep({
      step_id: '3-privat',
      title: 'Привал на полпути (по желанию)',
      answer_pattern: '{"type":"any","value":""}',
    }),
    localStep({ step_id: '4-teatr', title: 'Театр' }),
  ]

  it('каждый шаг получает СВОЙ ключ, а не общий undefined', () => {
    const roles = expectedRoles(localSteps)

    expect(roles.size).toBe(localSteps.length)
    expect([...roles.values()]).toEqual(['required', 'required', 'optional', 'final'])
  })

  it('ключ берётся из step_id, когда первичного id нет', () => {
    expect(stepKey({ id: 77, step_id: 'slug' })).toBe(77)
    expect(stepKey(localStep({ step_id: 'slug' }))).toBe('slug:slug')
    expect(stepKey(localStep({ step_id: 'a' }))).not.toBe(stepKey(localStep({ step_id: 'b' })))
  })

  it('порядок задаёт сам файл, когда order нет ни у одного шага', () => {
    expect(orderedSteps(localSteps).map((s: any) => s.step_id)).toEqual([
      '1-mechet',
      '2-bazar',
      '3-privat',
      '4-teatr',
    ])
    // Финал — последняя точка файла, а не «какая попадётся после NaN-сортировки».
    expect(expectedRoles(localSteps).get('slug:4-teatr')).toBe('final')
  })

  it('финал не уезжает на точку «по желанию», стоящую последней', () => {
    const endsOptional = [
      localStep({ step_id: '1-a', title: 'Первая' }),
      localStep({
        step_id: '2-bar',
        title: '✨ Бар (по желанию)',
        answer_pattern: '{"type":"any","value":""}',
      }),
    ]

    expect(endsWithOptional(endsOptional)).toBe(true)
    expect(expectedRoles(endsOptional).get('slug:2-bar')).toBe('optional')
  })

  it('order у прод-бандла по-прежнему главнее позиции в массиве', () => {
    const shuffled = [
      step({ id: 3, order: 3, title: 'Третья' }),
      step({ id: 1, order: 1, title: 'Первая' }),
      step({ id: 2, order: 2, title: 'Вторая' }),
    ]

    expect(orderedSteps(shuffled).map((s: any) => s.id)).toEqual([1, 2, 3])
  })

  it('расхождение по локальной форме считается по слагу, а не по пустому id', () => {
    const rows = findRoleMismatches({ quest_id: 'demo' }, [
      localStep({ step_id: '1-a', title: 'Первая' }),
      localStep({ step_id: '2-b', title: 'Вторая' }),
    ])

    // Все шаги остаются различимыми: раньше сюда приходило «null → final» на
    // каждый шаг, потому что ожидаемая роль читалась одним общим ключом.
    expect(rows.map((row: any) => [row.stepId, row.want])).toEqual([
      ['1-a', 'required'],
      ['2-b', 'final'],
    ])
    // `order` в авторском файле нет — печатать «NaN» вместо номера нечестно.
    expect(rows.every((row: any) => row.order === null)).toBe(true)
  })
})

describe('#1810 — findAuthoringRoleIssues: что проверяемо ДО заливки', () => {
  const bundle = { quest_id: 'demo-quest' }

  it('молчит на здоровом файле: пустая роль — не находка', () => {
    expect(
      findAuthoringRoleIssues(bundle, [
        localStep({ step_id: '1-a', title: 'Первая точка' }),
        localStep({
          step_id: '2-privat',
          title: 'Привал на полпути (по желанию)',
          answer_pattern: '{"type":"any","value":""}',
        }),
        localStep({ step_id: '3-b', title: 'Финальная точка' }),
      ]),
    ).toEqual([])
  })

  it('показывает ровно ту точку, необязательность которой выведена косвенно', () => {
    const rows = findAuthoringRoleIssues(bundle, [
      localStep({ step_id: '1-a', title: 'Первая точка' }),
      localStep({
        step_id: '2-privat',
        // «(по желанию)» из заголовка убрано, свободный ответ оставлен: игрок
        // читает заголовок и не узнаёт, что точку можно пропустить.
        title: 'Привал на полпути',
        answer_pattern: '{"type":"any","value":""}',
      }),
      localStep({ step_id: '3-b', title: 'Финальная точка' }),
    ])

    expect(rows.map((row: any) => row.stepId)).toEqual(['2-privat'])
    expect(rows[0]).toEqual(
      expect.objectContaining({ questId: 'demo-quest', have: 'implicit-optional' }),
    )
  })

  it('объявленная не-optional роль снимает косвенный признак', () => {
    // Заливщик отдаёт явное поле как есть, игрок увидит «Обязательная точка» —
    // противоречия между словами заголовка и подписью нет, падать не на чем.
    expect(
      findAuthoringRoleIssues(bundle, [
        localStep({
          step_id: '2-cafe',
          title: '☕ Кофейня Zeppelin — где стоял дирижабль',
          point_role: 'required',
          answer_pattern: '{"type":"any","value":""}',
        }),
      ]),
    ).toEqual([])
  })

  it('обычные точки маршрута находкой не считает', () => {
    expect(
      findAuthoringRoleIssues(bundle, [
        localStep({ step_id: '1-a', title: 'Ратуша и её часы' }),
        localStep({ step_id: '2-b', title: 'Кофейня на углу' }),
      ]),
    ).toEqual([])
  })

  /**
   * Второй путь к подписи «Необязательная точка»: `point_role` прямо в шаге
   * data-файла. Заливщик (`migrate-quest-from-file.js` → `pointRoleFor`) отдаёт
   * его на бэкенд как есть, не глядя на заголовок, — значит проверять заголовок
   * обязана гвардия. Так помечают опциональную точку с проверяемым ответом, где
   * иконка привала и свободный ответ не сработают.
   */
  it('видит объявленный point_role: optional при заголовке, который молчит', () => {
    const rows = findAuthoringRoleIssues(bundle, [
      localStep({ step_id: '1-a', title: 'Первая точка' }),
      localStep({
        step_id: '2-muzey',
        title: 'Национальный музей — подарок императрицы под стеклом',
        point_role: 'optional',
      }),
    ])

    expect(rows.map((row: any) => row.stepId)).toEqual(['2-muzey'])
    expect(rows[0]).toEqual(expect.objectContaining({ have: 'point_role: optional' }))
  })

  it('объявленный point_role: optional с «(по желанию)» в заголовке — норма', () => {
    expect(
      findAuthoringRoleIssues(bundle, [
        localStep({
          step_id: '2-muzey',
          title: 'Национальный музей (по желанию)',
          point_role: 'optional',
        }),
      ]),
    ).toEqual([])
  })

  it('point_role: required находкой не делает даже при свободном ответе', () => {
    expect(
      findAuthoringRoleIssues(bundle, [
        localStep({
          step_id: '2-vopros',
          title: 'Точка с плохим вопросом',
          point_role: 'required',
          answer_pattern: '{"type":"any","value":""}',
        }),
      ]),
    ).toEqual([])
  })

  it('точка не удваивается, когда сработали оба признака сразу', () => {
    const rows = findAuthoringRoleIssues(bundle, [
      localStep({
        step_id: '2-privat',
        title: 'Привал на полпути',
        point_role: 'optional',
        answer_pattern: '{"type":"any","value":""}',
      }),
    ])

    expect(rows).toHaveLength(1)
  })
})
