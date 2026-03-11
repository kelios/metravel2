// api/travelsApi.ts
// Barrel re-export for backward compatibility (task A2)
// All implementation moved to:
//   - travelsNormalize.ts (normalization + types)
//   - travelsQueries.ts (GET queries)
//   - travelsMutations.ts (mutations)

export { normalizeTravelItem, type MyTravelsItem, type MyTravelsPayload } from './travelsNormalize';

export {
    fetchTravelFacets,
    fetchTravels,
    fetchRandomTravels,
    fetchMyTravels,
    unwrapMyTravelsPayload,
    type TravelFacetItem,
    type TravelFacetsResponse,
} from './travelsQueries';

export { fetchTravel, fetchTravelBySlug } from './travelDetailsQueries';

export { deleteTravel } from './travelsMutations';
