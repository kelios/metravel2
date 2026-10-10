import fs from 'node:fs'
import path from 'node:path'

import type { PlannedTrip } from '@/api/plannedTrips'

/**
 * #2253: первый кадр `/trips/my` (статический HTML #864, `width = 0` →
 * `isDesktop = false`) и кадр после гидратации на desktop обязаны совпадать по
 * геометрии. Раньше SSR рисовал одну колонку без панели фильтров, а гидратация на
 * 1280 перекладывала список в две колонки с панелью (CLS 0,23). Теперь всё, что
 * зависит от брейкпоинта, идёт через `MY_CREATED_TRIPS_LAYOUT`: React — по живому
 * `isDesktop`, critical CSS — для первого кадра.
 *
 * Настоящий серверный рендер react-native-web. Пиксельный замер — тем же HTML в
 * Chromium (`MT_FIRST_FRAME_OUT=<dir>` пишет страницы для Playwright-замера).
 */
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let StyleSheet: { getSheet: () => { textContent: string } }
let MyCreatedTripsList: typeof import('@/components/trips/MyCreatedTripsList').default
let MY_CREATED_TRIPS_LAYOUT: typeof import('@/components/trips/myCreatedTripsLayout').MY_CREATED_TRIPS_LAYOUT
let buildBreakpointLayoutCss: typeof import('@/utils/breakpointLayout').buildBreakpointLayoutCss
let buildCriticalCSS: typeof import('@/utils/criticalCSSBuilder').buildCriticalCSS
let colors: ReturnType<typeof import('@/constants/designSystem').getThemedColors>
let mockDesktop = false
let mockPending = true

const makeTrip = (overrides: Partial<PlannedTrip>): PlannedTrip => ({
  id: 59,
  slug: 'trip-59',
  title: 'Поездка',
  description: 'Описание',
  startDate: '2026-08-01',
  startTime: '09:00',
  transport: 'car',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 1, name: 'Юля', avatarUrl: null },
  route: [],
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
  participants: [],
  coverUrl: null,
  // `region` у поездок всегда '' (docs/features/trips.md): группа «Место» в панели не появляется.
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-07-09T10:00:00Z',
  ...overrides,
})

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('react-native-reanimated', () => ({
    __esModule: true,
    default: { View: require('react-native').View },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withSpring: (value: number) => value,
  }))
  jest.doMock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => colors, useTheme: () => ({ isDark: false }) }))
  // SSR: `useResponsive` отдаёт width 0 → isDesktop false; после гидратации на 1280 — true.
  jest.doMock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ width: mockDesktop ? 1280 : 0, isDesktop: mockDesktop, isPhone: !mockDesktop, isLargePhone: false }),
    useBreakpoints: () => ({ isPhone: !mockDesktop, isDesktop: mockDesktop }),
  }))
  jest.doMock('@/hooks/useAuthedQuerySettled', () => ({ useAuthedQuerySettled: () => !mockPending }))
  jest.doMock('@/hooks/usePlannedTripsApi', () => ({
    useMyPlannedTrips: () => ({ data: mockPending ? undefined : [makeTrip({ id: 59 }), makeTrip({ id: 60, slug: 'trip-60', title: 'Вторая поездка' })], isPending: mockPending, isError: false, refetch: () => undefined }),
    useDeletePlannedTrip: () => ({ mutate: jest.fn(), isPending: false }),
  }))
  jest.doMock('@expo/vector-icons/Feather', () => {
    const react = require('react'), rn = require('react-native')
    return { __esModule: true, default: ({ size }: { size: number }) => react.createElement(rn.View, { style: { width: size, height: size } }) }
  })
  jest.doMock('@/components/MapPage/MapIcon', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/components/trips/planning/tripFallbackCover', () => ({ getTripFallbackCover: () => ({ uri: 'fallback.png', key: 'fallback' }) }))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  ;({ StyleSheet } = require('react-native'))
  colors = require('@/constants/designSystem').getThemedColors(false)
  MyCreatedTripsList = require('@/components/trips/MyCreatedTripsList').default
  ;({ MY_CREATED_TRIPS_LAYOUT } = require('@/components/trips/myCreatedTripsLayout'))
  ;({ buildBreakpointLayoutCss } = require('@/utils/breakpointLayout'))
  ;({ buildCriticalCSS } = require('@/utils/criticalCSSBuilder'))
})

const render = (desktop: boolean, pending: boolean) => {
  mockDesktop = desktop
  mockPending = pending
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(createElement(MyCreatedTripsList))
  return host
}

/** Объявления всех атомарных классов узла плюс инлайн-стиль — то, что применит браузер. */
const declarationsOf = (node: Element) =>
  [...node.classList]
    .map((name) => StyleSheet.getSheet().textContent.match(new RegExp(`\\.${name}\\{([^}]*)\\}`))?.[1] ?? '')
    .join(';') + ';' + (node.getAttribute('style') ?? '')

/** Разметка без стилей узлов реестра: всё остальное между SSR и гидратацией обязано совпасть. */
const markupOutsideRegistry = (host: HTMLElement) => {
  const clone = host.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-bp-layout]').forEach((node) => {
    node.removeAttribute('class')
    node.removeAttribute('style')
  })
  return clone.innerHTML
}

const wideRules = () =>
  Object.fromEntries(
    [...buildBreakpointLayoutCss(MY_CREATED_TRIPS_LAYOUT).matchAll(/\[data-bp-layout="([^"]+)"\]\{([^}]*)\}/g)].map((match) => [
      match[1],
      match[2].split(';').map((declaration) => declaration.replace(' !important', '').trim()).filter(Boolean),
    ]),
  )

describe('MyCreatedTripsList: первый кадр SSR = кадр после гидратации (#2253)', () => {
  it('реестр покрывает тело, панель, кнопку фильтров и ячейку и попадает в critical CSS от 1280 px', () => {
    const css = buildBreakpointLayoutCss(MY_CREATED_TRIPS_LAYOUT)
    expect(css).toContain('@media (min-width:1280px){')
    expect(css).toContain('[data-bp-layout="myTrips-body"]{flex-direction:row !important;align-items:flex-start !important;gap:16px !important}')
    expect(css).toContain('[data-bp-layout="myTrips-sidebar"]{width:260px !important}')
    expect(css).toContain('[data-bp-layout="myTrips-filterToggle"]{display:none !important}')
    expect(css).toContain('[data-bp-layout="myTrips-filterPanel"]{display:flex !important}')
    expect(css).toContain('[data-bp-layout="myTrips-gridItem"]{width:48.8% !important}')
    expect(buildCriticalCSS()).toContain(css)
  })

  it.each([true, false])('SSR (width 0) и desktop-рендер различаются только стилями узлов реестра (pending=%s)', (pending) => {
    const ssr = render(false, pending)
    const hydrated = render(true, pending)
    expect(markupOutsideRegistry(ssr)).toBe(markupOutsideRegistry(hydrated))
    // Панель, кнопка и обе ячейки есть уже в статической разметке.
    expect(ssr.querySelector('[data-bp-layout="myTrips-filterPanel"]')).not.toBeNull()
    expect(ssr.querySelector('[data-bp-layout="myTrips-filterToggle"]')).not.toBeNull()
    expect(ssr.querySelectorAll('[data-bp-layout="myTrips-gridItem"]')).toHaveLength(2)
  })

  it('desktop-рендер применяет ровно те объявления, что critical CSS даёт первому кадру', () => {
    const hydrated = render(true, true)
    const rules = wideRules()
    expect(Object.keys(rules).sort()).toEqual(['myTrips-body', 'myTrips-filterPanel', 'myTrips-filterToggle', 'myTrips-gridItem', 'myTrips-sidebar'])
    for (const [key, declarations] of Object.entries(rules)) {
      const nodes = hydrated.querySelectorAll(`[data-bp-layout="${key}"]`)
      expect(nodes.length).toBeGreaterThan(0)
      nodes.forEach((node) => {
        const applied = declarationsOf(node).split(';').map((declaration) => declaration.trim())
        for (const declaration of declarations) expect(applied).toContain(declaration)
      })
    }
  })

  it('на телефоне (узкая сторона) панель скрыта до нажатия, кнопка фильтров видна', () => {
    const ssr = render(false, true)
    expect(declarationsOf(ssr.querySelector('[data-bp-layout="myTrips-filterPanel"]')!)).toContain('display:none')
    expect(declarationsOf(ssr.querySelector('[data-bp-layout="myTrips-filterToggle"]')!)).toContain('display:flex')
    expect(declarationsOf(ssr.querySelector('[data-bp-layout="myTrips-gridItem"]')!)).toContain('width:100%')
  })

  it('страницы для пиксельного замера в Chromium (MT_FIRST_FRAME_OUT)', () => {
    const outDir = process.env.MT_FIRST_FRAME_OUT
    if (!outDir) return
    // desktop (1280): SSR → гидратация (isDesktop) → данные; телефон (390): SSR → гидратация (узкая) → данные.
    const variants = {
      ssr: render(false, true),
      hydrated: render(true, true),
      loaded: render(true, false),
      'hydrated-narrow': render(false, true),
      'loaded-narrow': render(false, false),
    }
    fs.mkdirSync(outDir, { recursive: true })
    const css = `${StyleSheet.getSheet().textContent}\n${buildCriticalCSS()}`
    for (const [name, host] of Object.entries(variants)) {
      // Контейнер дашборда: `MyTripsDashboard` — paddingHorizontal 16, inner maxWidth 1180.
      const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css}</style></head><body style="margin:0"><div style="padding:0 16px;display:flex;justify-content:center"><div style="width:100%;max-width:1180px">${host.innerHTML}</div></div></body></html>`
      fs.writeFileSync(path.join(outDir, `${name}.html`), html)
    }
    expect(fs.existsSync(path.join(outDir, 'ssr.html'))).toBe(true)
  })
})
