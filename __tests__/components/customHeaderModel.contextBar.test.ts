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

    it.each(['/', '/index', '/search', '/travelsby', '/places', '/trips', '/roulette', '/quests', '/login', '/registration', '/set-password', '/metravel'])(
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

    it.each(['/', '/search', '/travelsby', '/quests', '/trips', '/favorites', '/history', '/calendar', '/profile', '/login', '/registration', '/set-password', '/metravel'])(
      'keeps the bar collapsed on nav / self-headed page %s',
      (path) => {
        expect(shouldShowHeaderContextBar(path, true)).toBe(false);
      },
    );

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
