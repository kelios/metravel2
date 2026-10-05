import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'

import ActionListSheet from '@/components/ui/ActionListSheet'
import { WEB_BOTTOM_CHROME_INSET } from '@/components/layout/bottomChromeInset'

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }
jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => mockInsets,
}))

// #2153 / MOBILE-INSETS-001: нижний отступ листа — из единственного источника
// резерва (#2097), а не из собственной константы высоты дока. Константа 58
// поднимала лист над краем там, где дока нет (чат, мастер, desktop).
describe('ActionListSheet: нижний отступ панели', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Platform.OS = originalOS
    mockInsets.bottom = 0
  })

  const panelStyle = () => {
    const { getByTestId } = render(<ActionListSheet visible onClose={jest.fn()} title="Действия" />)
    return StyleSheet.flatten(getByTestId('bottom-sheet-panel').props.style)
  }

  it('web: отступ — CSS-резерв дока и плашек, без литерала высоты дока', () => {
    Platform.OS = 'web'
    const style = panelStyle()
    expect(style.marginBottom).toBe(WEB_BOTTOM_CHROME_INSET)
    expect(String(style.marginBottom)).toContain('var(--mt-dock-h, 0px)')
  })

  it('native: Modal лежит поверх дока — отступа от края нет, низ панели резервирует home indicator', () => {
    Platform.OS = 'ios'
    mockInsets.bottom = 34
    const style = panelStyle()
    expect(style.marginBottom ?? 0).toBe(0)
    expect(style.paddingBottom).toBe(34)
  })

  it('native без нижней safe-area: остаётся базовый зазор панели', () => {
    Platform.OS = 'android'
    mockInsets.bottom = 0
    const style = panelStyle()
    expect(style.marginBottom ?? 0).toBe(0)
    expect(style.paddingBottom).toBe(16)
  })
})
