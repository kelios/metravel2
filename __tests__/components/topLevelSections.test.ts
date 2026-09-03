import {
  hasListFilterQuery,
  isTopLevelSectionPath,
  needsGlobalBackAffordance,
  SELF_HEADED_COLLECTION_PATHS,
  TOP_LEVEL_SECTION_PATHS,
} from '@/components/layout/topLevelSections';
import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation';
import { BOTTOM_DOCK_ITEM_DEFS } from '@/components/layout/bottomDockModel';

describe('TOP_LEVEL_SECTION_PATHS', () => {
  it('is derived from the navigation itself, not hand-written', () => {
    HEADER_NAV_ITEMS.filter((item) => !item.external).forEach((item) => {
      expect(TOP_LEVEL_SECTION_PATHS.has(item.path)).toBe(true);
    });
    BOTTOM_DOCK_ITEM_DEFS.filter((item) => !item.isMore).forEach((item) => {
      expect(TOP_LEVEL_SECTION_PATHS.has(String(item.route))).toBe(true);
    });
    expect(TOP_LEVEL_SECTION_PATHS.has('/')).toBe(true);
    expect(TOP_LEVEL_SECTION_PATHS.has('/index')).toBe(true);
  });

  // #1725: именно эти пути лежали в рукописном списке «верхних разделов», хотя
  // ни в меню, ни в доке их нет — попасть на них можно только переходом.
  it.each(['/favorites', '/history', '/calendar', '/metravel', '/login', '/set-password'])(
    'does not count %s as a navigation section',
    (path) => {
      expect(TOP_LEVEL_SECTION_PATHS.has(path)).toBe(false);
    },
  );
});

describe('hasListFilterQuery', () => {
  it.each([
    ['?categoryTravelAddress=33,43'],
    ['categoryTravelAddress=33,43'],
    ['?sort=new&categories=21'],
    ['?user_id=42'],
    ['?search=%D0%B7%D0%B0%D0%BC%D0%BA%D0%B8'],
    ['?category__travel__address=43'],
  ])('detects a filter in %s', (search) => {
    expect(hasListFilterQuery(search)).toBe(true);
  });

  it.each([
    [''],
    ['?'],
    ['?sort=new'],
    ['?utm_source=telegram'],
    ['?categoryTravelAddress='],
    ['?categoryTravelAddress=%20'],
  ])('reports no filter for %s', (search) => {
    expect(hasListFilterQuery(search)).toBe(false);
  });

  it('accepts the router params object shape', () => {
    expect(hasListFilterQuery({ categoryTravelAddress: ['33', '43'] })).toBe(true);
    expect(hasListFilterQuery({ categoryTravelAddress: [] })).toBe(false);
    expect(hasListFilterQuery({ sort: 'new' })).toBe(false);
    expect(hasListFilterQuery(null)).toBe(false);
  });

  it('survives a malformed percent-escape without throwing', () => {
    expect(() => hasListFilterQuery('?search=%E0%A4%A')).not.toThrow();
  });
});

describe('isTopLevelSectionPath / needsGlobalBackAffordance', () => {
  it('demotes a filtered list route from section to result', () => {
    expect(isTopLevelSectionPath('/search')).toBe(true);
    expect(isTopLevelSectionPath('/search', true)).toBe(false);
    expect(needsGlobalBackAffordance('/search')).toBe(false);
    expect(needsGlobalBackAffordance('/search', true)).toBe(true);
  });

  it('keeps the global row off self-headed collections (their own header owns back)', () => {
    SELF_HEADED_COLLECTION_PATHS.forEach((path) => {
      expect(needsGlobalBackAffordance(path)).toBe(false);
    });
  });

  it.each(['/metravel', '/articles', '/settings', '/about'])(
    'asks for the global back row on entered-only page %s',
    (path) => {
      expect(needsGlobalBackAffordance(path)).toBe(true);
    },
  );
});
