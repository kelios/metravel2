import { act, render, screen } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import TravelLoaderErrorBoundary from '@/components/travel/details/TravelLoaderErrorBoundary.web'

const mockMounted = jest.fn()
jest.mock('@/services/offline/loadTravelOfflineAdapter', () => ({ loadTravelOfflineAdapter: async () => ({}) }))
jest.mock('@/components/travel/details/TravelOfflineReader.web', () => {
  const { useEffect } = require('react')
  const { Text } = require('react-native')
  return function LocalReader() {
    useEffect(() => { mockMounted() }, [])
    return <Text>local-package-reader</Text>
  }
})
jest.mock('@/components/ui/LoaderScreenErrorBoundary', () => {
  const { Text } = require('react-native')
  return function LoaderFailure() { return <Text>loader-retry</Text> }
})

const error = new Error('Failed to load loader data for route: /(tabs)/travels/saved-route')

describe('travel loader offline recovery (#3066)', () => {
  beforeEach(() => {
    mockMounted.mockClear()
    onlineManager.setOnline(true)
  })
  afterEach(() => { onlineManager.setOnline(true) })

  it('uses the existing local reader after a failed loader without remounting on reconnect', async () => {
    onlineManager.setOnline(false)
    await render(<TravelLoaderErrorBoundary error={error} retry={jest.fn()} />)
    expect(screen.getByText('local-package-reader')).toBeTruthy()
    await act(async () => { onlineManager.setOnline(true) })
    expect(screen.getByText('local-package-reader')).toBeTruthy()
    expect(mockMounted).toHaveBeenCalledTimes(1)
  })

  it('retains the online loader retry and recovers if reachability then becomes offline', async () => {
    await render(<TravelLoaderErrorBoundary error={error} retry={jest.fn()} />)
    expect(screen.getByText('loader-retry')).toBeTruthy()
    expect(mockMounted).not.toHaveBeenCalled()
    await act(async () => { onlineManager.setOnline(false) })
    expect(screen.getByText('local-package-reader')).toBeTruthy()
  })

  it('does not hide unrelated render errors while offline', async () => {
    onlineManager.setOnline(false)
    await render(<TravelLoaderErrorBoundary error={new Error('render failure')} retry={jest.fn()} />)
    expect(screen.getByText('loader-retry')).toBeTruthy()
    expect(mockMounted).not.toHaveBeenCalled()
  })
})
