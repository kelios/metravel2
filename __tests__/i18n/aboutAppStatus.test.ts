import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config';
import { resources } from '@/i18n/resources';

const OFFLINE_MARKERS: Record<SupportedLocale, RegExp> = {
  ru: /офлайн/i,
  be: /афлайн/i,
  uk: /офлайн/i,
  pl: /offline/i,
  en: /offline/i,
};

const OFFLINE_SCOPE_MARKERS: Record<SupportedLocale, RegExp> = {
  ru: /выбран.*маршрут.*стать.*квест.*област.*карт/i,
  be: /выбран.*маршрут.*артыкул.*квэст.*вобласц.*карт/i,
  uk: /вибран.*маршрут.*статт.*квест.*област.*карт/i,
  pl: /wybran.*tras.*artyku.*quest.*obszar.*map/i,
  en: /selected.*route.*article.*quest.*map area/i,
};

describe('/about app and offline status copy (#1611, #2655)', () => {
  it.each(SUPPORTED_LOCALES)('%s lists the iPhone and Android apps as current, not in the roadmap', (locale) => {
    const copy = resources[locale].homeStatic;

    expect(copy['about.features.current.apps']).toMatch(/iPhone/);
    expect(copy['about.features.current.apps']).toMatch(/Android/);
    expect(copy['about.features.current.apps']).toMatch(/App Store/);
    expect(copy['about.features.current.apps']).toMatch(/Google Play/);
    expect(copy['about.features.current.offline']).toMatch(OFFLINE_MARKERS[locale]);
    expect(copy['about.features.current.offline']).toMatch(OFFLINE_SCOPE_MARKERS[locale]);
    expect('about.features.current.android' in copy).toBe(false);
    expect('about.features.roadmap.ios' in copy).toBe(false);
    expect('about.features.roadmap.mobile' in copy).toBe(false);
    expect('about.features.roadmap.offline' in copy).toBe(false);
  });
});
