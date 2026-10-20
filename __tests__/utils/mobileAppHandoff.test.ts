import { APP_STORE_APP_ID, GOOGLE_PLAY_APP_URL } from '@/constants/appStore';
import { mapIncomingAppLinkToHref } from '@/utils/incomingAppLinks';
import { getMobileAppUrl, getMobileAppOpenUrl, getSmartAppBannerContent } from '@/utils/mobileAppHandoff';

describe('mobile app handoff destinations', () => {
  it.each([
    '/map?lat=53.9&lng=27.56',
    '/travels/mountain-walk?source=website&label=%D0%BF%D0%BE%D1%85%D0%BE%D0%B4',
    '/article/42?from=share',
    '/quests/krakow/dragon?theme=legends',
    '/user/17',
    '/trips/my',
    '/trips/plan/31?edit=1',
  ])('preserves the supported route %s and removes the browser fragment', (href) => {
    const siteUrl = `https://metravel.by${href}#comments`;
    expect(getMobileAppUrl(siteUrl)).toBe(`metravel:/${href}`);
    expect(mapIncomingAppLinkToHref(getMobileAppUrl(siteUrl))).toBe(href);
    expect(getMobileAppOpenUrl('ios', siteUrl)).toBe(getMobileAppUrl(siteUrl));
  });

  it.each([
    '',
    'https://metravel.by/',
    'https://metravel.by/app',
    'https://metravel.by/travels/slug/extra',
    'https://metravel.by/travels/../map',
    'https://metravel.by/travels/%2fmap',
    'https://metravel.by/map?value=%00',
    'https://metravel.by:443/map',
    'https://user@metravel.by/map',
    'https://evil.example/map',
    'https://metravel.by.evil.example/map',
    'javascript:alert(1)',
    '/map',
  ])('falls back to the map for an unsupported or unsafe destination: %s', (siteUrl) => {
    expect(getMobileAppUrl(siteUrl)).toBe('metravel://map');
    expect(getMobileAppOpenUrl('android', siteUrl)).toContain('intent://metravel.by/map#Intent;');
  });

  it('binds Android to the official package and Play fallback', () => {
    const intent = getMobileAppOpenUrl('android', 'https://metravel.by/quests/krakow/dragon?mode=family#step-2');
    expect(intent).toBe(
      `intent://metravel.by/quests/krakow/dragon?mode=family#Intent;scheme=https;package=by.metravel.app;S.browser_fallback_url=${encodeURIComponent(GOOGLE_PLAY_APP_URL)};end`,
    );
  });

  it('escapes intent separators without double-encoding page query values', () => {
    const intent = getMobileAppOpenUrl('android', 'https://metravel.by/map?name=a;b&label=%D0%BA%D0%B0%D1%80%D1%82%D0%B0&target=%23Intent%3Bpackage%3Devil#Intent;package=evil');
    expect(intent).toContain('/map?name=a%3Bb&label=%D0%BA%D0%B0%D1%80%D1%82%D0%B0&target=%23Intent%3Bpackage%3Devil#Intent;');
    expect(intent.match(/#Intent;/g)).toHaveLength(1);
    expect(intent).not.toContain(';package=evil');
  });

  it('uses the official iOS identity and a safe default before the page URL is known', () => {
    expect(getSmartAppBannerContent()).toBe(`app-id=${APP_STORE_APP_ID}, app-argument=metravel://map`);
    expect(getSmartAppBannerContent('https://metravel.by/map?name=a,b&zoom=12')).toBe(
      `app-id=${APP_STORE_APP_ID}, app-argument=metravel://map?name=a%2Cb&zoom=12`,
    );
  });
});
