import { lazy } from 'react';

// Start loading with the route module so static rendering can finish the
// Suspense boundary instead of emitting React's incomplete-boundary marker.
// The implementation remains a separate route-only chunk.
const listTravelImport = Promise.resolve(import('./ListTravelBase'));
const ListTravelRoute = lazy(() =>
  listTravelImport.then((module) => ({ default: module.default }))
);

export default ListTravelRoute;
