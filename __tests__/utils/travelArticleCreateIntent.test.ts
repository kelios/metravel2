import {
  buildTravelArticleCreateHref,
  buildTravelArticleCreateIntentHref,
  parseTravelArticleCreateIntent,
  resolveInitialPrefill,
} from '@/utils/travelArticleCreateIntent';
import { buildLoginHref, buildRegistrationHref, resolvePostAuthPath } from '@/utils/authNavigation';

const article = {
  id: 42, cityName: 'Краков', countryCode: 'pl', travelAddress: [{ id: 1, name: 'Вавель' }],
  name: 'Чужой заголовок', description: 'Чужой текст', gallery: ['private.jpg'],
};
const catalog = [
  { country_id: '616', title_ru: 'Польша', country_code: 'PL' },
  { country_id: '112', title_ru: 'Беларусь', country_code: 'BY' },
];

describe('article creation context', () => {
  it('copies only the city, country and public source id', () => {
    const href = buildTravelArticleCreateHref(article);
    expect(parseTravelArticleCreateIntent(href)).toEqual({
      sourceTravelId: '42', country: 'PL', place: 'Краков',
    });
    expect(href).not.toMatch(/заголовок|description|gallery|private/);
    expect(resolveInitialPrefill(parseTravelArticleCreateIntent(href)!, catalog)).toEqual({
      name: 'Краков', countries: ['616'],
    });
  });

  it('uses the first canonical country id and first named point when there is no city', () => {
    const href = buildTravelArticleCreateHref({
      ...article, cityName: '', countries: [null, { country_id: 112 }, { id: 616 }],
      travelAddress: ['', { id: 1, name: '  Мирский   замок  ' }],
    });
    expect(parseTravelArticleCreateIntent(href)).toEqual({
      sourceTravelId: '42', country: '112', place: 'Мирский замок',
    });
  });

  it.each(['https://metravel.by/address/12', '{"name":"serialized"}', '<img src=x>']) (
    'does not treat malformed address %s as a human place name', (address) => {
      expect(parseTravelArticleCreateIntent(buildTravelArticleCreateHref({
        ...article, cityName: '', travelAddress: [address],
      }))).toEqual({ sourceTravelId: '42', country: 'PL' });
    },
  );

  it('keeps absent location empty and never substitutes the article title', () => {
    expect(parseTravelArticleCreateIntent(buildTravelArticleCreateHref({
      ...article, cityName: '', countryCode: 'BY,PL', travelAddress: [],
    }))).toEqual({ sourceTravelId: '42' });
  });

  it.each(['https://evil.example/travel/new?source_travel_id=42',
    '//evil.example/travel/new?source_travel_id=42', '/travel/42?source_travel_id=42',
    '/travel/new?source_travel_id=42#other', '/travel/new?source_travel_id=1&source_travel_id=2']) (
    'rejects a noncanonical or ambiguous context URL %s', (href) => {
      expect(parseTravelArticleCreateIntent(href)).toBeNull();
    },
  );

  it.each([[['42']], [''], ['0'], ['-1'], ['1e2'], ['9007199254740992'], ['https://evil.example']]) (
    'rejects invalid source id %p', (id) => {
      expect(parseTravelArticleCreateIntent({ source_travel_id: id })).toBeNull();
    },
  );

  it('bounds scalar fields, drops arbitrary query data and encodes ampersands safely', () => {
    const intent = parseTravelArticleCreateIntent({
      source_travel_id: '42', country: ['112'], place: 'A & B ? # ' + 'Я'.repeat(200),
      description: 'private', token: 'secret', mode: 'note',
    })!;
    expect(intent.country).toBeUndefined();
    expect(Array.from(intent.place!)).toHaveLength(120);
    const href = buildTravelArticleCreateIntentHref(intent);
    expect(href).not.toMatch(/token|description|mode/);
    expect(parseTravelArticleCreateIntent(href)).toEqual(intent);
  });

  it.each(['\u0000', '\n', '\u007f'])('rejects control characters in place or the raw redirect', (control) => {
    expect(parseTravelArticleCreateIntent({ source_travel_id: '42', place: `Кра${control}ков` }))
      .toEqual({ sourceTravelId: '42' });
    expect(parseTravelArticleCreateIntent(`/travel/new?source_travel_id=42&place=Кра${control}ков`))
      .toBeNull();
  });

  it('selects only one exact catalog id or ISO2 match, never fuzzy country text', () => {
    expect(resolveInitialPrefill({ sourceTravelId: '42', country: '999' }, catalog).countries).toEqual([]);
    expect(resolveInitialPrefill({ sourceTravelId: '42', country: 'PL' }, [
      ...catalog, { country_id: '777', title_ru: 'Польша 2', country_code: 'PL' },
    ]).countries).toEqual([]);
    expect(resolveInitialPrefill({ sourceTravelId: '42', country: 'Поль' }, catalog).countries).toEqual([]);
    expect(resolveInitialPrefill({ sourceTravelId: '42', country: '112' }, catalog).countries).toEqual(['112']);
  });

  it('preserves the complete canonical context through registration, login and post-auth resolution', () => {
    const href = buildTravelArticleCreateHref(article);
    const registration = new URL(buildRegistrationHref({ redirect: href, intent: 'share-trip' }), 'https://metravel.by');
    const login = new URL(buildLoginHref({
      redirect: registration.searchParams.get('redirect'), intent: registration.searchParams.get('intent'),
    }), 'https://metravel.by');
    expect(resolvePostAuthPath({
      redirect: login.searchParams.get('redirect'), intent: login.searchParams.get('intent'),
    })).toBe(href);
    expect(resolvePostAuthPath({ redirect: '//evil.example', intent: 'share-trip' })).toBe('/');
  });
});
