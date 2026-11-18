import type { ParsedRoutePreview } from '@/types/travelRoutes';
import { buildElevationProfile } from '@/utils/routeFileParser';

const MAX_SAMPLES = 60;
const MAX_CACHE_ENTRIES = 50;
const terrainCache = new Map<string, Promise<number[] | null>>();

// Keep the original geometry: only sampled points receive measured terrain
// heights, so distances and recording gaps still belong to the real track.
export async function addMissingRouteElevation(preview: ParsedRoutePreview): Promise<ParsedRoutePreview> {
  if (preview.elevationProfile.length >= 2 || preview.linePoints.length < 2) return preview;
  const recordedProfile = buildElevationProfile(preview.linePoints);
  if (recordedProfile.length >= 2) return { ...preview, elevationProfile: recordedProfile };

  const count = Math.min(MAX_SAMPLES, preview.linePoints.length);
  const indices = Array.from({ length: count }, (_, i) =>
    Math.round(i * (preview.linePoints.length - 1) / (count - 1)));
  const coords = indices.map((index) => preview.linePoints[index].coord.split(',').map(Number));
  if (coords.some(([lat, lng]) => !Number.isFinite(lat) || !Number.isFinite(lng) ||
    Math.abs(lat) > 90 || Math.abs(lng) > 180)) return preview;
  const latitudes = coords.map(([lat]) => lat.toFixed(5)).join(',');
  const longitudes = coords.map(([, lng]) => lng.toFixed(5)).join(',');
  const key = `${latitudes}:${longitudes}`;
  let pending = terrainCache.get(key);
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`, {
          signal: controller.signal,
        });
        if (!response.ok) return null;
        const data: unknown = await response.json();
        const elevations = (data as { elevation?: unknown } | null)?.elevation;
        if (!Array.isArray(elevations) || elevations.length !== count ||
          elevations.some((value) => typeof value !== 'number' || !Number.isFinite(value))) return null;
        return elevations as number[];
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    })();
    if (terrainCache.size >= MAX_CACHE_ENTRIES) terrainCache.delete(terrainCache.keys().next().value!);
    terrainCache.set(key, pending);
  }
  const elevations = await pending;
  if (!elevations) {
    if (terrainCache.get(key) === pending) terrainCache.delete(key);
    return preview;
  }
  const linePoints = preview.linePoints.map((point) => ({ ...point }));
  indices.forEach((index, i) => {
    if (!Number.isFinite(linePoints[index].elevation)) linePoints[index].elevation = elevations[i];
  });
  return { ...preview, linePoints, elevationProfile: buildElevationProfile(linePoints) };
}
