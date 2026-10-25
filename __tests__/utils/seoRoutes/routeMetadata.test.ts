import { notFoundRouteMetadata, routeMetadata, staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata';

describe('utils/seoRoutes/routeMetadata (#2740)', () => {
  it('expands a static table route into absolute canonical, og:url and logo image', () => {
    const metadata = staticRouteMetadata('/register');
    expect(metadata.robots).toBe('noindex, nofollow');
    expect(metadata.alternates?.canonical).toMatch(/^https:\/\/[^/]+\/registration$/);
    expect(metadata.openGraph.url).toBe(metadata.alternates?.canonical);
    expect(metadata.openGraph.images?.[0].url).toMatch(/^https:\/\/[^/]+\/assets\/icons\/logo_yellow_512x512\.png/);
    expect(metadata.openGraph.locale).toBeTruthy();
    expect(metadata.twitter.card).toBe('summary_large_image');
  });

  it('normalizes a relative image path the same way for ad-hoc routes', () => {
    const metadata = routeMetadata({ title: 'T | Metravel', image: '/og-home.jpg', canonical: '/x' });
    expect(metadata.openGraph.images?.[0].url).toMatch(/^https:\/\/[^/]+\/og-home\.jpg/);
    expect(metadata.alternates?.canonical).toMatch(/^https:\/\/[^/]+\/x$/);
  });

  it('gives the not-found head no canonical and no image, like NotFoundContent', () => {
    const metadata = notFoundRouteMetadata();
    expect(metadata.robots).toBe('noindex, nofollow');
    expect(metadata.title.trim()).not.toBe('');
    expect(metadata.description?.trim()).toBeTruthy();
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph.url).toBeUndefined();
    expect(metadata.openGraph.images).toBeUndefined();
    expect(metadata.twitter.card).toBe('summary');
  });

  it('refuses a route that is not in the shared table', () => {
    expect(() => staticRouteMetadata('/nope')).toThrow(/not in utils\/seoRoutes\/staticRoutes\.js/);
  });
});
