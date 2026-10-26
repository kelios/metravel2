import React from 'react'
import { render } from '@testing-library/react-native'
import { Platform } from 'react-native'
import HomeHero from '@/components/home/HomeHero'

// #2773: on common laptop screens the desktop book is too low for its page
// notes, and the quick ideas used to vanish from the first screen entirely.
const mockViewport = { width: 1440, height: 900, isDesktop: true, isPortrait: false }
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

const quickIdea = /Карта до 60 км/

beforeEach(() => {
  jest.spyOn(Platform, 'select').mockImplementation((options: any) => options.web ?? options.default)
})

afterEach(() => {
  jest.restoreAllMocks()
})

it.each([
  [1440, 900],
  [1366, 768],
])('keeps the quick ideas on the first screen of a %ix%i laptop book', (width, height) => {
  Object.assign(mockViewport, { width, height })
  const result = render(<HomeHero />)
  expect(result.getByTestId('home-hero-left-page')).toBeTruthy()
  expect(result.getAllByLabelText(quickIdea)).toHaveLength(1)
})

it('does not duplicate the quick ideas when the tall book shows them as page notes', () => {
  Object.assign(mockViewport, { width: 2048, height: 1200 })
  const result = render(<HomeHero />)
  expect(result.getByTestId('home-hero-left-page')).toBeTruthy()
  expect(result.getAllByLabelText(quickIdea)).toHaveLength(1)
})
