import type React from 'react'
import { questPrivateSnapshot } from '../../fixtures/questPublicProjection'

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let renderToString: typeof import('react-dom/server').renderToString
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let SelectedLinks: React.ComponentType<any>
let graph: Record<string, unknown>
let width = 1440

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('expo-router', () => ({ useRouter: () => ({ push: () => {} }),
    Link: ({ href, asChild, children, ...props }: { href: string; asChild?: boolean; children: React.ReactNode }) => {
      const React = require('react')
      return asChild ? React.cloneElement(React.Children.only(children), { ...props, href })
        : React.createElement('a', { ...props, href }, children)
    } }))
  jest.doMock('@expo/vector-icons/Feather', () => () => null)
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => require('@/constants/designSystem').getThemedColors(false) }))
  jest.doMock('@/hooks/useResponsive', () => ({ useBreakpoints: () => ({ isMobile: width < 768, isPhone: width < 480, isSmallPhone: width < 375 }) }))
  jest.doMock('@/hooks/useTrackedImpression', () => ({ useTrackedImpression: () => ({}) }))
  jest.doMock('@/utils/analytics', () => ({ queueAnalyticsEvent: () => {}, sendAnalyticsEvent: () => {} }))
  jest.doMock('@/components/ui/richMediaViewport', () => ({ useRichMediaVisibility: () => ({ visible: true }) }))
  jest.doMock('@/hooks/useQuestForLocation', () => ({ useQuestsForLocation: () => { throw new Error('Selected graph must not request the full catalogue') } }))
  jest.doMock('@/components/ui/ImageCardMedia', () => ({ source, loading, alt }: { source: { uri: string }; loading: string; alt: string }) =>
    require('react').createElement('img', { src: source?.uri, loading, alt }))
  ;({ createElement, act } = require('react'))
  ;({ renderToString } = require('react-dom/server.node'))
  ;({ hydrateRoot } = require('react-dom/client'))
  SelectedLinks = require('@/components/travel/details/sections/TravelSelectedLinks.web').default
  const source = questPrivateSnapshot()
  const { buildTravelLinkGraphs } = require('@/utils/travelLinkGraph')
  graph = buildTravelLinkGraphs([
    { id: 42, name: 'Article', slug: 'article', cityName: 'Город', countryName: 'Беларусь' },
    { id: 7, name: 'Related article', slug: 'related', countryName: 'Беларусь' },
  ], source.catalog, source.bundles.ru)['42']
})

it.each([390, 768, 1440])('hydrates the selected real card and related nav at %spx without a new catalogue query or DOM swap', async (viewport) => {
  width = 1440
  const tree = createElement(SelectedLinks, { travel: { id: 42 }, styles: {}, graph })
  const container = document.createElement('div')
  container.innerHTML = renderToString(tree)
  document.body.appendChild(container)
  const card = container.querySelector('[data-testid="quest-for-city-section"]')
  const nav = container.querySelector('nav[data-travel-related-links]')
  expect([...container.querySelectorAll('a')].map((node) => node.getAttribute('href'))).toEqual([
    '/quests/7/fixture-city-walk', '/travels/related',
  ])
  expect(container.querySelectorAll('img[loading="lazy"]')).toHaveLength(1)
  expect(container.querySelectorAll('h1')).toHaveLength(0)
  const errors: unknown[] = []
  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    width = viewport
    await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: (error) => errors.push(error) }) })
    expect(errors).toEqual([])
    expect(container.querySelector('[data-testid="quest-for-city-section"]')).toBe(card)
    expect(container.querySelector('nav')).toBe(nav)
    expect(container.querySelectorAll('a')).toHaveLength(2)
  } finally {
    await act(async () => root?.unmount())
    container.remove()
  }
})
