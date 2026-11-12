import { haversineMeters } from '@/utils/geoDistance';
import { enabledQuestTags } from '@/utils/questTags';

export const questPublicLocales = ['ru', 'be', 'uk', 'pl', 'en'] as const;

function prose(seed: number) {
  let state = seed;
  return Array.from({ length: 5 }, () => Array.from({ length: 18 }, () => {
    let word = '';
    for (let character = 0; character < 8; character += 1) {
      state = (state * 48271) % 2147483647;
      word += String.fromCharCode(97 + state % 26);
    }
    return word;
  }).join(' ') + '.').join(' ');
}

export function questPrivateSnapshot() {
  const quest = { id: 17, quest_id: 'fixture-city-walk', city_id: '7', city_name: 'Город',
    city_name_canonical: 'Город', country_code: 'BY', country_name: 'Беларусь',
    title: 'Квест по городу', points: 10, duration_min: 90, difficulty: 'easy', lat: 53.9, lng: 27.5,
    cover_url: 'https://metravel.by/quest-cover/fixture.webp' };
  const record = { quest_pk: 17, city_id: 7, quest_slug: quest.quest_id, source_revision: 'a'.repeat(64),
    locales: Object.fromEntries(questPublicLocales.map((locale, index) => [locale, { content_revision: String(index + 1).repeat(64),
      fence_revision: '1', published: true, complete: true }])) };
  const bundles = Object.fromEntries(questPublicLocales.map((locale) => [locale, { ['7/' + quest.quest_id]: {
    id: 17, quest_id: quest.quest_id, title: locale === 'ru' ? quest.title : `Quest ${locale}`,
    content_locale: locale, duration_min: 90,
    city: { id: 7, name: 'Город', name_canonical: 'Город', name_localized: locale === 'ru' ? 'Город' : 'City', country_code: 'BY' },
    intro: { id: 'intro', title: 'Вступление', story: 'Приглашение на прогулку по старому городу.', location: 'Площадь' },
    steps: Array.from({ length: 10 }, (_, index) => ({ id: index + 1, step_id: `point-${index + 1}`,
      title: `Место ${index + 1}`, location: `Улица ${index + 1}`, story: prose(100003 + index * 7103),
      task: 'Посчитайте необычные резные листья на боковой стороне скамейки.',
      hint: 'Подсказка скрывается на обратной стороне старого городского знака.',
      answer_pattern: { type: 'text', value: 'секретная последовательность' },
      lat: 53.9 + index * 0.001, lng: 27.5, order: index, point_role: 'required',
      poi_info: { is_museum: false, opening_hours: '', ticket_price: '' } })),
    finale: { text: 'Заключение', video_url: null, poster_url: null },
  } } ]));
  return { schema_version: 2, source_snapshot: { receipt_digest: 'f'.repeat(64), quests: [record] },
    catalog: [quest], bundles, aliases: {}, travel_links: [] };
}

type QuestPrivateSnapshot = ReturnType<typeof questPrivateSnapshot>;
type BuiltPage = { kind: string; locale: string; canonical_path: string; content_revision: string;
  city_id?: number; quest_slug?: string };

/**
 * Route facts of one fixture quest, derived as the backend derives them from the
 * same private snapshot (`quests/services/web_snapshot.py` `_trip`, #3317): the
 * numbered steps in step order, closed back to the start only by an enabled loop
 * tag over a real gap; an unknown fact is null, never an estimate. The builder
 * (`scripts/lib/questWebProjection.js`) never supplies them — the backend adds
 * them to its output (`web_publication.py` `validate_output`).
 */
export function questTripFacts(snapshot: QuestPrivateSnapshot, cityId: number, questSlug: string) {
  const quest = snapshot.catalog.find((row) => Number(row.city_id) === cityId && row.quest_id === questSlug);
  if (!quest) return null;
  const steps = [...snapshot.bundles.ru[`${cityId}/${questSlug}`].steps].sort((a, b) => a.order - b.order || a.step_id.localeCompare(b.step_id));
  const points = steps.map((step) => [step.lat, step.lng] as const);
  const located = points.length > 0 && points.every(([lat, lng]) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0));
  const metres = (a: readonly [number, number], b: readonly [number, number]) => haversineMeters(a[0], a[1], b[0], b[1]);
  const loop = enabledQuestTags((quest as { tags?: unknown }).tags).some((tag) => ['loop', 'circular'].includes(tag.trim().toLowerCase()));
  const route = located && loop && points.length >= 3 && metres(points[points.length - 1], points[0]) > 50 ? [...points, points[0]] : points;
  const distance = located && points.length > 1
    ? Math.round(route.slice(1).reduce((sum, point, index) => sum + metres(route[index], point), 0)) : 0;
  return { duration_min: Number.isInteger(quest.duration_min) && quest.duration_min > 0 ? quest.duration_min : null,
    distance_m: distance || null, start: located ? { lat: points[0][0], lng: points[0][1] } : null, is_free: true };
}

/**
 * What `GET /api/quests/web/detail/<city>/<slug>/?lang=` answers for one built
 * detail: the builder's page inside the backend's envelope, with the backend's
 * `trip_facts`. One composition for every test that feeds the loader, the
 * validator or the structured data, so none of them adds a field by hand.
 */
export function questPublicApiResponse<Page extends BuiltPage>(pages: Page[], snapshot: QuestPrivateSnapshot,
  locale: (typeof questPublicLocales)[number] = 'ru') {
  const details = pages.filter((entry) => entry.kind === 'detail');
  const page = details.find((entry) => entry.locale === locale);
  const ru = details.find((entry) => entry.locale === 'ru');
  if (!page || !ru) throw new Error(`Fixture has no ${locale} detail`);
  return { ...page, trip_facts: questTripFacts(snapshot, page.city_id as number, page.quest_slug as string),
    schema_version: 2 as const, state: 'available' as const, publication_id: 'b'.repeat(64), corpus_revision: 'c'.repeat(64),
    ru_source_path: ru.canonical_path, requested_path: page.canonical_path,
    versions: details.map((entry) => ({ locale: entry.locale, path: entry.canonical_path, content_revision: entry.content_revision })) };
}
