import isEqual from 'fast-deep-equal';
import type { MarkerData } from '@/types/types';
import { mergeMarkersPreserveImages } from '@/utils/travelFormNormalization';

const markerIdentityMatches = (left: MarkerData, right: MarkerData): boolean => {
  const leftId = left.id == null ? '' : String(left.id).trim();
  const rightId = right.id == null ? '' : String(right.id).trim();
  if (leftId && rightId) return leftId === rightId;
  const leftLat = Number(left.lat);
  const leftLng = Number(left.lng);
  const rightLat = Number(right.lat);
  const rightLng = Number(right.lng);
  if (![leftLat, leftLng, rightLat, rightLng].every(Number.isFinite)) return false;
  return Math.abs(leftLat - rightLat) + Math.abs(leftLng - rightLng) <= 1e-5;
};

export const findUnusedMarkerIndex = (
  candidates: MarkerData[],
  usedIndexes: Set<number>,
  target: MarkerData,
): number => {
  if (target.id != null) {
    const exactId = candidates.findIndex((candidate, index) =>
      !usedIndexes.has(index) && candidate.id != null && String(candidate.id) === String(target.id),
    );
    if (exactId >= 0) return exactId;
  }
  const matches = (candidate: MarkerData, index: number) =>
    !usedIndexes.has(index) && markerIdentityMatches(candidate, target);
  const sameAddress = candidates.findIndex((candidate, index) =>
    matches(candidate, index) && candidate.address === target.address,
  );
  return sameAddress >= 0 ? sameAddress : candidates.findIndex(matches);
};

const EDITABLE_FIELDS = ['lat', 'lng', 'country', 'address', 'categories', 'image'] as const;

export function mergeSavedMarkersIntoLive(
  serverMarkers: MarkerData[],
  liveMarkers: MarkerData[],
  sourceMarkers?: MarkerData[],
): MarkerData[] {
  if (serverMarkers.length === 0) return liveMarkers;
  const usedServerIndexes = new Set<number>();
  const sourceIds = new Set((sourceMarkers ?? [])
    .filter(marker => marker.id != null).map(marker => String(marker.id)));
  const responseOwners = new Map<number, { source: MarkerData; serverIndex: number }>();
  // Assign the response to dispatched identities before visiting the current
  // order: a new coincident point cannot consume an in-flight point's new ID.
  sourceMarkers?.forEach((sourceMarker) => {
    const unavailable = new Set(usedServerIndexes);
    if (sourceMarker.id == null) serverMarkers.forEach((marker, index) => {
      if (marker.id != null && sourceIds.has(String(marker.id))) unavailable.add(index);
    });
    const serverIndex = findUnusedMarkerIndex(serverMarkers, unavailable, sourceMarker);
    if (serverIndex < 0) return;
    usedServerIndexes.add(serverIndex);
    const stableLiveIndex = liveMarkers.findIndex((liveMarker, index) => {
      if (responseOwners.has(index)) return false;
      if (liveMarker === sourceMarker) return true;
      if (sourceMarker.id != null) return liveMarker.id != null && String(liveMarker.id) === String(sourceMarker.id);
      if (liveMarker.id != null) return String(liveMarker.id) === String(serverMarkers[serverIndex].id);
      return false;
    });
    // Without a stable ID, coordinates alone do not identify a dispatched
    // point: it may have been removed and replaced at the same location.
    const matchingLiveIndexes = stableLiveIndex >= 0 ? [] : liveMarkers.flatMap((liveMarker, index) =>
      !responseOwners.has(index) && liveMarker.id == null && sourceMarker.id == null &&
      markerIdentityMatches(liveMarker, sourceMarker) && liveMarker.address === sourceMarker.address ? [index] : [],
    );
    const liveIndex = stableLiveIndex >= 0 ? stableLiveIndex : matchingLiveIndexes.length === 1 ? matchingLiveIndexes[0] : -1;
    if (liveIndex >= 0) responseOwners.set(liveIndex, { source: sourceMarker, serverIndex });
  });
  const merged = liveMarkers.map((liveMarker, liveIndex) => {
    const owner = responseOwners.get(liveIndex);
    const serverIndex = sourceMarkers === undefined
      ? findUnusedMarkerIndex(serverMarkers, usedServerIndexes, liveMarker)
      : owner?.serverIndex ?? -1;
    if (serverIndex < 0) return liveMarker;
    usedServerIndexes.add(serverIndex);
    const serverMarker = serverMarkers[serverIndex];
    const sourceMarker = owner?.source;
    const result: MarkerData = { ...mergeMarkersPreserveImages([serverMarker], [liveMarker])[0] };
    if (sourceMarker) {
      for (const field of EDITABLE_FIELDS) {
        if (!isEqual(liveMarker[field], sourceMarker[field])) Reflect.set(result, field, liveMarker[field]);
      }
    }
    return result;
  });
  if (sourceMarkers === undefined) {
    return [...merged, ...serverMarkers.filter((_marker, index) => !usedServerIndexes.has(index))];
  }
  return merged;
}
