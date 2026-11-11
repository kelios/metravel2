import { validateQuestDiscovery } from '@/utils/questDiscovery';
import { compactQuestDiscovery, expandQuestDiscovery, readQuestDiscoveryLoaderData } from '@/utils/questDiscoveryWire';
import { questPrivateSnapshot } from '../fixtures/questPublicProjection';

// #3234: inline-JSON каталога квестов идёт в HTML в компактной форме; граница
// маршрута обязана восстановить ровно ту строку, что отдал валидатор.
const hash = 'a'.repeat(64);
const discovery = (quests: unknown[]) => validateQuestDiscovery({
  schema_version: 2, state: 'available', locale: 'ru', view: 'catalog',
  publication_id: hash, corpus_revision: hash, source_revision: hash, content_revision: hash,
  quests, cities: [], countries: [],
}, 'catalog')!;

const base = questPrivateSnapshot().catalog[0];
const rows = [
  base,
  // Отличия от умолчаний обязаны пережить сжатие.
  { ...base, id: 18, quest_id: 'fixture-two', city_name_localized: 'Горад', city_legacy_ids: [3], pet_friendly: true,
    available_locales: ['ru', 'be'], rating_count: 4, completions_count: 9, rating_avg: 4.5 },
  { ...base, id: 19, quest_id: 'fixture-three', city_name_canonical: null, available_locales: ['ru', 'be', 'uk', 'pl', 'en'] },
];

it('round-trips every validated row exactly', () => {
  const full = discovery(rows);
  expect(full.quests).toHaveLength(3);
  expect(expandQuestDiscovery(compactQuestDiscovery(full))).toEqual(full);
});

it('drops fields equal to their defaults and keeps real values', () => {
  const [plain, custom, nullCanonical] = compactQuestDiscovery(discovery(rows)).rows;
  for (const key of ['personal_status_unavailable', 'user_rating', 'is_completed_by_me', 'first_completer',
    'content_locale', 'city_name_canonical', 'city_legacy_ids', 'rating_avg']) {
    expect(plain).not.toHaveProperty(key);
  }
  expect(custom).toMatchObject({ city_name_localized: 'Горад', city_legacy_ids: [3], pet_friendly: true,
    available_locales: ['ru', 'be'], rating_count: 4, completions_count: 9, rating_avg: 4.5 });
  // `null` у канонического имени — не то же самое, что «как city_name».
  expect(nullCanonical).toHaveProperty('city_name_canonical', null);
  expect(nullCanonical).not.toHaveProperty('available_locales');
});

it('leaves an already full row unchanged, so expanding twice is harmless', () => {
  const full = discovery(rows);
  expect(expandQuestDiscovery(full)).toEqual(full);
  expect(expandQuestDiscovery(expandQuestDiscovery(compactQuestDiscovery(full)))).toEqual(full);
});

it('makes the serialized catalogue noticeably smaller', () => {
  const many = Array.from({ length: 50 }, (_, index) => ({ ...base, id: index + 1, quest_id: `quest-${index}` }));
  const full = discovery(many);
  const before = JSON.stringify(full).length;
  const after = JSON.stringify(compactQuestDiscovery(full)).length;
  expect(after).toBeLessThan(before * 0.85);
});

it('hides compact rows from pre-#3234 clients and reads both wire forms (#3234)', () => {
  const full = discovery(rows);
  const compact = compactQuestDiscovery(full);
  // An old client bundle validates `Array.isArray(loaded.quests)`: compact data must fail it.
  expect(compact).not.toHaveProperty('quests');
  expect(readQuestDiscoveryLoaderData(JSON.parse(JSON.stringify(compact)))).toEqual(full);
  // Loader data of a server from before #3234 (full rows under `quests`).
  expect(readQuestDiscoveryLoaderData(JSON.parse(JSON.stringify(full)))).toEqual(full);
  for (const bad of [null, undefined, 0, '', { ...compact, schema_version: 1 }, { ...compact, view: 'travel' },
    { ...compact, state: 'unavailable' }, { ...compact, rows: null }]) {
    expect(readQuestDiscoveryLoaderData(bad)).toBeNull();
  }
});
