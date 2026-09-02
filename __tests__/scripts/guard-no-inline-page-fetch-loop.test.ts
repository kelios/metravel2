const {
  ALLOWED_FILES,
  CANONICAL_FILE,
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
  ])('не считает нарушением %s', (_label, content) => {
    expect(findViolationsInSource({ filePath: 'components/Example.tsx', content: content.join('\n') })).toEqual([])
  })

  // Зато деление на ЗАПРОШЕННЫЙ размер страницы — ровно дефект #1705: сервер
  // урезал страницу своим потолком, а клиент поделил на то, что просил.
  it('ловит деление на запрошенный размер страницы, объявленный рядом', () => {
    const violations = findViolationsInSource({
      filePath: 'api/exampleList.ts',
      content: [
        'const perPage = 100',
        'const pages = Math.ceil(total / 100)',
        'await loadPage(2)',
      ].join('\n'),
    })

    expect(violations).toHaveLength(1)
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

  // Отдушина есть (гейт эвристический), но платная: у каждой записи обязана
  // быть написанная причина. Сейчас список пуст — своя обвязка докачки
  // допустима, но расчёт числа страниц она берёт из `resolveTotalPages()`.
  it('держит исключения только с написанной причиной', () => {
    expect(Array.from(ALLOWED_FILES.keys())).toEqual([])
    for (const [file, reason] of ALLOWED_FILES) {
      expect(typeof reason === 'string' && reason.trim().length > 0).toBe(true)
      expect(file).toEqual(expect.any(String))
    }
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
