import fs from 'fs'
import path from 'path'
import type React from 'react'
import { renderToString } from 'react-dom/server.node'
import { Platform } from 'react-native'
import TabLayout from '@/app/(tabs)/_layout'

// SSG-EXPORT-PARITY-001 (#2727): expo-router 58 Tabs turns a group file route that `_layout.tsx`
// does not declare into a placeholder tab, and the static export renders it as an empty
// `#main-content` without the header. `href: null` became a guarded redirect to the first tab.
const mockScreens: Array<{ name: string; options?: { href?: unknown } }> = []
jest.mock('expo-router', () => {
  const Tabs = ({ children }: { children: React.ReactNode }) => children
  Tabs.Screen = (props: { name: string; options?: { href?: unknown } }) => {
    mockScreens.push(props)
    return null
  }
  return { Tabs, usePathname: () => '/', useIsFocused: () => true }
})
jest.mock('@/components/layout/CustomHeader', () => () => null)
jest.mock('@/components/layout/useListFilterQuery', () => ({ useHasListFilterQuery: () => false }))

const TABS_DIR = path.resolve(__dirname, '..', '..', 'app', '(tabs)')

function fileRoutes(dir = TABS_DIR, prefix = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return fileRoutes(path.join(dir, entry.name), `${prefix}${entry.name}/`)
    if (!/\.(tsx?|jsx?)$/.test(entry.name) || /^[_+]/.test(entry.name)) return []
    return [`${prefix}${entry.name.replace(/(\.(native|web|ios|android))?\.(tsx?|jsx?)$/, '')}`]
  })
}

describe('(tabs) layout declares every group route (SSG-EXPORT-PARITY-001)', () => {
  const originalPlatform = Platform.OS
  afterEach(() => {
    Platform.OS = originalPlatform
    mockScreens.length = 0
  })

  it.each(['web', 'ios', 'android'] as const)('declares each file route once and keeps it addressable on %s', (platform) => {
    Platform.OS = platform
    renderToString(<TabLayout />)
    const declared = mockScreens.map((screen) => screen.name)
    expect(new Set(declared).size).toBe(declared.length)
    expect([...declared].sort()).toEqual([...new Set(fileRoutes())].sort())
    expect(mockScreens.filter((screen) => screen.options?.href === null).map((screen) => screen.name)).toEqual([])
  })
})
