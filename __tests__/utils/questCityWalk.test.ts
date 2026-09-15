/**
 * #1569: собственное содержание посадочной города.
 *
 * Модель общая для сборки и приложения, поэтому проверяется именно она: что
 * именно попадает на страницу, чего на ней не должно быть ни при каких данных и
 * почему набор квестов обязан совпасть у краулера и у человека.
 */
const {
  QUEST_CITY_WALK_QUEST_LIMIT,
  buildQuestCityWalkModel,
  questCityWalkHasContent,
  questCityWalkQuestIds,
} = require('@/utils/questCityWalk')
const { buildQuestRouteDigest } = require('@/scripts/generate-seo-pages')

const step = (overrides: Record<string, unknown> = {}) => ({
  step_id: 'p1',
  title: 'Ратуша',
  location: 'Площадь Свободы',
  story: [
    'Ратуша на рыночной площади считается старейшей сохранившейся в стране.',
    'Её восстановили в две тысячи четвёртом году по старым обмерным чертежам.',
    'Внутри работает городской музей с коллекцией старых городских печатей.',
  ].join(' '),
  answer_pattern: { type: 'any_text' },
  ...overrides,
})

const bundle = (steps: unknown[], overrides: Record<string, unknown> = {}) => ({
  quest_id: 'minsk-center',
  title: 'Квест по Минску',
  intro: { location: 'Вокзал', story: 'Вступление.' },
  steps,
  ...overrides,
})

const QUEST = {
  quest_id: 'minsk-center',
  city_id: '4',
  title: 'Квест по Минску',
  points: 3,
  duration_min: 90,
  difficulty: 'medium',
  pet_friendly: true,
}

describe('buildQuestCityWalkModel', () => {
  it('публикует хвост рассказа — то, чего нет в дайджесте страницы квеста', () => {
    const questBundle = bundle([step()])
    const model = buildQuestCityWalkModel([QUEST], new Map([['minsk-center', questBundle]]))

    const published = model.places.flatMap((place: { sentences: string[] }) => place.sentences)
    const onQuestPage = buildQuestRouteDigest(questBundle).flatMap(
      (point: { sentences: string[] }) => point.sentences,
    )

    expect(published).toEqual([
      'Внутри работает городской музей с коллекцией старых городских печатей.',
    ])
    for (const sentence of onQuestPage) expect(published).not.toContain(sentence)
  })

  it('читает и сырой каталог сборки, и адаптированный каталог приложения', () => {
    const questBundle = bundle([step()])
    const bundles = new Map([['minsk-center', questBundle]])

    const fromBuild = buildQuestCityWalkModel([QUEST], bundles)
    const fromApp = buildQuestCityWalkModel(
      [
        {
          id: 'minsk-center',
          cityId: '4',
          title: 'Квест по Минску',
          points: 3,
          durationMin: 90,
          difficulty: 'medium',
          petFriendly: true,
        },
      ],
      bundles,
    )

    expect(fromApp.places).toEqual(fromBuild.places)
    expect(fromApp.routes).toEqual(fromBuild.routes)
  })

  it('снимает инструкции идущему, вопросы и второе лицо', () => {
    const model = buildQuestCityWalkModel(
      [QUEST],
      new Map([
        [
          'minsk-center',
          bundle([
            step({
              story: [
                'Первое предложение о ратуше уходит на страницу квеста целиком.',
                'Второе предложение о ратуше тоже достаётся странице квеста.',
                'Пересчитай башенки на её крыше и запомни получившееся число.',
                'А что находится под самым шпилем ратуши в наши дни?',
                'Если приглядишься, увидишь герб города прямо над входом.',
                'Городские власти собирались здесь больше четырёх столетий подряд.',
              ].join(' '),
            }),
          ]),
        ],
      ]),
    )

    expect(model.places[0].sentences).toEqual([
      'Городские власти собирались здесь больше четырёх столетий подряд.',
    ])
  })

  /**
   * На карточке шага чужой ответ игроку не показывают, а страницу города он
   * читает целиком и до выхода: ответ соседней точки раскрыт так же, как свой.
   */
  it('снимает предложение, раскрывающее ответ соседней точки того же квеста', () => {
    const model = buildQuestCityWalkModel(
      [QUEST],
      new Map([
        [
          'minsk-center',
          bundle([
            step({
              step_id: 'a',
              title: 'Ратуша',
              answer_pattern: { type: 'exact', value: 'флюгер' },
            }),
            step({
              step_id: 'b',
              title: 'Дом губернатора',
              story: [
                'Первое предложение про дом губернатора уходит на страницу квеста.',
                'Второе предложение про дом губернатора тоже достаётся странице квеста.',
                'Над его крышей когда-то стоял такой же флюгер, как на соседней ратуше.',
                'Здание перестраивали дважды, и последний раз это было перед войной.',
              ].join(' '),
            }),
          ]),
        ],
      ]),
    )

    const governor = model.places.find((place: { title: string }) => place.title === 'Дом губернатора')
    expect(governor.sentences).toEqual([
      'Здание перестраивали дважды, и последний раз это было перед войной.',
    ])
  })

  it('снимает номер точки и значок из названия места', () => {
    const model = buildQuestCityWalkModel(
      [QUEST],
      new Map([['minsk-center', bundle([step({ title: '7. ☕ Кофейня на углу' })])]]),
    )

    expect(model.places[0].title).toBe('Кофейня на углу')
  })

  it('выбрасывает точки-заглушки, у которых название повторяется внутри квеста', () => {
    const model = buildQuestCityWalkModel(
      [QUEST],
      new Map([
        [
          'minsk-center',
          bundle([
            step({ step_id: 'a', title: '1. Герой', location: 'Скульптура у входа' }),
            step({ step_id: 'b', title: '2. Герой', location: 'Скульптура у парка' }),
            step({ step_id: 'c', title: 'Ратуша', location: 'Площадь Свободы' }),
          ]),
        ],
      ]),
    )

    expect(model.places.map((place: { title: string }) => place.title)).toEqual(['Ратуша'])
    expect(model.otherPlaces).toEqual([])
  })

  it('не повторяет одну и ту же авторскую фразу дважды на одной странице', () => {
    const shared = [
      'Первое предложение привала достаётся странице квеста без изменений.',
      'Второе предложение привала тоже уходит на страницу квеста.',
      'Здесь можно выпить кофе, перевести дух и идти дальше по маршруту.',
    ].join(' ')
    const model = buildQuestCityWalkModel(
      [QUEST],
      new Map([
        [
          'minsk-center',
          bundle([
            step({ step_id: 'a', title: 'Портофино', story: shared }),
            step({ step_id: 'b', title: 'Мята', story: shared }),
          ]),
        ],
      ]),
    )

    expect(model.places.map((place: { title: string }) => place.title)).toEqual(['Портофино'])
    expect(model.otherPlaces).toEqual(['Мята'])
  })

  it('считает структуру маршрута из бандла и каталога', () => {
    const model = buildQuestCityWalkModel(
      [QUEST],
      new Map([
        [
          'minsk-center',
          bundle([
            step({ step_id: 'a', point_role: 'required', poi_info: { is_museum: true } }),
            step({ step_id: 'b', title: 'Кофейня', point_role: 'optional' }),
          ]),
        ],
      ]),
    )

    expect(model.routes).toEqual([
      expect.objectContaining({
        questId: 'minsk-center',
        title: 'Квест по Минску',
        pointCount: 3,
        optionalCount: 1,
        museumCount: 1,
        durationMin: 90,
        difficulty: 'medium',
        petFriendly: true,
        startLocation: 'Вокзал',
      }),
    ])
  })

  /**
   * Приложение тянет ровно те бандлы, которые выбрала сборка. Разойдись выбор —
   * человек после гидратации прочитал бы про другие места, чем краулер.
   */
  it('выбирает один и тот же набор квестов независимо от порядка каталога', () => {
    const catalog = ['minsk-c', 'minsk-a', 'minsk-d', 'minsk-b'].map((quest_id) => ({
      quest_id,
      city_id: '4',
      title: quest_id,
    }))

    expect(questCityWalkQuestIds(catalog)).toEqual(['minsk-a', 'minsk-b', 'minsk-c'])
    expect(questCityWalkQuestIds(catalog.slice().reverse())).toEqual(questCityWalkQuestIds(catalog))
    expect(questCityWalkQuestIds(catalog)).toHaveLength(QUEST_CITY_WALK_QUEST_LIMIT)
  })

  it('не выдумывает текст за недоступный бандл', () => {
    const empty = buildQuestCityWalkModel([QUEST], null)

    expect(empty).toEqual({ places: [], otherPlaces: [], routes: [] })
    expect(questCityWalkHasContent(empty)).toBe(false)
    expect(questCityWalkHasContent(buildQuestCityWalkModel([QUEST], new Map([['minsk-center', bundle([step()])]])))).toBe(true)
  })
})
