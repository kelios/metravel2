// #3321: properties whose schema.org domain includes Trip/TouristTrip (schemaorg-current,
// 12.11.2026), plus the CreativeWork-only ones the quest node uses as its second type.
// `location` (Action/Event/Organization) and `distance` (ExerciseAction/TravelAction) are
// deliberately absent: they made the single-typed node invalid.
const TRIP_PROPERTIES = ['additionalType', 'alternateName', 'arrivalTime', 'departureTime', 'description', 'identifier',
  'image', 'itinerary', 'mainEntityOfPage', 'name', 'offers', 'partOfTrip', 'potentialAction', 'provider', 'sameAs',
  'subTrip', 'subjectOf', 'touristType', 'tripOrigin', 'url'];
const CREATIVE_WORK_PROPERTIES = ['inLanguage', 'timeRequired', 'isAccessibleForFree', 'contentLocation'];

export const QUEST_ENTITY_ALLOWED_KEYS = new Set(['@type', '@id', ...TRIP_PROPERTIES, ...CREATIVE_WORK_PROPERTIES]);

/** Every property of the quest node is valid for `["TouristTrip", "CreativeWork"]`; nested values keep their own domain. */
export function expectQuestEntityInSchemaDomain(node: Record<string, unknown>) {
  expect(node['@type']).toEqual(['TouristTrip', 'CreativeWork']);
  expect(Object.keys(node).filter((key) => !QUEST_ENTITY_ALLOWED_KEYS.has(key))).toEqual([]);
  const action = node.potentialAction as Record<string, unknown> | undefined;
  if (action) expect(Object.keys(action).sort()).toEqual(['@type', 'distance']);
  if (action) expect(action['@type']).toBe('TravelAction');
  const origin = node.tripOrigin as Record<string, unknown> | undefined;
  if (origin) expect(Object.keys(origin).sort()).toEqual(['@type', 'geo']);
}
