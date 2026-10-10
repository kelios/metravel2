import type { Root } from 'react-dom/client'

/**
 * #2367: блок стрелок по похожим маршрутам появляется только после ответа «Рядом».
 * Пока он стоял между «Рядом» и «Популярные», его монтирование сдвигало
 * «Популярные» на 157–162 px уже после прокрутки к секции (прод 09.10.2026).
 * Контракт: между секциями `near` и `popular` ничего не вставляется ни в каркасе,
 * ни с данными; стрелки монтируются после последней секции, а пустой ответ не
 * оставляет пустого узла с высотой.
 *
 * Настоящий DOM react-native-web (createRoot): порядок узлов — то, что меряет
 * приёмка (`top(popular) - top(near)`), а не снимок пропов.
 */
let createElement: typeof import('react').createElement
let act: typeof import('react').act
let createRoot: typeof import('react-dom/client').createRoot
let Section: typeof import('@/components/travel/details/sections/TravelDetailsSidebarSection').TravelDetailsSidebarSection

type Travel = { id: number; slug?: string; name?: string }
let nearResponse: Travel[] = []

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/i18n', () => ({ translate: (key: string) => key }))
  jest.doMock('@/constants/nearby', () => ({ getNearbyTravelsSubtitle: () => 'near-subtitle' }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({ primaryDark: '#000' }) }))
  jest.doMock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/components/travel/details/TravelDetailsStyles', () => ({
    useTravelDetailsStyles: () => new Proxy({}, { get: () => ({}) }),
  }))
  jest.doMock('@/hooks/useProgressiveLoading', () => ({
    useProgressiveLoad: () => ({ setElementRef: () => undefined, shouldLoad: true }),
  }))
  jest.doMock('@tanstack/react-query', () => ({ useIsFetching: () => 0 }))
  // Списки — граница данных: «Рядом» отдаёт колбэку ответ так же, как
  // `useNearTravelData` (только непустой), «Популярные» просто занимает место.
  jest.doMock('@/components/travel/details/sections/travelDetailsSidebarLists', () => {
    const react = require('react')
    const rn = require('react-native')
    return {
      NearTravelListComponent: ({ onTravelsLoaded }: { onTravelsLoaded?: (travels: Travel[]) => void }) => {
        // Ответ приходит после монтирования, как сетевой: синхронный вызов в
        // эффекте ребёнка перекрыл бы сброс `relatedTravels` в эффекте модели.
        react.useEffect(() => {
          if (nearResponse.length === 0) return undefined
          const timer = setTimeout(() => onTravelsLoaded?.(nearResponse), 0)
          return () => clearTimeout(timer)
        }, [onTravelsLoaded])
        return react.createElement(rn.View, { testID: 'near-list', style: { height: 430 } })
      },
      PopularTravelListComponent: () => react.createElement(rn.View, { testID: 'popular-list', style: { height: 430 } }),
    }
  })
  jest.doMock('@/components/travel/NavigationArrows', () => {
    const react = require('react')
    const rn = require('react-native')
    return { __esModule: true, default: () => react.createElement(rn.View, { testID: 'navigation-arrows', style: { height: 160 } }) }
  })
  // Переход — прозрачный контейнер: измерение высоты есть у его собственного теста.
  jest.doMock('@/components/travel/details/TravelDetailsDeferredTransition', () => {
    const react = require('react')
    const rn = require('react-native')
    return {
      TravelDetailsDeferredTransition: ({ children, testID }: { children: unknown; testID: string }) =>
        react.createElement(rn.View, { testID }, children),
    }
  })
  ;({ createElement, act } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  Section = require('@/components/travel/details/sections/TravelDetailsSidebarSection').TravelDetailsSidebarSection
})

const travel = { id: 7, slug: 'seven', name: 'Seven' }
const anchors = { near: { current: null }, popular: { current: null } }

async function mount(response: Travel[]) {
  nearResponse = response
  const host = document.createElement('div')
  document.body.append(host)
  let root: Root
  await act(async () => {
    root = createRoot(host)
    root.render(createElement(Section as never, { travel, anchors, canRenderHeavy: true }))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
  const frame = host.querySelector('[data-testid="travel-details-sidebar-runtime-frame"]') as HTMLElement
  const near = host.querySelector('[data-section-key="near"]') as HTMLElement
  const popular = host.querySelector('[data-section-key="popular"]') as HTMLElement
  const transition = host.querySelector('[data-testid="travel-details-related-navigation-transition"]') as HTMLElement
  const arrows = host.querySelector('[data-testid="navigation-arrows"]')
  return {
    frame, near, popular, transition, arrows,
    unmount: async () => { await act(async () => root.unmount()); host.remove() },
  }
}

const follows = (node: Element, previous: Element) => Boolean(previous.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('TravelDetailsSidebarSection: стрелки похожих маршрутов не стоят между «Рядом» и «Популярные» (#2367)', () => {
  it('каркас и пустой ответ «Рядом»: «Популярные» сразу за «Рядом», стрелок нет, пустой узел перехода — последний и без высоты', async () => {
    const view = await mount([])
    expect(view.near.nextElementSibling).toBe(view.popular)
    expect(view.arrows).toBeNull()
    expect(view.frame.lastElementChild).toBe(view.transition)
    expect(view.transition.childElementCount).toBe(0)
    expect(view.transition.getAttribute('style') ?? '').not.toMatch(/height/)
    await view.unmount()
  })

  it('данные «Рядом»: соседство near→popular прежнее, стрелки смонтированы после «Популярные»', async () => {
    const view = await mount([{ id: 1 }, { id: 7 }, { id: 3 }])
    expect(view.arrows).not.toBeNull()
    expect(view.near.nextElementSibling).toBe(view.popular)
    expect(follows(view.arrows!, view.popular)).toBe(true)
    expect(view.frame.lastElementChild).toBe(view.transition)
    await view.unmount()
  })
})
