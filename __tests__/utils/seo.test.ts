import { getSiteBaseUrl, buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';

describe('seo utils', () => {
  const originalEnv = process.env.EXPO_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.EXPO_PUBLIC_SITE_URL = originalEnv;
    } else {
      delete process.env.EXPO_PUBLIC_SITE_URL;
    }
  });

  describe('getSiteBaseUrl', () => {
    it('returns default production URL when env is not set', () => {
      delete process.env.EXPO_PUBLIC_SITE_URL;
      expect(getSiteBaseUrl()).toBe('https://metravel.by');
    });

    it('returns env value without trailing slash', () => {
      process.env.EXPO_PUBLIC_SITE_URL = 'https://staging.metravel.by/';
      expect(getSiteBaseUrl()).toBe('https://staging.metravel.by');
    });

    it('strips multiple trailing slashes', () => {
      process.env.EXPO_PUBLIC_SITE_URL = 'https://example.com///';
      expect(getSiteBaseUrl()).toBe('https://example.com');
    });
  });

  describe('buildCanonicalUrl', () => {
    beforeEach(() => {
      delete process.env.EXPO_PUBLIC_SITE_URL;
    });

    it('builds canonical for root', () => {
      expect(buildCanonicalUrl('/')).toBe('https://metravel.by/');
    });

    it('builds canonical for a path', () => {
      expect(buildCanonicalUrl('/travels/my-route')).toBe(
        'https://metravel.by/travels/my-route',
      );
    });

    it('adds leading slash if missing', () => {
      expect(buildCanonicalUrl('map')).toBe('https://metravel.by/map');
    });
  });

  describe('buildOgImageUrl', () => {
    beforeEach(() => {
      delete process.env.EXPO_PUBLIC_SITE_URL;
    });

    it('builds OG image URL with leading slash', () => {
      expect(buildOgImageUrl('/assets/icons/logo_yellow_512x512.png')).toBe(
        'https://metravel.by/assets/icons/logo_yellow_512x512.png',
      );
    });

    it('DEFAULT_OG_IMAGE_PATH resolves to existing asset', () => {
      expect(DEFAULT_OG_IMAGE_PATH).toBe('/assets/icons/logo_yellow_512x512.png');
      expect(buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)).toBe(
        'https://metravel.by/assets/icons/logo_yellow_512x512.png',
      );
    });

    it('adds leading slash if missing', () => {
      expect(buildOgImageUrl('images/og.png')).toBe(
        'https://metravel.by/images/og.png',
      );
    });
  });
});
