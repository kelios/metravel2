import fs from 'fs'
import path from 'path'
import type React from 'react'

/**
 * #2367 (круг 3): каркас сайдбара «Рядом» (`travel-sidebar-near-skeleton`) стоит
 * до монтирования секции и обязан совпасть с ней по высоте. Прод c94e4cf1f
 * 11.10.2026, /travels/636: на 1280 каркас рисовал одну карточку каталога
 * (994 px) против ряда смонтированной секции (443 px) — «Популярные» 1168 → 617;
 * на 390 в каркасе не было строки «Список/Карта» — 322 против 402 px,
 * «Популярные» 408 → 488 в видимой зоне.
 *
 * Контракт: содержимое каркаса под заголовком — та же геометрия, что
 * `NearTravelList` в состоянии загрузки и с 6/1 карточками (коробка строки
 * переключателя, колонка и раскладка ряда, слоты с карточками). Каркас —
 * лёгкие View без `CardRail`/`SegmentedControl` (ранний граф детальной,
 * ROUTE-BUNDLE-001); заголовочная часть сверяется в `listSkeletonGeometry`. Настоящий серверный рендер react-native-web, пиксели —
 * тех же страниц в Chromium (`MT_NEAR_SIDEBAR_OUT=<dir>`).
 */
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let StyleSheet: { getSheet: () => { textContent: string } }
let SidebarSectionSkeleton: React.ComponentType
let TravelDetailsSidebarSection: React.ComponentType<any>

type NearState = { travels: { id: number; name: string }[]; isLoading: boolean }
let nearState: NearState = { travels: [], isLoading: true }
let viewportWidth = 1280

const TRAVEL = { id: 7, slug: 'route-7', coordsMeTravel: [{ lat: 49.61, lng: 6.13 }] }

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
  jest.doMock('@/hooks/useResponsive', () => ({
    ...jest.requireActual('@/hooks/useResponsive'),
    useResponsiveWidth: () => viewportWidth,
  }))
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
  // Карточка = её каркас (контракт #2253, `listSkeletonGeometry`).
  jest.doMock('@/components/listTravel/TravelListItem', () => {
    const react = require('react')
    const Skeleton = require('@/components/listTravel/TravelListItemSkeleton').default
    return { __esModule: true, default: () => react.createElement(Skeleton, { testID: 'near-card' }) }
  })
  jest.doMock('expo-router', () => ({ router: { push: jest.fn() } }))
  jest.doMock('@/components/ui/UnifiedTravelCard', () => {
    const react = require('react')
    const rn = require('react-native')
    return { __esModule: true, default: () => react.createElement(rn.View, { testID: 'near-card' }) }
  })
  jest.doMock('@/components/MapPage/TravelMap', () => ({ __esModule: true, TravelMap: () => null }))
  // Смонтированная секция сайдбара: настоящая разметка, модель и списки — заглушки.
  jest.doMock('@/components/travel/details/hooks/useTravelDetailsSidebarSectionModel', () => ({
    useTravelDetailsSidebarSectionModel: () => ({
      handleTravelsLoaded: jest.fn(),
      hasValidTravelId: true,
      listsFetching: false,
      nearInViewport: true,
      relatedTravels: [],
      setNearRef: jest.fn(),
      shouldShowNavigationArrows: false,
    }),
  }))
  jest.doMock('@/components/travel/details/sections/travelDetailsSidebarLists', () => {
    const react = require('react')
    const rn = require('react-native')
    return {
      NearTravelListComponent: require('@/components/travel/NearTravelList').default,
      PopularTravelListComponent: () => react.createElement(rn.View, { style: { height: 300 } }),
    }
  })
  jest.doMock('@/components/travel/NavigationArrows', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/components/travel/details/TravelDetailsDeferredTransition', () => ({
    TravelDetailsDeferredTransition: ({ children }: { children?: React.ReactNode }) => children ?? null,
  }))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  ;({ StyleSheet } = require('react-native'))
  ;({ SidebarSectionSkeleton } = require('@/components/travel/NearTravelListSkeleton'))
  ;({ TravelDetailsSidebarSection } = require('@/components/travel/details/sections/TravelDetailsSidebarSection'))
})

const travels = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Near ${i + 1}` }))

const MOUNTED: Record<string, NearState> = {
  loading: { travels: [], isLoading: true },
  six: { travels: travels(6), isLoading: false },
  one: { travels: travels(1), isLoading: false },
}

const toHost = (element: React.ReactElement): HTMLElement => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(element)
  return host
}

const renderSkeleton = (width: number) => {
  viewportWidth = width
  return toHost(createElement(SidebarSectionSkeleton))
}

const renderMounted = (width: number, state: NearState) => {
  viewportWidth = width
  nearState = state
  return toHost(createElement(TravelDetailsSidebarSection, { travel: TRAVEL, anchors: {}, canRenderHeavy: true }))
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

// Прозрачность и курсор не участвуют в раскладке.
const layoutDeclarations = (node: Element) =>
  declarationsOf(node).filter((d) => !d.startsWith('opacity:') && !d.startsWith('cursor:') && !d.startsWith('pointer-events:'))
const isAbsolute = (node: Element) => declarationsOf(node).includes('position:absolute')
const isSlot = (node: Element) => node.getAttribute('data-testid') === 'near-travel-rail-slot'

/** Поток узла; ряд слотов сводится к своей геометрии и геометрии слота — без их числа. */
const flowSignature = (node: Element): string => {
  const children = Array.from(node.children).filter((child) => !isAbsolute(child))
  if (children.length > 0 && children.every(isSlot)) {
    const slotGeometry = Array.from(new Set(children.map((slot) => layoutDeclarations(slot).join(';'))))
    return `[slots ${layoutDeclarations(node).join(';')} | ${slotGeometry.join(' / ')}]`
  }
  return `<${layoutDeclarations(node).join(';')}>${children.map(flowSignature).join('')}</>`
}

// Коробочная модель: то, что задаёт высоту узла в потоке.
const BOX = /^(margin|padding|border-(top|right|bottom|left)-width|height|min-height|max-height):/
// Нулевые значения — сброс RNW у каждого View, высоты не задают.
const boxOf = (node: Element) => layoutDeclarations(node).filter((d) => BOX.test(d) && !/:0(px)?$/.test(d))
// Раскладка ряда: направление, зазоры, сетка, отступы.
const RAIL = /^(display|flex-direction|(column-|row-)?gap|grid-[a-z-]+|align-items|width|padding-[a-z]+):/
const inFlow = (node: Element) => Array.from(node.children).filter((child) => !isAbsolute(child))

/**
 * Геометрия «Рядом» под заголовком: отступ обёртки, коробка строки переключателя
 * (поля, padding, рамка, высота сегмента), колонка ряда, промежуточные узлы ряда
 * без собственной коробки, раскладка контейнера слотов и сами слоты с карточками.
 * Каркас сайдбара — лёгкие View (ROUTE-BUNDLE-001), секция — SegmentedControl и
 * CardRail; сравнение идёт по геометрии, а не по разметке.
 */
const nearGeometry = (wrapper: Element, toggle: Element, column: Element) => {
  const slots = Array.from(column.querySelectorAll('[data-testid="near-travel-rail-slot"]'))
  const content = slots[0].parentElement!
  const chain: string[][] = []
  for (let node = content.parentElement!; node !== column; node = node.parentElement!) chain.push(boxOf(node))
  return {
    margin: layoutDeclarations(wrapper).join(';'),
    toggle: boxOf(toggle).join(';'),
    segment: Array.from(new Set(inFlow(toggle).map((segment) => boxOf(segment).filter((d) => d.startsWith('min-height:')).join(';')))),
    column: layoutDeclarations(column).join(';'),
    chain: chain.filter((box) => box.length > 0),
    rail: layoutDeclarations(content).filter((d) => RAIL.test(d)).join(';'),
    // Слот и коробка карточки в нём (место карточки задаёт обёртка фиксированной высоты, #2253).
    slots: Array.from(new Set(slots.map((slot) => `${layoutDeclarations(slot).join(';')} > ${boxOf(slot.firstElementChild!).join(';')}`))),
  }
}

const skeletonContent = (host: Element) => {
  const near = host.querySelector('[data-testid="travel-sidebar-near-skeleton"]')!
  const wrapper = near.lastElementChild!
  const [toggle, column] = inFlow(wrapper.firstElementChild!)
  return nearGeometry(wrapper, toggle, column)
}

const mountedContent = (host: Element) => {
  const loaded = host.querySelector('[data-testid="travel-details-near-loaded"]')!
  const [toggle, column] = inFlow(loaded.firstElementChild!)
  expect(toggle.getAttribute('role')).toBe('radiogroup')
  return nearGeometry(loaded.parentElement!, toggle, column)
}

/** Поток секции под заголовком: загрузка и данные — один кадр (ряд не перемонтируется). */
const mountedFlow = (host: Element) => {
  const loaded = host.querySelector('[data-testid="travel-details-near-loaded"]')!
  return inFlow(loaded.firstElementChild!).map(flowSignature)
}

describe.each([1280, 390])('каркас сайдбара «Рядом» = смонтированная секция на %s (#2367)', (width) => {
  it.each(Object.keys(MOUNTED))('геометрия под заголовком совпадает с NearTravelList (%s)', (state) => {
    const skeleton = skeletonContent(renderSkeleton(width))
    const mounted = mountedContent(renderMounted(width, MOUNTED[state]))
    expect(skeleton).toEqual(mounted)
    expect(skeleton.segment).toEqual(['min-height:44px'])
    expect(skeleton.chain).toEqual([])
  })

  it('загрузка и данные NearTravelList — один кадр', () => {
    const loading = mountedFlow(renderMounted(width, MOUNTED.loading))
    expect(mountedFlow(renderMounted(width, MOUNTED.six))).toEqual(loading)
    expect(mountedFlow(renderMounted(width, MOUNTED.one))).toEqual(loading)
  })

  it('в каркасе есть декоративная строка переключателя и ряд near-travel-rail без фокуса', () => {
    const near = renderSkeleton(width).querySelector('[data-testid="travel-sidebar-near-skeleton"]')!
    const toggle = near.querySelector('[data-testid="near-travel-toggle-skeleton"]')!
    expect(toggle).not.toBeNull()
    expect(toggle.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(near.querySelector('[data-testid="near-travel-rail"]')).not.toBeNull()
    expect(near.querySelector('[role], button, a, [tabindex]')).toBeNull()
  })
})

// ROUTE-BUNDLE-001: каркас едет в ленивых travel-чанках (PostLcpRuntime,
// TravelDetailsDeferred, NearTravelList) без интерактивного ряда; модули общего
// чанка всех HTML-маршрутов (TravelDetailSkeletons, Transition) его не импортируют.
const importsOf = (file: string) => Array.from(
  fs.readFileSync(path.join(__dirname, '../../../components/travel', file), 'utf8').matchAll(/from\s+'([^']+)'/g),
  (m) => m[1],
)
it('каркас «Рядом» не импортирует CardRail, SegmentedControl и NearTravelList', () => {
  expect(importsOf('NearTravelListSkeleton.tsx').filter((s) => /CardRail|SegmentedControl|NearTravelList'?$|MapPage/.test(s))).toEqual([])
})
it('модули общего чанка не тянут каркас сайдбара', () => {
  for (const file of ['TravelDetailSkeletons.tsx', 'details/TravelDetailsDeferredTransition.tsx']) {
    expect(importsOf(file).filter((s) => /NearTravelList/.test(s))).toEqual([])
  }
})

it('страницы для пиксельного замера в Chromium (MT_NEAR_SIDEBAR_OUT)', () => {
  const outDir = process.env.MT_NEAR_SIDEBAR_OUT
  if (!outDir) return
  fs.mkdirSync(outDir, { recursive: true })
  // Ширина колонки деталей: 1280 → 887 px, 390 → 358 px (как в rowGeometry).
  for (const [width, frame] of [[1280, 887], [390, 358]]) {
    const pages: Record<string, string> = { skeleton: renderSkeleton(width).innerHTML }
    for (const [key, state] of Object.entries(MOUNTED)) pages[key] = renderMounted(width, state).innerHTML
    const css = StyleSheet.getSheet().textContent
    for (const [key, body] of Object.entries(pages)) {
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="margin:0"><div style="width:${frame}px;display:flex;flex-direction:column">${body}</div></body></html>`
      fs.writeFileSync(path.join(outDir, `${width}-${key}.html`), html)
    }
  }
  expect(fs.existsSync(path.join(outDir, '1280-skeleton.html'))).toBe(true)
})
