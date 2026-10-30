/** @jest-environment jsdom */
import type { Root } from 'react-dom/client'

let ReactActual: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let Platform: typeof import('react-native').Platform
let View: typeof import('react-native').View
let AccountSection: typeof import('@/components/layout/CustomHeaderAccountSection').default
let MoreFallback: typeof import('@/components/layout/WebMobileDockShell').WebHeaderMoreFallback
let buildStyles: typeof import('@/components/layout/customHeaderStyles').createCustomHeaderStyles
let colors: ReturnType<typeof import('@/constants/designSystem').getThemedColors>
let mockReady = false
let mockPending: Promise<void>
let release: () => void
let container: HTMLDivElement
let root: Root

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@expo/vector-icons/Feather', () => () => null)
  jest.doMock('expo-router', () => ({ usePathname: () => '/search', useRouter: () => ({ navigate: jest.fn() }) }))
  jest.doMock('@/components/layout/customHeaderAccountLazy', () => ({
    CustomHeaderMobileAccountSectionComp: () => {
      if (!mockReady) throw mockPending
      return require('react').createElement('button', { 'data-testid': 'mobile-menu-open' }, 'Menu')
    },
    CustomHeaderDesktopAccountSectionComp: () => {
      if (!mockReady) throw mockPending
      return require('react').createElement('button', { 'data-testid': 'desktop-account' }, 'Account')
    },
  }))
  ReactActual = require('react')
  ;({ createRoot } = require('react-dom/client'))
  ;({ Platform, View } = require('react-native'))
  AccountSection = require('@/components/layout/CustomHeaderAccountSection').default
  MoreFallback = require('@/components/layout/WebMobileDockShell').WebHeaderMoreFallback
  buildStyles = require('@/components/layout/customHeaderStyles').createCustomHeaderStyles
  colors = require('@/constants/designSystem').getThemedColors(false)
})

beforeEach(() => {
  mockReady = false
  mockPending = new Promise<void>((resolve) => { release = resolve })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await ReactActual.act(async () => root.unmount())
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  container.remove()
})

async function renderAccount(platform: 'web' | 'android' | 'ios', isMobile = true) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })
  const styles = buildStyles(colors, isMobile)
  const section = ReactActual.createElement(AccountSection, { activePath: '/search', isMobile, styles })
  // Match CustomHeader's platform boundary: only web already owns this slot.
  await ReactActual.act(async () => root.render(platform === 'web'
    ? ReactActual.createElement(View, { testID: 'account-slot', style: isMobile ? styles.rightSectionMobile : styles.rightSection },
      isMobile ? ReactActual.createElement(MoreFallback, { color: colors.text }) : null,
      section)
    : section))
}

async function resolveAccount() {
  await ReactActual.act(async () => {
    mockReady = true
    release()
    await mockPending
  })
}

it('keeps the real More fallback as the sole web slot child while the inner mobile chunk is pending', async () => {
  await renderAccount('web')
  const slot = container.querySelector('[data-testid="account-slot"]')!
  const more = slot.querySelector<HTMLAnchorElement>('[data-testid="header-more-fallback"]')!
  expect(more.getAttribute('href')).toBe('/more')
  expect(more.getAttribute('aria-label')).toBeTruthy()
  expect(slot.children).toHaveLength(1)
  expect(slot.firstElementChild).toBe(more)
  expect(getComputedStyle(slot).flexGrow).toBe('1')
  expect(getComputedStyle(slot).flexShrink).toBe('1')
  expect(getComputedStyle(slot).flexBasis).toBe('0%')

  await resolveAccount()
  const menu = slot.querySelector('[data-testid="mobile-menu-open"]')!
  expect(menu).not.toBeNull()
  expect(menu.parentElement).toBe(slot)
  expect(slot.children).toHaveLength(2)
  expect(slot.querySelector('[data-testid="header-more-fallback"]')).toBe(more)
})

it.each(['android', 'ios'] as const)('preserves the native %s flexible account container across inner suspension', async (platform) => {
  await renderAccount(platform)
  const wrapper = container.firstElementChild!
  expect(wrapper.tagName).toBe('DIV')
  expect(getComputedStyle(wrapper).flexGrow).toBe('1')
  expect(getComputedStyle(wrapper).flexShrink).toBe('1')
  expect(getComputedStyle(wrapper).flexBasis).toBe('0%')
  expect(wrapper.children).toHaveLength(0)
  await resolveAccount()
  expect(container.firstElementChild).toBe(wrapper)
  expect(wrapper.querySelector('[data-testid="mobile-menu-open"]')?.parentElement).toBe(wrapper)
})

it('preserves the wide web reserved-width fallback and replaces it when ready', async () => {
  await renderAccount('web', false)
  const slot = container.querySelector('[data-testid="account-slot"]')!
  const fallback = slot.firstElementChild!
  const { HEADER_ACCOUNT_SLOT_WIDTH } = require('@/components/layout/customHeaderStyles')
  expect(slot.children).toHaveLength(1)
  expect(getComputedStyle(fallback).width).toBe(`${HEADER_ACCOUNT_SLOT_WIDTH}px`)
  await resolveAccount()
  expect(slot.querySelector('[data-testid="desktop-account"]')?.parentElement).toBe(slot)
  expect(fallback.isConnected).toBe(false)
})
