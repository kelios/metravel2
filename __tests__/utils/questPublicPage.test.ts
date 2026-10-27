import { parseQuestPublicRoute, validateQuestPublicProjection } from '@/utils/questPublicPage';
import { questPrivateSnapshot } from '../fixtures/questPublicProjection';
const { buildQuestWebProjection } = require('@/scripts/lib/questWebProjection');
const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin');
const path = require('node:path');

const catalogues = loadSsgCatalogs(path.resolve(__dirname, '../..')).catalogs;
const pages = buildQuestWebProjection(questPrivateSnapshot(), catalogues).pages;
function projection(locale = 'ru') {
  const page = pages.find((entry: { kind: string; locale: string }) => entry.kind === 'detail' && entry.locale === locale);
  return { ...page, schema_version: 2, state: 'available', publication_id: 'b'.repeat(64), corpus_revision: 'c'.repeat(64),
    ru_source_path: '/quests/7/fixture-city-walk', versions: pages.filter((entry: { kind: string }) => entry.kind === 'detail')
      .map((entry: { locale: string; canonical_path: string; content_revision: string }) => ({ locale: entry.locale, path: entry.canonical_path, content_revision: entry.content_revision })) };
}

describe('public quest route and selected projection', () => {
  it.each(['/quests/7/fixture-city-walk', '/be/quests/7/fixture-city-walk', '/uk/quests/7/fixture-city-walk',
    '/pl/quests/7/fixture-city-walk', '/en/quests/7/fixture-city-walk', '/quests/minsk', '/quests/country/belarus'])(
    'recognizes existing public contract %s', (route) => expect(parseQuestPublicRoute(route)).not.toBeNull());
  it.each(['/quests', '/quests/scenario', '/quests/offline', '/en/quests/minsk', '/login', '/garbage', '/quests/7/../secret'])(
    'leaves other routes to their existing owners: %s', (route) => expect(parseQuestPublicRoute(route)).toBeNull());

  it('whitelists only public fields from a matching revisioned response', () => {
    const raw = projection('pl');
    raw.page = { ...raw.page, task: 'PRIVATE', hints: ['PRIVATE'] };
    const result = validateQuestPublicProjection(raw, parseQuestPublicRoute(raw.canonical_path)!);
    expect(result?.page.heading).toBe('Quest pl');
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(result?.versions.map((entry) => entry.locale)).toEqual(['ru', 'be', 'uk', 'pl', 'en']);
  });

  // The backend publishes [ru] for a quest without translations; requiring two
  // versions turned every RU-only quest page into a 503.
  it('accepts a RU-only quest with its single RU version but no other lone locale', () => {
    const raw = projection();
    const route = parseQuestPublicRoute(raw.canonical_path)!;
    const ruOnly = { ...raw, versions: raw.versions.filter((entry: { locale: string }) => entry.locale === 'ru') };
    expect(validateQuestPublicProjection(ruOnly, route)?.versions.map((entry) => entry.locale)).toEqual(['ru']);
    const plOnly = { ...raw, versions: raw.versions.filter((entry: { locale: string }) => entry.locale === 'pl') };
    expect(validateQuestPublicProjection(plOnly, route)).toBeNull();
  });

  it('rejects wrong locale, wrong identity, unavailable revisions and unsafe links', () => {
    const route = parseQuestPublicRoute('/quests/7/fixture-city-walk')!;
    expect(validateQuestPublicProjection(projection('pl'), route)).toBeNull();
    expect(validateQuestPublicProjection({ ...projection(), canonical_path: '/quests/8/fixture-city-walk' }, route)).toBeNull();
    expect(validateQuestPublicProjection({ ...projection(), state: 'temporary_failure' }, route)).toBeNull();
    expect(validateQuestPublicProjection({ ...projection(), corpus_revision: 'unknown' }, route)).toBeNull();
    const unsafe = projection();
    unsafe.page = { ...unsafe.page, sections: [{ heading: '', paragraphs: [], items: [{ title: 'bad', path: 'javascript:bad()', text: '', facts: '', lang: null }] }] };
    expect(validateQuestPublicProjection(unsafe, route)).toBeNull();
  });

  it('requires the live backend to explicitly establish a noncanonical city alias', () => {
    const page = pages.find((entry: { kind: string }) => entry.kind === 'city');
    const raw = { ...page, schema_version: 2, state: 'available', publication_id: 'b'.repeat(64), corpus_revision: 'c'.repeat(64), versions: [] };
    const route = parseQuestPublicRoute('/quests/7')!;
    expect(validateQuestPublicProjection(raw, route)).toBeNull();
    expect(validateQuestPublicProjection({ ...raw, requested_path: '/quests/7' }, route)?.canonical_path).toBe(raw.canonical_path);
  });

  it.each(['city_id', 'quest_slug', 'country_code', 'ru_source_path'])(
    'rejects nested private data injected into the landing %s identity slot', (field) => {
      for (const kind of ['city', 'country']) {
        const page = pages.find((entry: { kind: string }) => entry.kind === kind);
        const raw = { ...page, [field]: { task: 'PRIVATE' }, schema_version: 2, state: 'available',
          publication_id: 'b'.repeat(64), corpus_revision: 'c'.repeat(64), versions: [] };
        expect(validateQuestPublicProjection(raw, parseQuestPublicRoute(page.canonical_path)!)).toBeNull();
      }
    },
  );

  it.each(['https://name:secret@example.test/cover.webp', 'javascript:alert(1)', '//example.test/cover.webp'])(
    'rejects an unsafe public metadata image %s', (image) => {
      const raw = projection();
      raw.page = { ...raw.page, meta: { ...raw.page.meta, image } };
      expect(validateQuestPublicProjection(raw, parseQuestPublicRoute(raw.canonical_path)!)).toBeNull();
    },
  );

  it('rejects control characters while preserving ordinary prose whitespace', () => {
    const raw = projection(), route = parseQuestPublicRoute(raw.canonical_path)!;
    raw.page = { ...raw.page, lead: 'Line one\nLine two\tmore text' };
    expect(validateQuestPublicProjection(raw, route)).not.toBeNull();
    raw.page = { ...raw.page, lead: 'Unexpected\u000bcontrol' };
    expect(validateQuestPublicProjection(raw, route)).toBeNull();
    const unsafePath = projection();
    unsafePath.page = { ...unsafePath.page, sections: [{ heading: '', paragraphs: [],
      items: [{ title: 'Link', path: '/quests/a\u0000b', text: '', facts: '', lang: null }] }] };
    expect(validateQuestPublicProjection(unsafePath, route)).toBeNull();
  });

  it.each(['publication_id', 'corpus_revision', 'source_revision', 'content_revision'])(
    'rejects an array coerced into the %s revision field', (field) => {
      const raw = projection();
      expect(validateQuestPublicProjection({ ...raw, [field]: ['e'.repeat(64)] },
        parseQuestPublicRoute(raw.canonical_path)!)).toBeNull();
    },
  );
});
