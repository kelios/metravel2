import { questPrivateSnapshot } from '../fixtures/questPublicProjection'
const { buildTravelLinkGraphs } = require('@/utils/travelLinkGraph')
const { validateTravelLinkGraph } = require('@/utils/travelLinkGraphContract')

const travels = [
  { id: 9, slug: 'nine', name: 'Nine', countryName: 'Беларусь' },
  { id: 2, slug: 'two', name: 'Two', countryName: 'Беларусь' },
  { id: 6, slug: 'six', name: 'Six', countryName: 'Литва' },
  { id: 4, slug: 'four', name: 'Four', countryName: 'Беларусь' },
  { id: 5, slug: 'five', name: 'Five', countryName: 'Польша' },
  { id: 3, slug: 'three', name: 'Three', countryName: 'Беларусь' },
  { id: 8, slug: 'eight', name: 'Eight', countryName: 'Литва' },
  { id: 1, slug: 'one', name: 'One', countryName: 'Беларусь', countryCode: 'by', cityName: 'Город' },
]
const source = questPrivateSnapshot()
const result = buildTravelLinkGraphs(travels, source.catalog, source.bundles.ru)
const response = { ...result['1'], schema_version: 2, state: 'available', locale: 'ru', view: 'travel', travel_id: 1,
  publication_id: 'a'.repeat(64), corpus_revision: 'b'.repeat(64), source_revision: 'c'.repeat(64), content_revision: 'd'.repeat(64) }

it('preserves the old country/id rotation and global fallback href order under the same source revision', () => {
  // Control captured from the old SSG selector: source ordering is API
  // -created_at,-id, not numeric identity or a new relevance sort.
  expect(result['1'].related.map((link: { path: string }) => link.path)).toEqual([
    '/travels/two', '/travels/four', '/travels/three', '/travels/nine', '/travels/six', '/travels/five',
  ])
  expect(result['1'].quests.map((match: { quest: { quest_id: string } }) => `/quests/7/${match.quest.quest_id}`))
    .toEqual(['/quests/7/fixture-city-walk'])
  expect(result['1'].quests[0]).toMatchObject({ score: 115, distance_km: null })
  expect(JSON.stringify(result)).not.toContain('answer_pattern')
  expect(JSON.stringify(result)).not.toContain(source.bundles.ru['7/fixture-city-walk'].steps[0].task)
})

it('whitelists bounded anonymous metadata and rejects foreign identities, bad links and excessive selections', () => {
  expect(validateTravelLinkGraph(response, 1)).toEqual(response)
  expect(validateTravelLinkGraph({ ...response, secret: 'private', related: response.related.map((row: object) => ({ ...row, private: 'x' })) }, 1)).toEqual(response)
  expect(validateTravelLinkGraph(response, 7)).toBeNull()
  expect(validateTravelLinkGraph({ ...response, publication_id: [response.publication_id] }, 1)).toBeNull()
  expect(validateTravelLinkGraph({ ...response, quests: Array(7).fill(response.quests[0]) }, 1)).toBeNull()
  expect(validateTravelLinkGraph({ ...response, quests: [{ ...response.quests[0], score: Infinity }] }, 1)).toBeNull()
  for (const path of ['https://evil.test', '//evil.test', '/travels/..', '/travels/%2e%2e', '/travels/a%2Fb', '/travels/a?next=x']) {
    expect(validateTravelLinkGraph({ ...response, related: [{ path, name: 'x' }] }, 1)).toBeNull()
  }
})
