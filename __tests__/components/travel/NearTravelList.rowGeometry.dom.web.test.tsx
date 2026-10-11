import fs from 'fs'
import path from 'path'
import type React from 'react'

/**
 * #2367: каркас «Рядом» не знает, сколько похожих маршрутов (0–6) придёт с
 * `/near/?perPage=6`. Прод 11.10.2026: каркас — один ряд (430 px на 1280,
 * 330 px на 390), шесть карточек — два ряда / столбец (811 / 1580 px), пустой
 * ответ — 121 px; «Популярные» под секцией уезжали на +380 / +1250 / −310 px.
 *
 * Контракт: высота секции от числа карточек (1–6) не зависит. Карточки и
 * каркасы лежат в ОДНОМ ряду (лишние уходят в горизонтальную прокрутку),
 * разметка вне ряда одинакова для каркаса, 6 и 1 карточки. Пустой ответ ряд
 * не держит (#164, Done gate «без пустого места»): компактное сообщение без
 * каркасов и без плашки — один осознанный сдвиг. Пиксельно (пустое ниже ряда)
 * это проверяет замер страниц ниже.
 *
 * Настоящий серверный рендер react-native-web; пиксельный замер — тех же
 * страниц в Chromium (`MT_NEAR_ROW_OUT=<dir>`).
 */
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let StyleSheet: { getSheet: () => { textContent: string } }
let NearTravelList: React.ComponentType<any>

type NearState = { travels: { id: number; name: string }[]; isLoading: boolean }
let nearState: NearState = { travels: [], isLoading: true }
let viewportWidth = 1280

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => {
    const rnw = jest.requireActual('react-native-web')
    return new Proxy(rnw, {
      get: (target, key) =>
        key === 'useWindowDimensions'
          ? () => ({ width: viewportWidth, height: 900, scale: 1, fontScale: 1 })
          : target[key],
    })
  })
  jest.doMock('@/hooks/useNearTravelData', () => ({
    useNearTravelData: () => ({
      travelsNear: nearState.travels,
      displayedTravels: nearState.travels,
      mapPoints: [],
      isLoading: nearState.isLoading,
      isMapLoading: false,
      isMapError: false,
      isError: false,
      error: null,
      refetchTravelsNear: jest.fn(),
      refetchMapPoints: jest.fn(),
    }),
  }))
  // Карточка = её каркас: совпадение каркаса с карточкой — контракт #2253
  // (`listSkeletonGeometry`); здесь проверяется ряд, в котором они лежат.
  jest.doMock('@/components/listTravel/TravelListItem', () => {
    const react = require('react')
    const Skeleton = require('@/components/listTravel/TravelListItemSkeleton').default
    return { __esModule: true, default: () => react.createElement(Skeleton, { testID: 'near-card' }) }
  })
  // Место круглой карточки задаёт её обёртка фиксированной высоты, а не содержимое.
  jest.doMock('expo-router', () => ({ router: { push: jest.fn() } }))
  jest.doMock('@/components/ui/UnifiedTravelCard', () => {
    const react = require('react')
    const rn = require('react-native')
    return { __esModule: true, default: () => react.createElement(rn.View, { testID: 'near-card' }) }
  })
  jest.doMock('@/components/MapPage/TravelMap', () => ({ __esModule: true, TravelMap: () => null }))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  ;({ StyleSheet } = require('react-native'))
  NearTravelList = require('@/components/travel/NearTravelList').default
})

const travels = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Near ${i + 1}` }))

const STATES: Record<string, NearState> = {
  skeleton: { travels: [], isLoading: true },
  six: { travels: travels(6), isLoading: false },
  one: { travels: travels(1), isLoading: false },
  zero: { travels: [], isLoading: false },
}

const render = (width: number, state: NearState): Element => {
  viewportWidth = width
  nearState = state
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(
    createElement(NearTravelList, { travel: { id: 7 }, embedded: true, showHeader: false }),
  )
  return host.firstElementChild!
}

const declarationsOf = (node: Element): string[] => {
  const sheet = StyleSheet.getSheet().textContent
  const fromClasses = Array.from(node.classList).flatMap((name) => {
    const match = sheet.match(new RegExp(`\\.${name}\\{([^}]*)\\}`))
    return match ? match[1].split(';') : []
  })
  const inline = (node.getAttribute('style') ?? '').split(';')
  return [...fromClasses, ...inline].map((d) => d.trim().replace(/\s+/g, '')).filter(Boolean).sort()
}

// Прозрачность не участвует в раскладке.
const layoutDeclarations = (node: Element) => declarationsOf(node).filter((d) => !d.startsWith('opacity:'))

const isAbsolute = (node: Element) => declarationsOf(node).includes('position:absolute')

const markers = (root: Element) =>
  Array.from(root.querySelectorAll('[data-testid="near-card"],[data-testid="travel-list-item-skeleton"],[data-testid="travel-tml-round-skeleton"]'))
    .filter((node) => !node.parentElement?.closest('[data-testid="near-card"]'))

/** Путь (индексы детей) от корня секции до общего предка карточек — контейнера ряда. */
const slotContainerPath = (root: Element): number[] => {
  const chains = markers(root).map((node) => {
    const chain: Element[] = []
    for (let cur: Element | null = node; cur && cur !== root; cur = cur.parentElement) chain.unshift(cur)
    return chain
  })
  const pathIndexes: number[] = []
  let parent = root
  for (let depth = 0; chains.every((chain) => chain.length > depth + 1 && chain[depth] === chains[0][depth]); depth += 1) {
    pathIndexes.push(Array.from(parent.children).indexOf(chains[0][depth]))
    parent = chains[0][depth]
  }
  return pathIndexes
}

const follow = (root: Element, pathIndexes: number[]) =>
  pathIndexes.reduce<Element | undefined>((node, index) => node?.children[index], root)

/** Поток секции: всё, кроме содержимого ряда и абсолютных слоёв поверх него. */
const flowSignature = (node: Element, slotContainer: Element | undefined): string => {
  if (node === slotContainer) return `[row ${layoutDeclarations(node).join(';')}]`
  const children = Array.from(node.children)
    .filter((child) => !isAbsolute(child))
    .map((child) => flowSignature(child, slotContainer))
  return `<${layoutDeclarations(node).join(';')}>${children.join('')}</>`
}

const isSingleRow = (container: Element) => {
  const d = declarationsOf(container)
  const grid = d.includes('display:grid') && d.includes('grid-auto-flow:column') && !d.some((x) => x.startsWith('grid-template-columns:'))
  const flexRow = d.includes('flex-direction:row') && !d.includes('flex-wrap:wrap')
  return grid || flexRow
}

describe.each([
  { name: 'desktop 1280 (три колонки)', width: 1280, slots: 3 },
  { name: 'телефон 390 (одна карточка)', width: 390, slots: 1 },
])('«Рядом» $name: ряд одной высоты для каркаса и 6/1 карточек, пустое компактно (#2367)', ({ width, slots }) => {
  it('карточки и каркасы лежат в одном ряду, поток вне ряда одинаков для каркаса, 6 и 1', () => {
    const roots = Object.fromEntries(Object.entries(STATES).map(([key, state]) => [key, render(width, state)]))
    const rowPath = slotContainerPath(roots.six)
    const row = follow(roots.six, rowPath)!
    expect(markers(row)).toHaveLength(6)
    expect(isSingleRow(row)).toBe(true)

    const reference = flowSignature(roots.skeleton, follow(roots.skeleton, rowPath))
    for (const key of ['six', 'one']) {
      expect({ state: key, flow: flowSignature(roots[key], follow(roots[key], rowPath)) }).toEqual({ state: key, flow: reference })
    }

    // Слоты ряда одинаковы: ширина и высота карточки не зависят от их числа.
    const slotGeometry = (key: string) => Array.from(follow(roots[key], rowPath)!.children).map((slot) => layoutDeclarations(slot).join(';'))
    const [first] = slotGeometry('six')
    for (const key of ['skeleton', 'six', 'one']) {
      for (const geometry of slotGeometry(key)) expect(geometry).toBe(first)
    }
    expect(slotGeometry('skeleton')).toHaveLength(slots)
  })

  it('пустой ответ: компактное сообщение в потоке, без ряда, каркасов и пунктирной плашки', () => {
    const zero = render(width, STATES.zero)
    const empty = zero.querySelector('[data-testid="near-travel-empty"]')!
    expect(empty).not.toBeNull()
    expect(isAbsolute(empty)).toBe(false)
    expect(markers(zero)).toHaveLength(0)
    expect(zero.querySelector('[data-testid="near-travel-rail"]')).toBeNull()
    const subtree = [zero, ...Array.from(zero.querySelectorAll('*'))]
    expect(subtree.some((node) => declarationsOf(node).includes('border-style:dashed'))).toBe(false)
  })
})

it('страницы для пиксельного замера в Chromium (MT_NEAR_ROW_OUT)', () => {
  const outDir = process.env.MT_NEAR_ROW_OUT
  if (!outDir) return
  fs.mkdirSync(outDir, { recursive: true })
  // Ширина секции деталей: 1280 → три колонки по ~285 px (+2 зазора), 390 → 358 px.
  for (const [width, frame] of [[1280, 887], [390, 358]]) {
    for (const [key, state] of Object.entries(STATES)) {
      const near = render(width, state).outerHTML
      const css = StyleSheet.getSheet().textContent
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="margin:0"><div style="width:${frame}px;display:flex;flex-direction:column"><div data-section-key="near">${near}</div><div data-section-key="popular" style="height:300px"></div></div></body></html>`
      fs.writeFileSync(path.join(outDir, `${width}-${key}.html`), html)
    }
  }
  expect(fs.existsSync(path.join(outDir, '1280-six.html'))).toBe(true)
})
