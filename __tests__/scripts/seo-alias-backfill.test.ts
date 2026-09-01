const { backfillOne, detectDamage } = require('@/scripts/seo-alias-backfill')

/**
 * Двойное переименование заводит 301-алиас без бэкенд-миграции (#1252), но
 * платит за это окном, в котором публичная статья живёт под старым адресом.
 * Поэтому здесь проверяется не «получилось», а КАЖДЫЙ способ не навредить:
 * отказ должен быть штатным исходом, а статья — всегда вернуться к себе.
 */
const travel = (over: Record<string, unknown> = {}) => ({
  id: 239,
  slug: 'usadba-trabutishki-i-golubye-ozera-marshrut',
  name: 'Усадьба Трабутишки и Голубые озёра: маршрут',
  publish: true,
  moderation: true,
  gallery: [{ id: 1 }, { id: 2 }],
  coordsMeTravel: [{ id: 1 }],
  description: 'x'.repeat(2000),
  ...over,
})

const OLD = 'usadba-trabutishki-i-poseshchenie-ozer-ilginiya-bolduk-i-karasik'

/** Бэкенд-модель: слаг выводится из имени, алиас рождается при смене слага. */
const fakeBackend = (start = travel()) => {
  const state = { ...start }
  const aliases = new Map<string, string>()
  const calls: string[] = []
  return {
    calls,
    aliases,
    state,
    deps: {
      getTravel: async () => ({ ...state }),
      putName: async (_detail: unknown, name: string) => {
        calls.push(name)
        const oldSlug = state.slug
        // Имя, равное слагу, даёт ровно этот слаг; иначе — исходный слаг статьи.
        state.slug = name === OLD ? OLD : start.slug
        state.name = name
        if (oldSlug !== state.slug) {
          aliases.set(oldSlug, state.slug)
          aliases.delete(state.slug)
        }
        return { status: 200, text: '' }
      },
      verifyAlias: async (oldSlug: string, currentSlug: string) => ({
        ok: aliases.get(oldSlug) === currentSlug,
        status: aliases.has(oldSlug) ? 301 : 404,
        location: aliases.get(oldSlug) || '',
        expected: `/travels/${currentSlug}`,
      }),
      resolveSlug: async (slug: string) =>
        slug === state.slug
          ? { status: 200, id: state.id, location: '' }
          : { status: 404, id: null, location: '' },
      saveBackup: () => '/tmp/backup.json',
    },
  }
}

const run = (backend: ReturnType<typeof fakeBackend>, over: Record<string, unknown> = {}) =>
  backfillOne(
    { id: 239, oldSlug: OLD },
    { sleep: async () => undefined, deps: backend.deps, ...over }
  )

describe('seo-alias-backfill: алиас без миграции', () => {
  it('заводит ровно одну пару old → current и возвращает статью к себе', async () => {
    const backend = fakeBackend()
    const result = await run(backend)

    expect(result.status).toBe('ok')
    expect(backend.state.slug).toBe('usadba-trabutishki-i-golubye-ozera-marshrut')
    expect(backend.state.name).toBe('Усадьба Трабутишки и Голубые озёра: маршрут')
    expect([...backend.aliases.entries()]).toEqual([[OLD, 'usadba-trabutishki-i-golubye-ozera-marshrut']])
  })

  it('не оставляет обратной записи: временный алиас удаляется на шаге B', async () => {
    const backend = fakeBackend()
    await run(backend)

    expect(backend.aliases.has('usadba-trabutishki-i-golubye-ozera-marshrut')).toBe(false)
  })

  it('ничего не делает, если алиас уже живой — статья не трогается', async () => {
    const backend = fakeBackend()
    backend.aliases.set(OLD, backend.state.slug)

    const result = await run(backend)

    expect(result.status).toBe('skipped')
    expect(backend.calls).toEqual([])
  })

  it('в dry-run не отправляет ни одного PUT', async () => {
    const backend = fakeBackend()
    const result = await run(backend, { dryRun: true })

    expect(result.status).toBe('skipped')
    expect(backend.calls).toEqual([])
  })

  // Случай travel 508. Ключевое: отказ ДО первого PUT. Проверка после
  // переименования бесполезна — вернуть статью на слаг с суффиксом нечем,
  // и она осталась бы на новом адресе навсегда.
  it('отказывается ДО единого PUT, если слаг сидит на коллизионном суффиксе', async () => {
    const backend = fakeBackend(
      travel({ id: 508, name: 'Оравский замок над Оравой', slug: 'oravskii-zamok-nad-oravoi-1' })
    )

    const result = await backfillOne(
      { id: 508, oldSlug: 'oravskii-zamok-nad-oravoi-staryi' },
      { sleep: async () => undefined, deps: backend.deps }
    )

    expect(result.status).toBe('skipped')
    expect(backend.calls).toEqual([])
    expect(result.note).toContain('коллизионным суффиксом')
    expect(result.note).toContain('решение владельца')
    expect(backend.state.slug).toBe('oravskii-zamok-nad-oravoi-1')
  })

  it('год в хвосте слага под коллизионное правило не подпадает', async () => {
    const backend = fakeBackend(
      travel({ name: 'Забежув и скалы Юры 1 мая 2025', slug: 'zabezhuv-i-skaly-iury-1-maia-2025' })
    )

    const result = await backfillOne(
      { id: 239, oldSlug: OLD },
      { sleep: async () => undefined, deps: backend.deps }
    )

    expect(result.status).toBe('ok')
  })

  // Живой случай #1689: travel 404 сидит на слаге, который даёт не её заголовок,
  // а прежняя редакция названия. Суффикса `-N` там нет, поэтому прежний гард
  // пропускал статью в прогон, и шаг B увёл бы её на адрес заголовка.
  it('отказывается ДО единого PUT, если заголовок даёт другой слаг (travel 404)', async () => {
    const backend = fakeBackend(
      travel({
        id: 404,
        name: 'Лесное озеро Черный Став и Бобровая Заводь',
        slug: 'lesnoe-ozero-chernyy-stav-i-bobrovyy-basseyn',
      })
    )

    const result = await backfillOne(
      { id: 404, oldSlug: 'lesnoe-ozero-chernyy-stav' },
      { sleep: async () => undefined, deps: backend.deps }
    )

    expect(result.status).toBe('skipped')
    expect(backend.calls).toEqual([])
    expect(result.note).toContain('lesnoe-ozero-chernyi-stav-i-bobrovaia-zavod')
    expect(backend.state.slug).toBe('lesnoe-ozero-chernyy-stav-i-bobrovyy-basseyn')
  })

  it('в dry-run печатает отказ, а не план прогона', async () => {
    const backend = fakeBackend(
      travel({
        id: 404,
        name: 'Лесное озеро Черный Став и Бобровая Заводь',
        slug: 'lesnoe-ozero-chernyy-stav-i-bobrovyy-basseyn',
      })
    )

    const result = await backfillOne(
      { id: 404, oldSlug: 'lesnoe-ozero-chernyy-stav' },
      { sleep: async () => undefined, dryRun: true, deps: backend.deps }
    )

    expect(result.status).toBe('skipped')
    expect(result.note).not.toContain('[dry]')
    expect(result.note).toContain('канонический адрес')
  })

  // Пробой доказывает не правоту предсказания (гард выше уже приравнял его к
  // текущему слагу), а согласие источников: detail и индекс by-slug обязаны
  // сойтись на том, чей это слаг. Разошлись — трогать живую статью нечем.
  it('отказывается ДО единого PUT, если by-slug отдаёт по слагу другую статью', async () => {
    const backend = fakeBackend()
    backend.deps.resolveSlug = async () => ({ status: 200, id: 777, location: '' })

    const result = await run(backend)

    expect(result.status).toBe('skipped')
    expect(backend.calls).toEqual([])
    expect(result.note).toContain('#777')
  })

  // Вторая страховка на случай, когда предсказание слага разошлось с бэкендом и
  // возврат всё же дал другой адрес. Статья уже на чужом URL, поэтому сообщения
  // мало: адрес возвращается тем же приёмом — имя, равное слагу.
  const divergingBackend = () => {
    const backend = fakeBackend()
    backend.deps.putName = async (_d: unknown, name: string) => {
      backend.calls.push(name)
      const previous = backend.state.slug
      // Слаг заголовка «уехал», а слаг как имя по-прежнему даёт сам себя.
      backend.state.slug =
        name === OLD ? OLD : name === travel().slug ? travel().slug : 'sovsem-drugoi-slug'
      backend.state.name = name
      if (previous !== backend.state.slug) backend.aliases.set(previous, backend.state.slug)
      return { status: 200, text: '' }
    }
    return backend
  }

  it('страхует и на возврате: слаг после шага B обязан совпасть с исходным', async () => {
    const backend = divergingBackend()

    const result = await run(backend)

    expect(result.status).toBe('failed')
    expect(result.note).toContain('Канонический адрес живой статьи менять нельзя')
    expect(result.note).toContain('sovsem-drugoi-slug')
  })

  it('возвращает канонический адрес, если шаг B увёл статью на чужой слаг', async () => {
    const backend = divergingBackend()

    const result = await run(backend)

    expect(result.fatal).toBe(true)
    expect(backend.state.slug).toBe(travel().slug)
    expect(backend.calls[backend.calls.length - 1]).toBe(travel().slug)
    expect(result.note).toContain('адрес возвращён')
  })

  it('называет бэкап, если и откат адреса не прошёл', async () => {
    const backend = divergingBackend()
    const diverging = backend.deps.putName
    let call = 0
    backend.deps.putName = async (detail: unknown, name: string) => {
      call += 1
      if (call === 3) return { status: 500, text: 'boom' }
      return diverging(detail, name)
    }

    const result = await run(backend)

    expect(result.status).toBe('failed')
    expect(result.note).toContain('ОТКАТ НЕ УДАЛСЯ')
    expect(result.note).toContain('восстанови из')
    expect(backend.state.slug).toBe('sovsem-drugoi-slug')
  })

  it('откатывает заголовок, если шаг A дал не тот слаг', async () => {
    const backend = fakeBackend()
    backend.deps.putName = async (_d: unknown, name: string) => {
      backend.calls.push(name)
      backend.state.name = name
      backend.state.slug = name === OLD ? `${OLD}-1` : travel().slug // коллизия дала суффикс
      return { status: 200, text: '' }
    }

    const result = await run(backend)

    expect(result.status).toBe('failed')
    expect(result.note).toContain('откачено')
    expect(backend.state.name).toBe('Усадьба Трабутишки и Голубые озёра: маршрут')
  })

  it('не считает успехом отсутствие алиаса, даже когда оба PUT прошли', async () => {
    const backend = fakeBackend()
    backend.deps.verifyAlias = async () => ({ ok: false, status: 404, location: '', expected: '/travels/x' })

    const result = await run(backend)

    expect(result.status).toBe('failed')
    expect(result.note).toContain('алиас не появился')
  })

  it('останавливается и называет бэкап, если шаг B не прошёл — статья осталась на старом адресе', async () => {
    const backend = fakeBackend()
    let call = 0
    const original = backend.deps.putName
    backend.deps.putName = async (detail: unknown, name: string) => {
      call += 1
      if (call === 2) return { status: 500, text: 'boom' }
      return original(detail, name)
    }

    const result = await run(backend)

    expect(result.status).toBe('failed')
    expect(result.note).toContain('восстанови из')
  })
})

describe('seo-alias-backfill: защита контента', () => {
  it('ловит потерю публичности и контента', () => {
    const before = travel()
    expect(detectDamage(before, travel({ publish: false }))).toContain('publish стал false')
    expect(detectDamage(before, travel({ gallery: [{ id: 1 }] }))).toEqual(['галерея сократилась 2 → 1'])
    expect(detectDamage(before, travel({ description: 'x'.repeat(100) }))[0]).toContain('описание сократилось')
  })

  it('чистое переименование повреждением не считается', () => {
    expect(detectDamage(travel(), travel({ name: 'другое имя', slug: 'drugoi-slug' }))).toEqual([])
  })

  // #1649: оба PUT возвращают описание как есть, поэтому испорченное чтение
  // записалось бы в статью. Длина при этом почти не меняется — detectDamage
  // такое пропускает, а пакет обязан встать, а не идти к следующей паре.
  it('останавливает пакет, если описание вернулось с U+FFFD', async () => {
    const clean = 'Усадьба Трабутишки и Голубые озёра: маршрут по Беларуси.'
    const backend = fakeBackend(travel({ description: clean.repeat(40) }))
    const readTravel = backend.deps.getTravel
    let reads = 0
    backend.deps.getTravel = async () => {
      reads += 1
      const detail = await readTravel()
      // Третье чтение — то самое «перечитали после записи».
      if (reads < 3) return detail
      return { ...detail, description: String(detail.description).replace('озёра', 'озе\uFFFD\uFFFDра') }
    }

    const result = await run(backend)

    expect(result.status).toBe('failed')
    expect(result.fatal).toBe(true)
    expect(result.note).toContain('U+FFFD')
    expect(result.note).toContain('откачено')
    // Два шага алиаса + обязательная запись чистого pre-write snapshot.
    expect(backend.calls).toHaveLength(3)
    expect(backend.calls[2]).toBe(travel().name)
  })
})
