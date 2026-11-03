export type MapLabelPosition = {x: number; y: number};
export type MapLabelPoint = MapLabelPosition & {stopId: string; ordinal: number; label: MapLabelPosition};
export type MapRect = {x: number; y: number; width: number; height: number};
/** `reserved` keeps decorations (scale bar) clear; `avoid` (city names) only costs a detour. */
export type MapLabelGeometry = {widthMm: number; heightMm: number; labelRadiusMm: number; reserved?: readonly MapRect[]; avoid?: readonly MapRect[]};
export const MAP_LABEL_GAP_MM = .65;
export const MAP_DOT_RADIUS_MM = .45;
export const mapLabelDistance = (a: MapLabelPosition, b: MapLabelPosition) => Math.hypot(a.x - b.x, a.y - b.y);
const touches = (point: MapLabelPosition, radius: number, rect: MapRect) =>
  point.x + radius > rect.x && point.x - radius < rect.x + rect.width && point.y + radius > rect.y && point.y - radius < rect.y + rect.height;

function crosses(a: MapLabelPosition, b: MapLabelPosition, c: MapLabelPosition, d: MapLabelPosition): boolean {
  const side = (p: MapLabelPosition, q: MapLabelPosition, r: MapLabelPosition) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

function findLabel(point: MapLabelPoint, all: readonly MapLabelPoint[], placed: readonly MapLabelPoint[], geometry: MapLabelGeometry): MapLabelPosition {
  const {widthMm, heightMm, labelRadiusMm: radius} = geometry;
  const inset = radius + MAP_LABEL_GAP_MM;
  let best: MapLabelPosition | undefined, bestScore = Infinity;
  const step = (2 * radius + MAP_LABEL_GAP_MM) * .65;
  const limit = Math.hypot(widthMm, heightMm);
  for (let ring = 0; ring * step <= limit; ring++) {
    const count = ring === 0 ? 1 : 32;
    for (let slot = 0; slot < count; slot++) {
      const angle = slot / count * Math.PI * 2 - Math.PI / 2;
      const candidate = {x: point.x + Math.cos(angle) * ring * step, y: point.y + Math.sin(angle) * ring * step};
      if (candidate.x < inset || candidate.x > widthMm - inset || candidate.y < inset || candidate.y > heightMm - inset) continue;
      if (candidate.x + radius > widthMm - 12 && candidate.y - radius < 14) continue;
      if (geometry.reserved?.some(rect => touches(candidate, radius, rect))) continue;
      if (placed.some(other => mapLabelDistance(candidate, other.label) < 2 * radius + MAP_LABEL_GAP_MM)) continue;
      if (all.some(other => other.stopId !== point.stopId && mapLabelDistance(candidate, other) < radius + MAP_DOT_RADIUS_MM + .2)) continue;
      const crossings = placed.filter(other => crosses(point, candidate, other, other.label)).length;
      const covered = geometry.avoid?.filter(rect => touches(candidate, radius, rect)).length ?? 0;
      const score = mapLabelDistance(point, candidate) + crossings * step * 2 + covered * step * 6;
      if (score < bestScore) {best = candidate; bestScore = score;}
    }
    if (best && (ring + 1) * step > bestScore) break;
  }
  if (!best) throw new Error('Selected places need more map space to keep every numbered label readable');
  return best;
}

/** Stable dense-cluster-first placement shared by country and quest maps. */
export function placeMapLabels<T extends MapLabelPoint>(markers: T[], geometry: MapLabelGeometry): T[] {
  const priority = markers.map(marker => ({marker, nearest: Math.min(...markers.filter(other => other !== marker).map(other => mapLabelDistance(marker, other)))}))
    .sort((a, b) => a.nearest - b.nearest || a.marker.ordinal - b.marker.ordinal);
  const placed: T[] = [];
  for (const {marker} of priority) {marker.label = findLabel(marker, markers, placed, geometry); placed.push(marker);}
  return markers;
}
