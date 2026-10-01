import { Platform } from 'react-native';

import { shouldShowHeaderContextBar } from '@/components/layout/customHeaderModel';
import { COLLECTION_PATHS, needsGlobalBackAffordance } from '@/components/layout/topLevelSections';

describe('shouldShowHeaderContextBar (web)', () => {
  const prevOS = Platform.OS;
  beforeAll(() => {
    (Platform.OS as any) = 'web';
  });
  afterAll(() => {
    (Platform.OS as any) = prevOS;
  });

  describe('desktop', () => {
    it.each([
      '/about',
      '/privacy',
      '/terms',
      '/cookies',
      '/disclaimer',
      '/community-rules',
      '/trip-rules',
    ])('shows the context bar on info/legal page %s', (path) => {
      expect(shouldShowHeaderContextBar(path, false)).toBe(true);
    });

    it.each(['/settings', '/messages', '/subscriptions', '/export'])(
      'shows the context bar on plain cabinet page %s',
      (path) => {
        expect(shouldShowHeaderContextBar(path, false)).toBe(true);
      },
    );

    it.each(['/', '/index', '/search', '/travelsby', '/map', '/places', '/trips', '/roulette', '/quests'])(
      'keeps the context bar collapsed on top-level nav page %s',
      (path) => {
        expect(shouldShowHeaderContextBar(path, false)).toBe(false);
      },
    );

    it.each(['/favorites', '/history', '/calendar', '/profile'])(
      'keeps the context bar collapsed on desktop cabinet page %s',
      (path) => {
        expect(shouldShowHeaderContextBar(path, false)).toBe(false);
      },
    );

    // #1725: эти экраны в навигации не значатся — попасть на них можно только
    // переходом, и вернуться с них должно быть куда.
    it.each(['/trips', '/places', '/roulette', '/favorites', '/history', '/calendar'])(
      'phone-only bar on %s: shown below 768 px, absent on 768–1279 and desktop (#2099)',
      (path) => {
        // isMobile — компактная шапка (<1280), isBarMobile — телефонная ветка бара (<768).
        expect(shouldShowHeaderContextBar(path, true, false, true)).toBe(true);
        expect(shouldShowHeaderContextBar(path, true, false, false)).toBe(false);
        expect(shouldShowHeaderContextBar(path, false, false, false)).toBe(false);
      },
    );

    it.each(['/metravel', '/login', '/registration', '/set-password'])(
      'shows the context bar on entered-only page %s',
      (path) => {
        expect(shouldShowHeaderContextBar(path, false)).toBe(true);
      },
    );

    it('shows the context bar on a filtered list route', () => {
      expect(shouldShowHeaderContextBar('/search', false, true)).toBe(true);
      expect(shouldShowHeaderContextBar('/travelsby', false, true)).toBe(true);
    });

    it('keeps the context bar collapsed on the same route without a filter', () => {
      expect(shouldShowHeaderContextBar('/search', false, false)).toBe(false);
    });

    it('shows the context bar with breadcrumbs on /userpoints (no local header)', () => {
      expect(shouldShowHeaderContextBar('/userpoints', false)).toBe(true);
    });

    it('keeps the context bar hidden on travel detail (own nav)', () => {
      expect(shouldShowHeaderContextBar('/travels/some-slug', false)).toBe(false);
    });

    it.each(['/travel/new', '/travel/42'])(
      'keeps the wizard breadcrumb row hidden on desktop for %s',
      (path) => {
        expect(shouldShowHeaderContextBar(path, false)).toBe(false);
      },
    );
  });

  describe('mobile', () => {
    it.each(['/about', '/settings', '/export', '/userpoints'])(
      'shows the back+title bar on sub-page %s',
      (path) => {
        // /userpoints keeps its bar on mobile via the explicit userpoints branch.
        expect(shouldShowHeaderContextBar(path, true)).toBe(true);
      },
    );

    it.each(['/favorites', '/history', '/calendar'])(
      'shows the back+title bar on cabinet collection %s (#2099)',
      (path) => {
        expect(shouldShowHeaderContextBar(path, true)).toBe(true);
      },
    );

    it.each(['/', '/search', '/travelsby', '/quests', '/profile'])(
      'keeps the bar collapsed on nav page %s',
      (path) => {
        expect(shouldShowHeaderContextBar(path, true)).toBe(false);
      },
    );

    it.each(['/metravel', '/login', '/registration', '/set-password'])(
      'shows the back+title bar on entered-only page %s',
      (path) => {
        expect(shouldShowHeaderContextBar(path, true)).toBe(true);
      },
    );

    // #1725: «Замки» с главной ведут на /search?categoryTravelAddress=33,43 —
    // это подборка, а не раздел «Маршруты» из дока.
    it('shows the back+title bar on a filtered list route', () => {
      expect(shouldShowHeaderContextBar('/search', true, true)).toBe(true);
    });

    it('keeps the map route collapsed even with a filter query', () => {
      expect(shouldShowHeaderContextBar('/map', true, true)).toBe(false);
    });

    it('hides the bar on the map route', () => {
      expect(shouldShowHeaderContextBar('/map', true)).toBe(false);
    });

    it.each(['/travel/new', '/travel/42'])(
      'shows wizard breadcrumbs on mobile web for %s',
      (path) => {
        expect(shouldShowHeaderContextBar(path, true)).toBe(true);
      },
    );
  });
});

describe('владелец «Назад» на кабинетных коллекциях (#2099)', () => {
  // Семья NATIVE-DUP-BACK-AFFORDANCE-001: на одном экране ровно один владелец
  // навигации назад. Телефон (web и native) — строка HeaderContextBar по декларации
  // useScreenHeader, шапка ProfileCollectionHeader молчит; шире — наоборот: бар без
  // крошек, «Назад» рисует шапка экрана. Набор перечислен явно — новая коллекция
  // обязана попасть сюда, иначе тест не защищает её.
  const prevOS = Platform.OS;
  afterEach(() => {
    (Platform.OS as any) = prevOS;
  });

  it('набор кабинетных коллекций перечислен явно', () => {
    expect([...COLLECTION_PATHS].sort()).toEqual(['/calendar', '/favorites', '/history']);
  });

  it.each(['android', 'ios', 'web'])('%s: на телефоне бар показан и владеет «Назад» на каждой коллекции', (os) => {
    (Platform.OS as any) = os;
    for (const path of COLLECTION_PATHS) {
      expect(shouldShowHeaderContextBar(path, true)).toBe(true);
      expect(needsGlobalBackAffordance(path, false, true)).toBe(true);
    }
  });

  it('web: на desktop глобальный бар скрыт, «Назад» рисует шапка экрана', () => {
    (Platform.OS as any) = 'web';
    for (const path of COLLECTION_PATHS) {
      expect(shouldShowHeaderContextBar(path, false)).toBe(false);
      expect(needsGlobalBackAffordance(path)).toBe(false);
    }
  });
});

describe('shouldShowHeaderContextBar (native)', () => {
  const prevOS = Platform.OS;

  beforeAll(() => {
    (Platform.OS as any) = 'android';
  });

  afterAll(() => {
    (Platform.OS as any) = prevOS;
  });

  it.each(['/travel/new', '/travel/42'])(
    'shows wizard breadcrumbs on Android for %s',
    (path) => {
      expect(shouldShowHeaderContextBar(path, true)).toBe(true);
    },
  );
});
