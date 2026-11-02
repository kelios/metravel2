import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { Point } from './types';

/** Keep an explicit URL target visible independently of the fetched place layer. */
export function mergeMapUrlPoint(points: Point[], urlPoint?: Point | null): Point[] {
  if (!urlPoint) return points;
  const target = CoordinateConverter.fromLooseString(urlPoint.coord);
  if (!target || !CoordinateConverter.isValid(target)) return points;

  const existing = points.findIndex(point => {
    const coordinate = CoordinateConverter.fromLooseString(point.coord);
    return coordinate && Math.abs(coordinate.lat - target.lat) <= 0.000001 &&
      Math.abs(coordinate.lng - target.lng) <= 0.000001;
  });
  if (existing < 0) return [...points, urlPoint];
  const point = points[existing];
  if (point.coord === urlPoint.coord && point.address === urlPoint.address) return points;

  // Retain the published place identity, source pager and article actions while
  // using the exact requested coordinate and physical name, without a second pin.
  return points.map((item, index) => index === existing
    ? { ...item, coord: urlPoint.coord, address: urlPoint.address }
    : item);
}
