import fs from 'fs'
import path from 'path'
import type React from 'react'
import type { Root } from 'react-dom/client'

// #2032: hover-стили бокового меню деталей путешествия жили в `*.web.css`, а
// селекторы целились в сырые `data-*` пропы. react-test-renderer такие пропы
// видит, поэтому соседний `CompactSideBarTravel.web.test.tsx` проходил, а на
// странице не было ни атрибутов, ни правил. Здесь — настоящий DOM react-native-web
// и настоящий `app/global.css`: каждое правило бокового меню обязано находить
// отрендеренные элементы.
//
// `__tests__/setup.ts` уже закэшировал свой мок `react-native`, поэтому RNW и всё,
// что через него рисуется, грузится из свежего реестра (рецепт #2024,
// `TravelDetailsSectionAnchors.web.test.tsx`). jest-expo резолвит `.native` первым,
// так что `@/ui/paper` прибит к web-файлу.
let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let CompactSideBarTravel: React.ComponentType<any>
let downloadTravelRouteFile: jest.Mock

const mockLinks = [
  { key: 'gallery', label: 'Галерея', icon: 'image' },
  { key: 'description', label: 'Описание', icon: 'file-text' },
  { key: 'map', label: 'Карта маршрута', icon: 'map' },
  { key: 'popular', label: 'Популярные маршруты', icon: 'star' },
]

const mockTravel = {
  id: 'test-123',
  slug: 'test-travel',
  name: 'Тестовое путешествие',
  userName: 'Юлия',
  countryName: 'Беларусь',
  monthName: 'Октябрь',
  year: '2022',
  countUnicIpView: '100',
  travelAddress: [{ id: 1, name: 'Храм', coord: '53.9045, 27.5615' }],
  userIds: 'user-1',
}

jest.mock('@/stores/authStore', () => ({
  __esModule: true,
  useAuthStore: (selector: (state: { isSuperuser: boolean; userId: string | null }) => unknown) =>
    selector({ isSuperuser: false, userId: null }),
}))
jest.mock('@/hooks/useUserProfileCached', () => ({
  __esModule: true,
  useUserProfileCached: () => ({ profile: null, isLoading: false, isFetching: false, error: null, fullName: '' }),
}))
jest.mock('@/hooks/useTravelRouteFiles', () => ({
  __esModule: true,
  useTravelRouteFiles: () => ({
    data: [{ id: 77, ext: 'gpx', original_name: 'route.gpx' }],
    isLoading: false,
    isFetching: false,
    error: null,
  }),
}))
jest.mock('@/utils/travelRouteDownload', () => ({ downloadTravelRouteFile: jest.fn() }))
jest.mock('@/components/home/WeatherWidget', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/ui/SubscribeButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/travel/TravelPdfExportControl', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/ui/ImageCardMedia', () => ({ __esModule: true, default: () => null }))

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/ui/paper', () => jest.requireActual('@/ui/paper.web.tsx'))
  // Настоящий `createIconSet` отдаёт все пропы в `<Text {...props}>` — так же
  // делает и эта замена; глобальный мок из `setup.ts` держит Text нативного реестра.
  jest.doMock('@expo/vector-icons/Feather', () => {
    const React = jest.requireActual('react')
    const { Text } = require('react-native')
    const Feather = ({ name, size: _size, color, style, ...props }: any) =>
      React.createElement(Text, { ...props, style: [{ color }, style] }, String(name))
    return { __esModule: true, default: Feather }
  })
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  CompactSideBarTravel = require('@/components/travel/CompactSideBarTravel').default
  // Тот же реестр, что у компонента: мок из `jest.mock` выше пересоздан после resetModules.
  downloadTravelRouteFile = require('@/utils/travelRouteDownload').downloadTravelRouteFile
})

type SidebarRule = { selector: string; media: string | null }

// Все правила `app/global.css`, чьи селекторы трогают маркеры бокового меню.
const readSidebarRules = (): SidebarRule[] => {
  const css = fs.readFileSync(path.join(process.cwd(), 'app/global.css'), 'utf8')
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  const rules: SidebarRule[] = []
  const walk = (list: CSSRuleList, media: string | null) => {
    for (const rule of Array.from(list)) {
      if ('selectorText' in rule && /data-sidebar-/.test((rule as CSSStyleRule).selectorText)) {
        for (const selector of (rule as CSSStyleRule).selectorText.split(',')) {
          rules.push({ selector: selector.trim(), media })
        }
      } else if ('cssRules' in rule && 'media' in rule) {
        walk((rule as CSSMediaRule).cssRules, (rule as CSSMediaRule).media.mediaText)
      }
    }
  }
  walk((style.sheet as CSSStyleSheet).cssRules, null)
  style.remove()
  return rules
}

describe('CompactSideBarTravel in the real React Native Web DOM (#2032)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(
        createElement(CompactSideBarTravel, {
          refs: {},
          travel: mockTravel,
          isMobile: false,
          onNavigate: jest.fn(),
          closeMenu: jest.fn(),
          activeSection: 'gallery',
          links: mockLinks,
        }),
      )
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('puts the hover markers into the DOM through dataSet', () => {
    const links = Array.from(container.querySelectorAll<HTMLElement>('[data-sidebar-link="true"]'))
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      ...mockLinks.map((link) => link.label),
      'Скачать маршрут',
    ])
    for (const link of links) {
      expect(link.querySelector('[data-sidebar-link-icon="true"]')).not.toBeNull()
      expect(link.querySelector('[data-sidebar-link-label="true"]')).not.toBeNull()
    }
    expect(container.querySelector('[aria-current="page"]')?.getAttribute('aria-label')).toBe('Галерея')
    expect(container.querySelectorAll('[data-sidebar-card="true"]')).toHaveLength(1)
  })

  it('has app/global.css rules for the sidebar that all reach rendered elements', () => {
    const rules = readSidebarRules()
    const selectors = rules.map((rule) => rule.selector)
    expect(selectors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('[data-sidebar-link]'),
        expect.stringContaining('[data-sidebar-link-icon]'),
        expect.stringContaining('[data-sidebar-link-label]'),
        expect.stringContaining('[data-sidebar-card]'),
      ]),
    )
    // jsdom никого не «наводит»: без `:hover` селектор — это множество элементов,
    // которые правило перекрасит при наведении. Пустое множество — мёртвое правило.
    const deadSelectors = rules
      .map((rule) => rule.selector)
      .filter((selector) => container.querySelectorAll(selector.replace(/:hover/g, '')).length === 0)
    expect(deadSelectors).toEqual([])
  })

  it('drops the hover response while the route is downloading', async () => {
    downloadTravelRouteFile.mockReturnValue(new Promise(() => {}))
    const download = container.querySelector('[aria-label="Скачать маршрут"]') as HTMLElement
    const hoverSelectors = readSidebarRules()
      .map((rule) => rule.selector)
      .filter((selector) => selector.includes(':hover') && selector.includes('[data-sidebar-link]'))
      .map((selector) => selector.replace(/:hover/g, ''))
    const matchesHoverRule = () =>
      [download, ...Array.from(download.querySelectorAll('*'))].some((node) =>
        hoverSelectors.some((selector) => node.matches(selector)),
      )
    expect(matchesHoverRule()).toBe(true)

    await act(async () => {
      download.click()
    })

    expect(downloadTravelRouteFile).toHaveBeenCalled()
    expect(download.getAttribute('aria-disabled')).toBe('true')
    expect(matchesHoverRule()).toBe(false)
  })

  it('keeps hover desktop-only and away from the active item', () => {
    const hoverRules = readSidebarRules().filter((rule) => rule.selector.includes(':hover'))
    expect(hoverRules.length).toBeGreaterThan(0)
    // RULES.md: hover-only affordances are desktop-only.
    const outsideHoverMedia = hoverRules
      .filter((rule) => !String(rule.media).includes('hover: hover'))
      .map((rule) => rule.selector)
    expect(outsideHoverMedia).toEqual([])

    // Активный пункт держит RN-вид (`linkActive`, `activeIndicator`) — наведение его не трогает.
    const active = container.querySelector('[aria-current="page"]') as HTMLElement
    const activeNodes = [active, ...Array.from(active.querySelectorAll('*'))]
    const touchingActive = hoverRules
      .map((rule) => rule.selector)
      .filter((selector) => selector.includes('[data-sidebar-link]'))
      .filter((selector) => activeNodes.some((node) => node.matches(selector.replace(/:hover/g, ''))))
    expect(touchingActive).toEqual([])
  })
})
