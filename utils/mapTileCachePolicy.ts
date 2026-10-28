const TILE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const isTileCacheEntryFresh = (
  modificationTimeSeconds: number | undefined,
  nowMs = Date.now(),
): boolean => {
  if (!Number.isFinite(modificationTimeSeconds)) return false;
  const ageMs = nowMs - Number(modificationTimeSeconds) * 1000;
  return ageMs >= 0 && ageMs <= TILE_CACHE_MAX_AGE_MS;
};
