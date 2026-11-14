import { MAP_COMPACT_MIN_FIT_ZOOM } from '@/constants/mapDefaults';
import type { LatLng } from '@/types/coordinates';

/** Edge of the web-mercator world at zoom 0, px. */
const WORLD_EDGE_PX = 256;

type FitPadding = {
  paddingTopLeft?: [number, number];
  paddingBottomRight?: [number, number];
};

type FitFloorArgs = {
  map: any;
  paddedBounds: any;
  /** The fit target is the radius circle (possibly tightened to its points). */
  targetIsCircle: boolean;
  compactPane: boolean;
  padding: FitPadding | null | undefined;
  /** The caller's own centre; frames a point set the pane cannot hold whole. */
  anchor: LatLng;
};

/**
 * #3397 — the lowest zoom at which one world still covers the pane height. Below
 * it the map is a strip between two empty bands (z0 on a phone: 256 px of world in
 * a 700 px pane), so a point set wider than that cannot be shown whole anyway.
 */
export const getWorldCoverZoom = (map: any): number | null => {
  try {
    const height = Number(map?.getSize?.()?.y);
    if (!Number.isFinite(height) || height <= 0) return null;
    return Math.max(0, Math.ceil(Math.log2(height / WORLD_EDGE_PX)));
  } catch {
    return null;
  }
};

/**
 * The auto-fit never zooms out past a floor. Returns the view to set directly when
 * the fitted zoom would land below it, or `null` when the bounds fit as they are.
 *
 * - Circle target on a narrow pane (#1348): r=50 km in 390 px fits at z8, half a
 *   region, and reads as "the map has no idea where I am". Only that regional case
 *   is rescued; small radii and wide panes keep their exact circle fit.
 * - Point target (#3397, no circle — a catalog surface): the set itself is the
 *   view, so the only floor is the zoom where one world still covers the pane. A
 *   wider set is centred on the caller's anchor, not on the midpoint of its outliers.
 */
export function resolveFitFloor({
  map,
  paddedBounds,
  targetIsCircle,
  compactPane,
  padding,
  anchor,
}: FitFloorArgs): { zoom: number; center: LatLng } | null {
  const floorZoom = targetIsCircle
    ? compactPane
      ? MAP_COMPACT_MIN_FIT_ZOOM
      : null
    : getWorldCoverZoom(map);
  if (floorZoom == null || typeof map?.getBoundsZoom !== 'function') return null;

  // Leaflet's fitBounds subtracts the pixel padding before choosing a zoom; the
  // point fit is judged by the same number it would land on. The circle rule keeps
  // its original unpadded measure.
  const fittedZoom = Number(
    targetIsCircle
      ? map.getBoundsZoom(paddedBounds, false)
      : map.getBoundsZoom(paddedBounds, false, [
          (padding?.paddingTopLeft?.[0] ?? 0) + (padding?.paddingBottomRight?.[0] ?? 0),
          (padding?.paddingTopLeft?.[1] ?? 0) + (padding?.paddingBottomRight?.[1] ?? 0),
        ]),
  );
  if (!Number.isFinite(fittedZoom) || fittedZoom >= floorZoom) return null;

  const center =
    !targetIsCircle && Number.isFinite(anchor.lat) && Number.isFinite(anchor.lng)
      ? anchor
      : typeof paddedBounds?.getCenter === 'function'
        ? paddedBounds.getCenter()
        : null;
  return center ? { zoom: floorZoom, center } : null;
}
