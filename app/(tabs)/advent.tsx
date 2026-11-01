import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata';
import { ADVENT_ROUTE } from '@/constants/advent';

export { default } from '@/components/advent/AdventScreen';

// #2866: head статического HTML — из общей таблицы utils/seoRoutes/staticRoutes.js
export function generateMetadata() {
  return staticRouteMetadata(ADVENT_ROUTE);
}
