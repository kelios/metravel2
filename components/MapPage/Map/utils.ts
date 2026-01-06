// components/MapPage/map/utils.ts
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { CLUSTER_GRID } from './constants';

export const strToLatLng = (s: string): [number, number] | null => {
  const parsed = CoordinateConverter.fromLooseString(s);
  if (!parsed) return null;
  if (!CoordinateConverter.isValid(parsed)) return null;
  return [parsed.lng, parsed.lat];
};

export const buildClusterKey = (center: [number, number], count: number) =>
  `${center[0].toFixed(5)}|${center[1].toFixed(5)}|${count}`;

export const getClusterGridForZoom = (zoom: number): number => {
  if (!Number.isFinite(zoom)) return CLUSTER_GRID;
  if (zoom >= 16) return 0.0015;
  if (zoom >= 15) return 0.0025;
  if (zoom >= 14) return 0.005;
  if (zoom >= 13) return 0.01;
  if (zoom >= 12) return 0.02;
  if (zoom >= 11) return 0.03;
  return CLUSTER_GRID;
};

export const generateUniqueId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

