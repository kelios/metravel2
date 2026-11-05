import { render, screen } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'
import TravelOfflineReader from '@/components/travel/details/TravelOfflineReader.web'
import { useTravelDetails } from '@/hooks/useTravelDetails'
import type { Travel } from '@/types/types'
import { translate } from '@/i18n'

const mockPoints = jest.fn()

jest.mock('@/hooks/useTravelDetails')
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/components/seo/LazyInstantSEO', () => () => null)
jest.mock('@/components/travel/TravelDescriptionHtml.web', () => {
  const { Text } = require('react-native')
  return function Html({ html }: { html: string }) { return <Text testID="saved-html">{html}</Text> }
})
jest.mock('@/components/travel/PointList', () => {
  const { Text } = require('react-native')
  return function Points({ points }: { points: Array<{ address: string }> }) {
    mockPoints(points)
    return <Text>{points.map((point) => point.address).join(', ')}</Text>
  }
})

const savedTravel = {
  id: 765, slug: 'saved', name: 'Saved route',
  description: '<h1>Authored heading</h1><p>Saved paragraph</p><script>bad()</script><img src="/photo.jpg" onerror="bad()">',
  travelAddress: [{ id: 1, address: 'Saved point', coord: '50,20' }],
} as unknown as Travel

beforeEach(() => {
  mockPoints.mockClear()
  jest.mocked(useTravelDetails).mockReturnValue({
    travel: savedTravel,
    slug: 'saved', isLoading: false, isError: false, error: null,
    refetch: jest.fn(), hasInitialPreloadedTravel: false, isId: false, isMissingParam: false, staleContentMeta: null,
  })
})

it('renders saved text and points without requiring the online travel tree', async () => {
  await render(<TravelOfflineReader />)
  expect(screen.getByText('Saved point')).toBeTruthy()
  expect(screen.getByTestId('saved-html').props.children).toContain('Saved paragraph')
  expect(screen.getByTestId('saved-html').props.children).not.toMatch(/script|onerror|bad\(\)/)
  expect(screen.getByTestId('saved-html').props.children).toContain('<h2>Authored heading</h2>')
  expect(screen.getByTestId('saved-html').props.children).not.toContain('<h1>')
})

it('preserves string addresses and legacy coordinate shapes, including empty canonical fields', async () => {
  const details = jest.mocked(useTravelDetails).getMockImplementation()!()
  jest.mocked(useTravelDetails).mockReturnValue({ ...details, travel: {
    ...savedTravel,
    travelAddress: [
      'Legacy address',
      { id: 2, name: 'Named point', coords: '51,21' },
      { id: 3, name: 'Lat/lng point', lat: 52, lng: 22 },
      { id: 4, name: 'Fallback point', address: '', coord: '', coords: '53,23' },
    ],
  } as unknown as Travel })
  await render(<TravelOfflineReader />)
  expect(mockPoints).toHaveBeenLastCalledWith([
    { id: '0', address: 'Legacy address', coord: '' },
    expect.objectContaining({ id: '2', address: 'Named point', coord: '51,21' }),
    expect.objectContaining({ id: '3', address: 'Lat/lng point', coord: '52,22' }),
    expect.objectContaining({ id: '4', address: 'Fallback point', coord: '53,23' }),
  ])
})

it('reserves the shared web dock and notice height below the final point', async () => {
  const originalOS = Platform.OS
  ;(Platform.OS as string) = 'web'
  try {
    await render(<TravelOfflineReader />)
    const content = StyleSheet.flatten(screen.getByTestId('travel-offline-reader').props.contentContainerStyle)
    expect(content.paddingBottom).toContain('--mt-dock-h')
    expect(content.paddingBottom).toContain('--mt-consent-h')
  } finally { (Platform.OS as string) = originalOS }
})

it('explains a missing package instead of rendering an empty article', async () => {
  const details = jest.mocked(useTravelDetails).getMockImplementation()!()
  jest.mocked(useTravelDetails).mockReturnValue({ ...details, travel: undefined, isError: true, error: new Error('OFFLINE_CONTENT_NOT_SAVED') })
  await render(<TravelOfflineReader />)
  expect(screen.getByText(translate('offline:missingTitle'))).toBeTruthy()
  expect(screen.queryByTestId('travel-offline-reader')).toBeNull()
})

it('omits the points section for a saved article without points', async () => {
  const details = jest.mocked(useTravelDetails).getMockImplementation()!()
  jest.mocked(useTravelDetails).mockReturnValue({ ...details, travel: { ...savedTravel, travelAddress: [] } })
  await render(<TravelOfflineReader />)
  expect(screen.queryByTestId('travel-details-points')).toBeNull()
  expect(screen.getByTestId('saved-html')).toBeTruthy()
})
