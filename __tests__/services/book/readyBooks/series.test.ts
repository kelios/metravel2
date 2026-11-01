import catalog from '@/data/travelBooks/series/catalog.json';
import castles from '@/data/travelBooks/series/castles-pl.json';
import mountains from '@/data/travelBooks/series/mountains-pl.json';
import manifest from '@/data/travelBooks/manifest.json';
import bySelection from '@/data/travelBooks/by/selection.json';
import plSelection from '@/data/travelBooks/pl/selection.json';
import {validateSeriesCollection} from '@/data/travelBooks/schema/series';

const publishedPlaces = [...bySelection.rows, ...plSelection.rows]
  .map(({pointId, lat, lng, title}) => ({pointId, lat, lng, title}));
const input = () => structuredClone({
  catalog,
  kits: {'castles-pl.json': castles, 'mountains-pl.json': mountains} as Record<string, any>,
  publishedBookIds: manifest.books.map(book => book.id),
  publishedPlaces,
});
const messages = (value: ReturnType<typeof input>) => validateSeriesCollection(value).issues.map(issue => issue.message).join('\n');

it('accepts both planned Polish pilots with 30 places and no repeats from published books', () => {
  const result = validateSeriesCollection(input());
  expect(result.issues).toEqual([]);
  expect(result.series.map(({series, kit}) => [series.id, series.status, kit.places.length])).toEqual([
    ['mountains-pl', 'planned', 30], ['castles-pl', 'planned', 30],
  ]);
});

it('rejects a place that repeats a published book', () => {
  const value = input();
  const published = plSelection.rows[0];
  Object.assign(value.kits['castles-pl.json'].places[0], {lat: published.lat + 0.001, lng: published.lng});
  expect(messages(value)).toContain(`repeats «${published.title}»`);
});

it('rejects a duplicated point and a wrong place count', () => {
  const value = input();
  const kit = value.kits['castles-pl.json'];
  kit.reserve[0] = {...kit.reserve[0], pointId: kit.places[0].pointId};
  value.kits['mountains-pl.json'].places.pop();
  const text = messages(value);
  expect(text).toContain('A point occurs more than once in the kit');
  expect(text).toContain('Expected 30 places, got 29');
});

it('keeps ready status behind a published book, print resolution and full mountain metrics', () => {
  const value = input();
  value.catalog.series.forEach(series => { series.status = 'ready'; });
  const text = messages(value);
  expect(text).toContain('Ready series references unpublished book poland-mountains-memory');
  expect(text).toContain('Ready series needs verified print resolution');
  expect(text).toContain('Ready mountain series needs trail, distance, elevation and duration');
});

it('requires route evidence for every mountain place', () => {
  const value = input();
  delete value.kits['mountains-pl.json'].places[3].route;
  expect(messages(value)).toContain('Mountain places need route evidence');
});

it('keeps every place inside the series countries', () => {
  const value = input();
  value.kits['castles-pl.json'].places[0].country = 'BY';
  value.catalog.series[0].countries = ['PL', 'PL'];
  const text = messages(value);
  expect(text).toContain('Place is outside the series countries');
  expect(text).toContain('Duplicate country');
});
