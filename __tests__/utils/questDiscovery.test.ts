import { projectQuestDiscoveryRow, validateQuestDiscovery } from '@/utils/questDiscovery';
import { questPrivateSnapshot } from '../fixtures/questPublicProjection';

it('whitelists public catalogue metadata while dropping private fields and neutralizing personal state', () => {
  const raw = { ...questPrivateSnapshot().catalog[0], task: 'secret', answer_pattern: 'secret',
    is_completed_by_me: true, user_rating: 5, first_completer: { name: 'Private visitor' }, completions_count: 12 };
  const result = projectQuestDiscoveryRow(raw)!;
  expect(result.completions_count).toBe(12);
  expect(result.is_completed_by_me).toBe(false);
  expect(result.user_rating).toBeNull();
  expect(result.first_completer).toBeNull();
  expect(result.personal_status_unavailable).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/secret|Private visitor/);
});

it('rejects broken identities, invalid media and the wrong selected discovery view', () => {
  const quest = questPrivateSnapshot().catalog[0];
  expect(projectQuestDiscoveryRow({ ...quest, city_id: '../other' })).toBeNull();
  expect(projectQuestDiscoveryRow({ ...quest, cover_url: 'javascript:bad()' })).toBeNull();
  const raw = { schema_version: 2, state: 'available', locale: 'ru', view: 'home', quests: [quest],
    publication_id: 'a'.repeat(64), corpus_revision: 'b'.repeat(64), source_revision: 'c'.repeat(64), content_revision: 'd'.repeat(64) };
  expect(validateQuestDiscovery(raw, 'home')?.quests).toHaveLength(1);
  expect(validateQuestDiscovery(raw, 'catalog')).toBeNull();
  expect(validateQuestDiscovery({ ...raw, quests: Array.from({ length: 9 }, (_, index) => ({ ...quest, id: index + 1, quest_id: `quest-${index}` })) }, 'home')).toBeNull();
});

it.each(['publication_id', 'corpus_revision', 'source_revision', 'content_revision'])(
  'rejects an array coerced into the %s revision field', (field) => {
    const raw = { schema_version: 2, state: 'available', locale: 'ru', view: 'home', quests: [],
      publication_id: 'a'.repeat(64), corpus_revision: 'b'.repeat(64), source_revision: 'c'.repeat(64), content_revision: 'd'.repeat(64) };
    expect(validateQuestDiscovery({ ...raw, [field]: ['e'.repeat(64)] }, 'home')).toBeNull();
  },
);

it('requires the directory arrays in a catalogue response rather than silently dropping its href graph', () => {
  const raw = { schema_version: 2, state: 'available', locale: 'ru', view: 'catalog', quests: [],
    publication_id: 'a'.repeat(64), corpus_revision: 'b'.repeat(64), source_revision: 'c'.repeat(64), content_revision: 'd'.repeat(64) };
  expect(validateQuestDiscovery(raw, 'catalog')).toBeNull();
  expect(validateQuestDiscovery({ ...raw, cities: [], countries: [] }, 'catalog')).not.toBeNull();
});
