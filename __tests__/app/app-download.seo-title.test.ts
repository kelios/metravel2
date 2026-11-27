import { sharedStaticResources as ruResources } from '../../i18n/locales/ru/static/shared_static';
import { sharedStaticResources as beResources } from '../../i18n/locales/be/static/shared_static';
import { sharedStaticResources as ukResources } from '../../i18n/locales/uk/static/shared_static';
import { sharedStaticResources as plResources } from '../../i18n/locales/pl/static/shared_static';
import { sharedStaticResources as enResources } from '../../i18n/locales/en/static/shared_static';

describe('App Download SEO Title', () => {
  const locales = [
    { id: 'ru', resources: ruResources },
    { id: 'be', resources: beResources },
    { id: 'uk', resources: ukResources },
    { id: 'pl', resources: plResources },
    { id: 'en', resources: enResources },
  ];

  for (const { id, resources } of locales) {
    it(`should have correct seoTitle for ${id}`, () => {
      const title = resources['appDownload.page.seoTitle'];
      expect(title).toBeDefined();
      expect(title.length).toBeGreaterThan(0);
      expect(title).toContain('iPhone');
      expect(title).toContain('Android');
      expect(title.match(/MeTravel/g)).toHaveLength(1);
      expect(title).toMatch(/ \| MeTravel$/);
    });
  }
});
