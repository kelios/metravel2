/**
 * #2910: после перехода `/search` → статья прежний экран Tabs-навигатора
 * остаётся смонтированным (Back возвращает его с состоянием), но не должен
 * участвовать в странице: его кнопки выпадают из фокуса и дерева скринридера.
 */
import type React from 'react'
import { renderToString } from 'react-dom/server.node'
import { Platform } from 'react-native'
import TabLayout from '@/app/(tabs)/_layout'
import {
  InactiveScreenBoundary,
  inactiveScreenWebAttributes,
  renderInactiveScreenBoundary,
} from '@/components/layout/InactiveScreenBoundary'

let mockFocused = true
const mockTabsProps: Array<Record<string, unknown>> = []
jest.mock('expo-router', () => {
  const Tabs = (props: Record<string, unknown> & { children: React.ReactNode }) => {
    mockTabsProps.push(props)
    return null
  }
  Tabs.Screen = () => null
  return { Tabs, usePathname: () => '/search', useIsFocused: () => mockFocused }
})
jest.mock('@/components/layout/CustomHeader', () => () => null)
jest.mock('@/components/layout/useListFilterQuery', () => ({ useHasListFilterQuery: () => false }))

const html = (node: React.ReactElement) => renderToString(node)

describe('InactiveScreenBoundary (#2910)', () => {
  const originalPlatform = Platform.OS
  afterEach(() => {
    Platform.OS = originalPlatform
    mockFocused = true
    mockTabsProps.length = 0
  })

  it('keeps the focused web screen fully interactive and layout-neutral', () => {
    Platform.OS = 'web'
    const out = html(<InactiveScreenBoundary><button>Добавить в план</button></InactiveScreenBoundary>)
    expect(out).toContain('data-screen-boundary="active"')
    expect(out).toContain('display:contents')
    expect(out).not.toContain('inert')
    expect(out).not.toContain('aria-hidden')
  })

  it('makes a blurred web screen inert and hidden from assistive tech without unmounting it', () => {
    Platform.OS = 'web'
    mockFocused = false
    const out = html(<InactiveScreenBoundary><button>Добавить в план</button></InactiveScreenBoundary>)
    expect(out).toContain('data-screen-boundary="inactive"')
    expect(out).toContain('inert=""')
    expect(out).toContain('aria-hidden="true"')
    expect(out).toContain('Добавить в план')
  })

  it('adds no wrapper and no attributes on native', () => {
    Platform.OS = 'ios'
    mockFocused = false
    expect(inactiveScreenWebAttributes(false)).toBeNull()
    expect(html(<InactiveScreenBoundary><button>x</button></InactiveScreenBoundary>)).toBe('<button>x</button>')
  })

  it('wires the boundary as the web Tabs screenLayout and leaves native navigators untouched', () => {
    Platform.OS = 'web'
    renderToString(<TabLayout />)
    expect(mockTabsProps.at(-1)?.screenLayout).toBe(renderInactiveScreenBoundary)

    Platform.OS = 'android'
    renderToString(<TabLayout />)
    expect(mockTabsProps.at(-1)?.screenLayout).toBeUndefined()
  })

  it('hides the header slot of a blurred screen with the same rule', () => {
    Platform.OS = 'web'
    renderToString(<TabLayout />)
    const header = (mockTabsProps.at(-1)?.screenOptions as { header: () => React.ReactElement }).header
    mockFocused = false
    const out = html(header())
    expect(out).toContain('data-header-slot=""')
    expect(out).toContain('inert=""')
    expect(out).toContain('aria-hidden="true"')

    mockFocused = true
    expect(html(header())).not.toContain('inert')
  })
})
