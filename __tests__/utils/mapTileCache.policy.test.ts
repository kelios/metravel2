import { isTileCacheEntryFresh } from '@/utils/mapTileCache';

describe('native OSM tile cache policy', () => {
  const nowMs = Date.UTC(2026, 7, 13, 12, 0, 0);

  it('keeps a viewed tile only inside the seven-day cache window', () => {
    const sixDaysAgoSeconds = (nowMs - 6 * 24 * 60 * 60 * 1000) / 1000;

    expect(isTileCacheEntryFresh(sixDaysAgoSeconds, nowMs)).toBe(true);
  });

  it('expires old or unversioned entries instead of retaining them offline forever', () => {
    const eightDaysAgoSeconds = (nowMs - 8 * 24 * 60 * 60 * 1000) / 1000;

    expect(isTileCacheEntryFresh(eightDaysAgoSeconds, nowMs)).toBe(false);
    expect(isTileCacheEntryFresh(undefined, nowMs)).toBe(false);
    expect(isTileCacheEntryFresh((nowMs + 60_000) / 1000, nowMs)).toBe(false);
  });
});
