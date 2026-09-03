import { Platform } from 'react-native';

import { shouldShowHeaderContextBar } from '@/components/layout/customHeaderModel';

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
      'keeps the context bar collapsed on self-headed cabinet page %s',
      (path) => {
        expect(shouldShowHeaderContextBar(path, false)).toBe(false);
      },
    );

    // #1725: эти экраны в навигации не значатся — попасть на них можно только
    // переходом, и вернуться с них должно быть куда.
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

    it.each(['/', '/search', '/travelsby', '/quests', '/trips', '/favorites', '/history', '/calendar', '/profile'])(
      'keeps the bar collapsed on nav / self-headed page %s',
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
