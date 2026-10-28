import React from 'react'
import { render } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'
import HomeHero from '@/components/home/HomeHero'

const mockViewport = { width: 2048, height: 900, isDesktop: true, isPortrait: false }
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: { OS: 'web', select: (options: any) => options.web ?? options.default },
  OS: 'web', select: (options: any) => options.web ?? options.default,
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/components/home/useHomeViewport', () => ({ useHomeViewport: () => mockViewport }))
jest.mock('@/utils/analytics')
jest.mock('@/utils/externalLinks')
jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: () => null,
  isIOSSafariUserAgent: () => false,
}))

it('updates book paper and typography on a height-only rerender while keeping all content inside its scroll frame', async () => {
  // The RN Jest preset resets Platform.select to its native implementation.
  const selectSpy = jest.spyOn(Platform, 'select').mockImplementation((options: any) => options.web ?? options.default)
  const result = await render(<HomeHero />)
  const page = () => StyleSheet.flatten(result.getByTestId('home-hero-left-page').props.style)
  const frame = () => StyleSheet.flatten(result.getByTestId('home-hero-left-frame').props.style)
  const title = () => StyleSheet.flatten(result.getByText(/Куда поехать/).props.style)
  const initialInset = page().paddingTop
  const initialTitle = parseFloat(title().fontSize)
  expect(frame()).toMatchObject({ overflowY: 'auto', overflowX: 'hidden', minHeight: 0 })
  mockViewport.height = 640
  // Change an inert compatibility prop to drive the mocked hook's new snapshot
  // through React.memo; the real viewport hook drives its own state update.
  await result.rerender(<HomeHero travelsCount={1} />)
  expect(page().paddingTop).toBeLessThan(initialInset)
  expect(parseFloat(title().fontSize)).toBeLessThan(initialTitle)
  expect(parseFloat(title().fontSize)).toBeGreaterThanOrEqual(24)
  expect(result.getByLabelText('Поиск маршрутов')).toBeTruthy()
  expect(result.getByLabelText('Смотреть маршруты')).toBeTruthy()
  mockViewport.height = 900
  await result.rerender(<HomeHero travelsCount={2} />)
  expect(page().paddingTop).toBe(initialInset)
  selectSpy.mockRestore()
})
