import UpsertTravelRoute from '@/components/travel/upsert/UpsertTravelRoute'

// Native keeps the route synchronous. Web has a platform-specific lazy entry
// so the shared create/edit implementation is not hoisted into `__common`.
export default UpsertTravelRoute
