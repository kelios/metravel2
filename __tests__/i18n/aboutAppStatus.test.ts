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

describe('/about Android and offline status copy (#1611)', () => {
  it.each(SUPPORTED_LOCALES)('%s keeps Android and offline current while iOS stays in the roadmap', (locale) => {
    const copy = resources[locale].homeStatic;

    expect(copy['about.features.current.android']).toMatch(/Android/);
    expect(copy['about.features.current.android']).toMatch(/Google Play/);
    expect(copy['about.features.current.offline']).toMatch(OFFLINE_MARKERS[locale]);
    expect(copy['about.features.current.offline']).toMatch(OFFLINE_SCOPE_MARKERS[locale]);
    expect(copy['about.features.roadmap.ios']).toMatch(/iOS/);
    expect(copy['about.features.roadmap.ios']).not.toMatch(/Android/);
    expect('about.features.roadmap.mobile' in copy).toBe(false);
    expect('about.features.roadmap.offline' in copy).toBe(false);
  });
});
