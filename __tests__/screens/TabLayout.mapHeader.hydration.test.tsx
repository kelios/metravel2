import { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server.node'
import { Platform } from 'react-native'
import TabLayout from '@/app/(tabs)/_layout'
import { HEADER_LAYOUT_BREAKPOINTS } from '@/components/layout/headerLayoutContract'
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder'

let mockPath = '/map'
let mockHydrated = false
let mockWidth: number | null = null
const mockHydrationListeners = new Set<() => void>()
jest.mock('expo-router', () => {
  const Tabs = ({ screenOptions }: any) => screenOptions.header({ navigation: { isFocused: () => true } })
  Tabs.Screen = () => null
  return { Tabs, usePathname: () => mockPath }
})
jest.mock('@/hooks/useHydrationReady', () => ({
  useHydrationReady: () => require('react').useSyncExternalStore(
    (callback: () => void) => { mockHydrationListeners.add(callback); return () => mockHydrationListeners.delete(callback) },
    () => mockHydrated, () => false,
  ),
}))
jest.mock('@/utils/viewportMetrics', () => ({ readViewportWidth: () => mockWidth }))
jest.mock('@/components/layout/useListFilterQuery', () => ({ useHasListFilterQuery: () => false }))
jest.mock('@/components/layout/CustomHeader', () => ({
  __esModule: true, default: () => <header data-testid="actual-header-consumer" />,
}))

describe('map header SSR reservation (#2330)', () => {
  let root: Root | undefined
  let container: HTMLDivElement
  const initialPlatform = Platform.OS
  beforeEach(() => {
    Platform.OS = 'web'
    mockPath = '/map'
    mockHydrated = false
    mockWidth = null
    container = document.createElement('div')
    document.body.appendChild(container)
  })
  afterEach(async () => {
    await act(async () => root?.unmount())
    root = undefined
    container.remove()
    Platform.OS = initialPlatform
  })

  it.each(['/map', '/map/details'])('marks %s identically on SSR and first client, then removes mobile header', async path => {
    mockPath = path
    const server = renderToString(<TabLayout />)
    expect(server).toContain('data-map-header-slot="true"')
    container.innerHTML = server
    mockWidth = 390
    const recoverable = jest.fn()
    await act(async () => { root = hydrateRoot(container, <TabLayout />, { onRecoverableError: recoverable }) })
    expect(container.innerHTML).toBe(server)
    expect(recoverable).not.toHaveBeenCalled()
    mockHydrated = true
    await act(async () => mockHydrationListeners.forEach(callback => callback()))
    expect(container.querySelector('[data-header-slot]')).toBeNull()
  })

  it('retains the wide map slot and does not mark other routes', async () => {
    mockHydrated = true
    mockWidth = HEADER_LAYOUT_BREAKPOINTS.mobileContext
    container.innerHTML = renderToString(<TabLayout />)
    await act(async () => { root = hydrateRoot(container, <TabLayout />) })
    expect(container.querySelector('[data-map-header-slot="true"]')).not.toBeNull()
    mockPath = '/places'
    const other = renderToString(<TabLayout />)
    expect(other).toContain('data-header-slot=""')
    expect(other).not.toContain('data-map-header-slot')
  })

  it('keeps native map suppression and the exact CSS breakpoint shared', () => {
    Platform.OS = 'ios'
    expect(renderToString(<TabLayout />)).toBe('')
    expect(HEADER_LAYOUT_BREAKPOINTS.mobileContext).toBe(768)
    const css = buildCriticalCSS()
    const marker = '[data-header-slot=""][data-map-header-slot="true"]'
    expect(css).toContain(`${marker}{display:none !important;height:0 !important;min-height:0 !important}`)
    const mobileStart = css.indexOf('@media (max-width:767.98px){')
    expect(mobileStart).toBeGreaterThanOrEqual(0)
    expect(css.indexOf(marker)).toBeGreaterThan(mobileStart)
    expect(css.slice(mobileStart, css.indexOf(marker))).not.toContain('@media (min-width:')
  })
})
