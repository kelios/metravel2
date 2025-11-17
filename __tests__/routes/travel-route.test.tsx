import TravelRoute from '@/app/(tabs)/travels/[param]'
import TravelDetailsContainer from '@/components/travel/details/TravelDetailsContainer'

describe('travel route module', () => {
  it('re-exports TravelDetailsContainer to keep logic centralized', () => {
    expect(TravelRoute).toBe(TravelDetailsContainer)
  })
})

