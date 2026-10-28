import { listStaticRouteSeo, listStaticRoutes, resolveStaticRouteSeo, STATIC_ROUTE_SEO } from '@/utils/seoRoutes/staticRoutes';

const t = (key: string) => `[${key}]`;

describe('utils/seoRoutes/staticRoutes (#2740)', () => {
  it('resolves every route with a non-empty title, description and image', () => {
    for (const seo of listStaticRouteSeo(t)) {
      expect(seo.title.trim()).not.toBe('');
      expect(seo.description.trim()).not.toBe('');
      expect(seo.imagePath.startsWith('/')).toBe(true);
      expect(seo.canonicalRoute.startsWith('/')).toBe(true);
    }
  });

  it('keeps routes unique and the historical STATIC_PAGES set', () => {
    const routes = listStaticRoutes();
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes).toEqual([
      '/', '/about', '/become-author', '/contact', '/search', '/map', '/articles', '/places', '/article',
      '/roulette', '/favorites', '/privacy', '/cookies', '/login', '/registration', '/register',
      '/accountconfirmation', '/set-password', '/subscribe/confirm', '/subscribe/unsubscribe', '/travelsby',
      '/quests', '/quests/scenario', '/history', '/messages', '/export', '/metravel', '/profile', '/settings',
      '/subscriptions', '/quests/map', '/userpoints', '/app-stats',
    ]);
  });

  it('reads i18n keys through the injected translator', () => {
    expect(resolveStaticRouteSeo('/', t)).toMatchObject({
      title: '[seoStatic:root.home.title]',
      description: '[seoStatic:root.home.description]',
      imagePath: '/og-home.jpg',
      imageWidth: 1200,
      imageHeight: 630,
    });
    expect(resolveStaticRouteSeo('/become-author', t)?.breadcrumb).toBe('[homeStatic:becomeAuthor.title]');
  });

  it('throws when a required translation is empty', () => {
    expect(() => resolveStaticRouteSeo('/', () => '')).toThrow(/seoStatic:root.home.title/);
  });

  it('keeps /register canonical on /registration and private pages noindex', () => {
    expect(resolveStaticRouteSeo('/register', t)?.canonicalRoute).toBe('/registration');
    const noindex = STATIC_ROUTE_SEO.filter((entry) => entry.robots).map((entry) => `${entry.route}=${entry.robots}`);
    expect(noindex).toEqual([
      '/articles=noindex, nofollow', '/places=noindex, follow', '/article=noindex, nofollow',
      '/favorites=noindex, nofollow', '/cookies=noindex, nofollow', '/login=noindex, nofollow',
      '/registration=noindex, nofollow', '/register=noindex, nofollow', '/accountconfirmation=noindex, nofollow',
      '/set-password=noindex, nofollow', '/subscribe/confirm=noindex, nofollow',
      '/subscribe/unsubscribe=noindex, nofollow', '/history=noindex, nofollow', '/messages=noindex, nofollow',
      '/export=noindex, nofollow', '/metravel=noindex, nofollow', '/profile=noindex, nofollow',
      '/settings=noindex, nofollow', '/subscriptions=noindex, nofollow', '/quests/map=noindex, nofollow',
      '/userpoints=noindex, nofollow', '/app-stats=noindex, nofollow',
    ]);
  });

  it('returns null for unknown routes', () => {
    expect(resolveStaticRouteSeo('/nope', t)).toBeNull();
  });
});
