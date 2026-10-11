import type { Travel } from '@/types/types';
import { parseTravelCoords } from '@/utils/questForLocation';

export type NearTravelCoordinateSource = Partial<Pick<Travel, 'travelAddress' | 'coordsMeTravel'>>;

export function getNearTravelMapOrigin(travel: NearTravelCoordinateSource) {
  const coordinates = parseTravelCoords([
    ...(Array.isArray(travel.travelAddress) ? travel.travelAddress : []),
    ...(Array.isArray(travel.coordsMeTravel) ? travel.coordsMeTravel : []),
  ]);
  return coordinates.find(({ lat, lng }) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180) ?? null;
}

export function canShowNearTravelMapMode(
  origin: ReturnType<typeof getNearTravelMapOrigin>,
  mapPoints: readonly unknown[] = [],
) {
  return origin !== null || mapPoints.length > 0;
}
