import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('@/components/travel/details/TravelDetailsContainer', () => () => null)
jest.mock('@/components/travel/details/TravelLoaderScreen.web', () => ({ __esModule: true, default: jest.fn(() => null) }))
jest.mock('@/components/travel/details/travelRouteLoader', () => { throw new Error('Server-only loader was evaluated in the client route') })
jest.mock('@/components/travel/details/hooks/travelDetailsContainerViewModel', () => ({ getTravelDetailsSeoViewModel: jest.fn() }))
jest.mock('@/utils/seoRoutes/routeMetadata', () => ({ routeMetadata: jest.fn(), shellRouteMetadata: jest.fn() }))

import TravelDetailsScreen from '../../app/(tabs)/travels/[param].web'
import TravelLoaderScreen from '@/components/travel/details/TravelLoaderScreen.web'

it('does not mount a loader subscriber while production still serves generated static pages', async () => {
  const previous = process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR
  delete process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR
  try {
    await render(<TravelDetailsScreen />)
    expect(TravelLoaderScreen).not.toHaveBeenCalled()
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR
    else process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = previous
  }
})
