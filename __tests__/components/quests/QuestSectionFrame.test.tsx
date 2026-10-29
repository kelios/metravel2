import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { Platform, Text } from 'react-native'

import { QuestSectionFrame } from '@/components/quests/QuestSectionFrame'

let mockWidth = 390
const originalPlatform = Platform.OS

jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => ({ width: mockWidth, isMobile: mockWidth < 768 }),
}))
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => require('@/constants/designSystem').getThemedColors(false),
}))

beforeEach(() => {
  ;(Platform as { OS: string }).OS = 'web'
  mockWidth = 390
  document.documentElement.style.overflow = 'scroll'
  document.body.style.overflow = 'auto'
  document.body.style.touchAction = 'pan-x'
})
afterEach(() => {
  ;(Platform as { OS: string }).OS = originalPlatform
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
  document.body.style.touchAction = ''
})

const page = (drawerOpen: boolean, onCloseDrawer: () => void) => (
  <QuestSectionFrame
    sidebar={<Text>Desktop navigation</Text>}
    drawerSidebar={<Text>Drawer navigation</Text>}
    drawerOpen={drawerOpen}
    onCloseDrawer={onCloseDrawer}
  ><Text>Page content</Text></QuestSectionFrame>
)

it('owns the mobile scroll lock, overlay and Escape close, restoring prior body styles', async () => {
  const close = jest.fn()
  const { getByTestId, queryByTestId, rerender } = await render(page(true, close))
  expect(getByTestId('quests-mobile-sidebar')).toBeTruthy()
  expect(document.documentElement.style.overflow).toBe('hidden')
  expect(document.body.style.overflow).toBe('hidden')
  expect(document.body.style.touchAction).toBe('none')
  await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })) })
  expect(close).toHaveBeenCalledTimes(1)
  await fireEvent.press(getByTestId('quests-sidebar-overlay'))
  expect(close).toHaveBeenCalledTimes(2)
  await rerender(page(false, close))
  expect(queryByTestId('quests-mobile-sidebar')).toBeNull()
  expect(document.documentElement.style.overflow).toBe('scroll')
  expect(document.body.style.overflow).toBe('auto')
  expect(document.body.style.touchAction).toBe('pan-x')
})

it('releases the mobile lock on a desktop resize without replacing the content host', async () => {
  const close = jest.fn()
  const { getByTestId, queryByTestId, getByText, rerender } = await render(page(true, close))
  const reading = getByText('Page content')
  mockWidth = 1440
  await rerender(page(true, close))
  expect(getByTestId('quests-desktop-sidebar-slot')).toBeTruthy()
  expect(queryByTestId('quests-mobile-sidebar')).toBeNull()
  expect(getByText('Page content')).toBe(reading)
  expect(document.body.style.overflow).toBe('auto')
  expect(close).not.toHaveBeenCalled()
})
