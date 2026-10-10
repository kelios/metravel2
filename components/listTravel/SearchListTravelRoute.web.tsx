import { lazy } from 'react';

// The search entry owns this tiny boundary. Sharing its module with unrelated
// routes made Metro emit a separate eager request just for the lazy wrapper.
// Start the same body import at module load so SSG can finish Suspense.
const listTravelImport = Promise.resolve(import('./ListTravelBase'));
const SearchListTravelRoute = lazy(() =>
  listTravelImport.then((module) => ({ default: module.default }))
);

export default SearchListTravelRoute;
