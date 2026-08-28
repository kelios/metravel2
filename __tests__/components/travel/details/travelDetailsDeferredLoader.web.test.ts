import {
  getInitialDeferredSectionsComponent,
  loadDeferredSectionsComponent,
} from '@/components/travel/details/travelDetailsDeferredLoader.web'

jest.mock('@/components/travel/details/TravelDetailsDeferred', () => ({
  TravelDeferredSections: function MockDeferredSections() {
    return null
  },
}))

describe('travelDetailsDeferredLoader.web', () => {
  it('does not synchronously require deferred sections', () => {
    expect(getInitialDeferredSectionsComponent()).toBeNull()
  })

  it('loads deferred sections through import()', async () => {
    const loaded = await loadDeferredSectionsComponent()
    expect(loaded).toEqual(expect.any(Function))
  })
})
