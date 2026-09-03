const {
  ALLOWED_FILES,
  CANONICAL_FILE,
  MULTILINE_MATCH_SPAN,
  findAllowlistProblems,
  evaluateGuard,
  findViolationsInSource,
  isPageCountExpression,
} = require('@/scripts/guard-no-inline-page-fetch-loop')

// Каноническое содержимое владельца правила — во всех сценариях, где проверяется
// evaluateGuard: без него гейт сам обязан падать (см. отдельный тест ниже).
const canonicalSource = {
  filePath: CANONICAL_FILE,
  content: [
    'export function resolveTotalPages({ total, pageSize, maxPages }) {',
    '  if (pageSize <= 0 || total <= pageSize) return 1',
    '  return Math.min(Math.ceil(total / pageSize), maxPages)',
    '}',
  ].join('\n'),
}

describe('guard-no-inline-page-fetch-loop', () => {
  // Ровно та копия, которой календарь показывал «Был (100)» из 318 (#1705).
  it('ловит инлайн-докачку параллельным заходом по диапазону страниц', () => {
    const violations = findViolationsInSource({
      filePath: 'stores/exampleStore.ts',
      content: [
        'const firstPage = await loadPage(1)',
        'const pageSize = firstPage.items.length',
        'const totalPages = Math.min(Math.ceil(firstPage.total / pageSize), MAX_PAGES)',
        'const rest = await Promise.all(',
        '  Array.from({ length: totalPages - 1 }, (_, index) => loadPage(index + 2)),',
        ')',
      ].join('\n'),
    })

    expect(violations).toEqual([
      expect.objectContaining({ file: 'stores/exampleStore.ts', line: 3 }),
    ])
  })

  // Диапазон, разнесённый prettier'ом на три строки, — та самая форма, которую
  // печатает сам проект. Пока признак искался построчно, `Array.from(` и
  // `{ length: … }` оказывались на разных строках, и копия проходила молча.
  it('ловит копию, у которой prettier разнёс диапазон на три строки', () => {
    // Ни `loadPage`, ни `pageSize` в тексте нет: единственный признак — диапазон
    // вплотную к `Promise.all`. Пока он искался построчно, `Array.from(` и
    // `{ length: … }` стояли на разных строках, и копия проходила молча
    // (проверено на версии гейта до правки: 0 нарушений против 1 сейчас).
    const violations = findViolationsInSource({
      filePath: 'stores/prettierStore.ts',
      content: [
        'const first = await http.get(endpoint)',
        'const size = first.items.length',
        'const totalPages = Math.ceil(first.total / size)',
        'const rest = await Promise.all(',
        '  Array.from(',
        '    { length: totalPages - 1 },',
        '    (_, index) => http.get(`${endpoint}?p=${index + 2}`),',
        '  ),',
        ')',
      ].join('\n'),
    })

    expect(violations).toEqual([
      expect.objectContaining({ file: 'stores/prettierStore.ts', line: 3 }),
    ])
  })

  // Признак засчитывается за строку, где конструкция НАЧИНАЕТСЯ. Иначе одно и то
  // же `Array.from` числилось бы ещё и за двумя строками выше, соседство
  // раздувалось бы на ширину среза, и сетка со скелетонами снова стала бы находкой.
  it('не растягивает соседство признаков на ширину многострочного среза', () => {
    // Ровно `MULTILINE_MATCH_SPAN + 1`: на этом расстоянии реализация с привязкой
    // к строке начала даёт 0, а наивная («совпало где угодно в срезе») — 1. При
    // разрыве пошире тест проходил бы на обеих и ничего не проверял.
    const gap = Array.from({ length: MULTILINE_MATCH_SPAN + 1 }, (_, index) => `const filler${index} = ${index}`)

    expect(
      findViolationsInSource({
        filePath: 'components/Grid.tsx',
        content: [
          'const columns = 3',
          'const totalPages = Math.ceil(totalItems / columns)',
          'const skeletons = Array.from({ length: 6 }, (_, index) => index)',
          ...gap,
          'void Promise.all([preloadCovers(), preloadAvatars()])',
        ].join('\n'),
      }),
    ).toEqual([])
  })

  // Имя параметра `page` в теле запроса — обычная форма DRF-клиента, и без него
  // маркер чтения страниц пропускал копию, у которой между диапазоном и
  // `Promise.all` вклинился guard clause.
  it('считает чтением страниц параметр `page` в теле запроса', () => {
    // Признак fan-out здесь не работает: между диапазоном и `Promise.all`
    // вклинились guard clause и две строки, соседство разорвано. Держит копию
    // ровно маркер `page:` в параметрах запроса — обычная форма DRF-клиента
    // (до правки словарь маркеров его не знал: 0 нарушений против 1 сейчас).
    const violations = findViolationsInSource({
      filePath: 'api/exampleClient.ts',
      content: [
        'const first = await http.get(endpoint, { params: { page: 1 } })',
        'const size = first.data.results.length',
        'const totalPages = Math.ceil(first.data.count / size)',
        'const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)',
        'if (restPages.length === 0) return first.data.results',
        'const a = 1',
        'const b = 2',
        'const rest = await Promise.all(restPages.map((p) => http.get(endpoint, { params: { page: p } })))',
      ].join('\n'),
    })

    expect(violations).toHaveLength(1)
  })

  // Размер страницы пишут по-разному, и требование «литерал вплотную к знаку»
  // резало живые формы: все четыре давали 0 нарушений, пока отсечкой не стала
  // фигурная скобка (её несёт JSX-проп) вместо расстояния до литерала.
  it.each([
    ['аннотацию типа', 'const size: number = 100'],
    ['значение по умолчанию через ??', 'const size = opts.size ?? 100'],
    ['приведение с ||', 'const limit = Number(opts.limit) || 100'],
    ['ограничение хвоста', 'const chunk = Math.min(rest, 100)'],
  ])('ловит деление на запрошенный размер страницы, объявленный через %s', (_label, declaration) => {
    expect(
      findViolationsInSource({
        filePath: 'stores/exampleStore.ts',
        content: [
          declaration,
          'const first = await loadPage(1)',
          'const pages = Math.ceil(first.count / 100)',
        ].join('\n'),
      }),
    ).toHaveLength(1)
  })

  // Общеупотребительное имя без присваивания размером страницы не считается:
  // иначе `<Icon size={24} />` рядом с `Math.ceil(count / 24)` стал бы находкой.
  it.each([
    ['JSX-проп размера иконки', '<Icon size={24} />'],
    ['JSX-проп размера чипа', '<Chip size={24} />'],
  ])('не считает нарушением %s', (_label, declaration) => {
    expect(
      findViolationsInSource({
        filePath: 'components/IconRow.tsx',
        content: [
          declaration,
          'const rows = Math.ceil(count / 24)',
          'const items = Array.from({ length: rows }, (_, index) => index)',
          'void Promise.all(items.map((index) => preload(index)))',
        ].join('\n'),
      }),
    ).toEqual([])
  })

  // Последовательная копия теряет хвост ровно так же, поэтому «не Promise.all»
  // от гейта не спасает.
  it('ловит и последовательную копию того же правила', () => {
    const violations = findViolationsInSource({
      filePath: 'api/exampleList.ts',
      content: [
        'const pages = Math.ceil(count / perPage)',
        'for (let page = 2; page <= pages; page += 1) {',
        '  items.push(...(await apiClient.get(`/example/?page=${page}`)))',
        '}',
      ].join('\n'),
    })

    expect(violations).toHaveLength(1)
  })

  // Словарь имён делителя копию не ловил: размер страницы зовут и `pageSize`,
  // и `size`, и `chunk`. Отсечка идёт по числителю и по контексту, а не по имени.
  it.each([
    ['size', 'const size = first.items.length', 'Math.ceil(first.total / size)'],
    ['chunk', 'const chunk = first.items.length', 'Math.ceil(first.count / chunk)'],
  ])('ловит копию, где размер страницы назван «%s»', (_label, sizeLine, countLine) => {
    const violations = findViolationsInSource({
      filePath: 'hooks/useExampleAll.ts',
      content: [
        'const first = await loadPage(1)',
        sizeLine,
        `const pages = ${countLine}`,
        'const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => loadPage(i + 2)))',
      ].join('\n'),
    })

    expect(violations).toHaveLength(1)
  })

  // Признак параллельной докачки не должен зависеть от форматирования: обе
  // записи ниже — тот же цикл, просто диапазон вынесен или собран через spread.
  it.each([
    [
      'диапазон вынесен в переменную',
      [
        'const restPages = Array.from({ length: pages - 1 }, (_, i) => i + 2)',
        'const rest = await Promise.all(restPages.map((p) => loadItems({ page: p })))',
      ],
    ],
    [
      'диапазон собран через [...Array(n)]',
      ['const rest = await Promise.all([...Array(pages - 1)].map((_, i) => loadItems({ page: i + 2 })))'],
    ],
  ])('ловит параллельную докачку, где %s', (_label, tail) => {
    const violations = findViolationsInSource({
      filePath: 'hooks/useExampleAll.ts',
      content: [
        'const first = await loadItems({ page: 1 })',
        'const pages = Math.ceil(first.total / first.items.length)',
        ...tail,
      ].join('\n'),
    })

    expect(violations).toHaveLength(1)
  })

  // Числовой делитель сам по себе ничего не значит: `count / 3` — это раскладка
  // по колонкам, и краснеть на ней только из-за слова `pageSize` рядом нельзя.
  it.each([
    ['раскладку по колонкам', ['const pageSize = 20', 'const rows = Math.ceil(count / 3)']],
    ['половину от total', ['const half = Math.ceil(total / 2)', 'const onMore = () => loadPage(2)']],
    // Сетка со скелетонами `Array.from({length: 6})` и НЕ связанным с ней
    // `Promise.all` прелоада — не докачка: у настоящего fan-out по страницам
    // диапазон стоит вплотную к вызову.
    [
      'сетку со скелетонами и прелоадом',
      [
        'const columns = 3',
        'const totalPages = Math.ceil(totalItems / columns)',
        'const skeletons = Array.from({ length: 6 }, (_, index) => index)',
        'const a = 1',
        'const b = 2',
        'const c = 3',
        'void Promise.all([preloadCovers(), preloadAvatars()])',
      ],
    ],
  ])('не считает нарушением %s', (_label, content) => {
    expect(findViolationsInSource({ filePath: 'components/Example.tsx', content: content.join('\n') })).toEqual([])
  })

  // Зато деление на ЗАПРОШЕННЫЙ размер страницы — ровно дефект #1705: сервер
  // урезал страницу своим потолком, а клиент поделил на то, что просил.
  // Словарь имён размера страницы обязан покрывать те же написания, что и в
  // рассуждении выше: страницу зовут `perPage`, `size`, `chunk` и `limit`.
  it.each([
    ['perPage', ['const perPage = 100', 'const pages = Math.ceil(total / 100)', 'await loadPage(2)']],
    ['chunk', ['const chunk = 100', 'const first = await loadPage(1)', 'const pages = Math.ceil(first.total / 100)']],
    ['limit', ['const limit = 20', 'const pages = Math.ceil(count / 20)', 'await getPage(2)']],
    ['per_page инлайн-параметром', ['const r = await api.get(url, { per_page: 100 })', 'const pages = Math.ceil(r.total / 100)']],
  ])('ловит деление на запрошенный размер страницы, объявленный рядом как «%s»', (_label, content) => {
    expect(findViolationsInSource({ filePath: 'api/exampleList.ts', content: content.join('\n') })).toHaveLength(1)
  })

  // Голый `await` маркером быть не может: первый же асинхронный хендлер в
  // отрисовочном пагинаторе покрасил бы гейт, и погасить его было бы нечем.
  it('не краснеет на пагинаторе, рядом с которым появился асинхронный хендлер', () => {
    const violations = findViolationsInSource({
      filePath: 'components/ui/ExamplePagination.tsx',
      content: [
        'const onExport = useCallback(async () => { await fetch("/export") }, [])',
        'const pageCount = useMemo(',
        '  () => Math.max(1, Math.ceil((totalItems || 0) / (itemsPerPage || 1))),',
        '  [totalItems, itemsPerPage],',
        ')',
      ].join('\n'),
    })

    expect(violations).toEqual([])
  })

  // Пагинатор считает номерки для отрисовки и ничего не грузит — это не тот
  // класс дефекта, и краснеть на нём гейт не должен.
  it('не трогает расчёт числа страниц для отрисовки пагинатора', () => {
    const violations = findViolationsInSource({
      filePath: 'components/ui/ExamplePagination.tsx',
      content: [
        'const pageCount = useMemo(',
        '  () => Math.max(1, Math.ceil((totalItems || 0) / (itemsPerPage || 1))),',
        '  [totalItems, itemsPerPage],',
        ')',
      ].join('\n'),
    })

    expect(violations).toEqual([])
  })

  it('не считает нарушением цитату формулы в комментарии', () => {
    const violations = findViolationsInSource({
      filePath: 'api/exampleList.ts',
      content: [
        '// Число страниц считает resolveTotalPages: Math.ceil(total / pageSize),',
        '// делить на запрошенный perPage нельзя.',
        'const items = await fetchAllPages(loadPage)',
      ].join('\n'),
    })

    expect(violations).toEqual([])
  })

  it('пропускает потребителя, который берёт правило из общего хелпера', () => {
    const result = evaluateGuard({
      sources: [
        canonicalSource,
        {
          filePath: 'api/exampleList.ts',
          content: [
            "import { resolveTotalPages } from '@/utils/fetchAllPages'",
            'const lastPage = resolveTotalPages({ total, pageSize, maxPages })',
            'const rest = await Promise.all(Array.from({ length: lastPage - 1 }, load))',
          ].join('\n'),
        },
      ],
    })

    expect(result).toEqual(expect.objectContaining({ ok: true, violations: [] }))
  })

  it('падает на четвёртой копии правила', () => {
    const result = evaluateGuard({
      sources: [
        canonicalSource,
        {
          filePath: 'hooks/useExampleAll.ts',
          content: [
            'const first = await loadPage(1)',
            'const totalPages = Math.ceil(first.total / first.items.length)',
          ].join('\n'),
        },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.violations).toEqual([
      expect.objectContaining({ file: 'hooks/useExampleAll.ts', line: 2 }),
    ])
  })

  // Гейт, потерявший владельца правила, молча перестаёт что-либо защищать:
  // такое состояние обязано быть красным, а не зелёным.
  it('падает, если канонический владелец правила больше его не содержит', () => {
    const result = evaluateGuard({
      sources: [{ filePath: CANONICAL_FILE, content: 'export const nothing = 1' }],
    })

    expect(result.ok).toBe(false)
    expect(result.reason).toContain(CANONICAL_FILE)
  })

  it('падает, если канонического файла нет вовсе', () => {
    const result = evaluateGuard({ sources: [] })

    expect(result.ok).toBe(false)
    expect(result.reason).toContain(CANONICAL_FILE)
  })

  // Отдушина есть (гейт эвристический), но платная: у каждой записи обязана быть
  // написанная причина, и требует её сам гейт, а не только этот тест. Проверять
  // контракт на живом списке нельзя — он пуст, и цикл по нему не сделал бы ни
  // одной итерации, оставив зелёный тест, который ничего не доказывает.
  it('считает нарушением запись исключения без написанной причины', () => {
    expect(
      findAllowlistProblems(
        new Map([
          ['components/WithReason.tsx', 'ложное срабатывание на скелетонах, #9999'],
          ['components/NoReason.tsx', '   '],
          ['components/Undefined.tsx', undefined],
        ]),
      ),
    ).toEqual(['components/NoReason.tsx', 'components/Undefined.tsx'])
  })

  it('валит гейт целиком, пока у исключения нет причины', () => {
    const withoutReason = new Map([['components/NoReason.tsx', '']])
    ALLOWED_FILES.set('components/NoReason.tsx', '')
    try {
      const result = evaluateGuard({ sources: [canonicalSource] })
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('components/NoReason.tsx')
      expect(findAllowlistProblems(withoutReason)).toEqual(['components/NoReason.tsx'])
    } finally {
      ALLOWED_FILES.delete('components/NoReason.tsx')
    }
  })

  it('на живом списке исключений нарушений контракта нет', () => {
    expect(findAllowlistProblems()).toEqual([])
  })

  it.each([
    ['total / pageSize', true],
    ['count / perPage', true],
    ['firstPage.total / items.length', true],
    ['first.total / size', true],
    ['wordCount / 200', false],
    ['durationMs / 1000', false],
    ['total / 2', true],
  ])('распознаёт «%s» как расчёт числа страниц: %s', (expression, expected) => {
    expect(isPageCountExpression(expression)).toBe(expected)
  })
})
