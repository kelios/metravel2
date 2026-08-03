import { shouldPrefetchTravelStatics } from '@/utils/staticPrefetchRoutes';

// Стартовый idle-префетч наполняет только queryKeys.filters()/countries(), а
// читают их визард путешествия (PointList) и рулетка. На остальных маршрутах он
// был чистой тратой канала: /quests и /map платили ~25 КБ за словари, которые
// там никто не читает.
describe('shouldPrefetchTravelStatics', () => {
  it.each([
    ['/travel/new', true],
    ['/travel/189', true],
    ['/travel/189/', true],
    ['/travel/189?step=route', true],
    ['/travel/189#points', true],
    ['/roulette', true],
    ['/roulette/', true],
  ])('warms dictionaries on %s', (pathname, expected) => {
    expect(shouldPrefetchTravelStatics(pathname)).toBe(expected);
  });

  it.each([
    ['/'],
    ['/quests'],
    ['/quests/minsk'],
    ['/quests/4/minsk-cmok'],
    ['/map'],
    ['/travels'],
    // Деталь статьи — соседний маршрут во множественном числе, словари не читает.
    ['/travels/189'],
    ['/search'],
    ['/profile'],
    ['/travel'],
    ['/travel/189/steps'],
  ])('skips the prefetch on %s', (pathname) => {
    expect(shouldPrefetchTravelStatics(pathname)).toBe(false);
  });

  it.each([[null], [undefined], ['']])('treats %p as no route', (pathname) => {
    expect(shouldPrefetchTravelStatics(pathname as string | null | undefined)).toBe(false);
  });
});
