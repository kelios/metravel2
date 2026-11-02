/** @jest-environment node */
import {editorialBookDraftSchema, thematicEditorialBookDraftSchema} from '@/data/travelBooks/schema/editorial';
import {thematicEvidenceSchema, thematicMapUrl} from '@/data/travelBooks/schema/thematic';
import {thematicSeriesKitSchema, validateSeriesCollection} from '@/data/travelBooks/schema/series';
import {publishedBookSchema, publicationSchema} from '@/services/book/readyBooks/publication';
import {editionFamily} from '@/services/book/readyBooks/editionFamily';
import {thematicDraft, thematicEvidence, thematicPublished} from './thematicFixtures';
import {publishedFixture} from './publicationFixtures';

test('retains strict legacy source requirements while accepting an explicit thematic branch', () => {
  const draft = thematicDraft();
  expect(thematicEditorialBookDraftSchema.safeParse(draft).success).toBe(true);
  expect(editorialBookDraftSchema.safeParse(draft).success).toBe(false);
  const missingIdentity = {...draft, sourceContract: undefined};
  expect(thematicEditorialBookDraftSchema.safeParse(missingIdentity).success).toBe(false);
});

test('maps a context source to independently verified coordinates without an invented API ID', () => {
  const draft = thematicDraft(), stop = draft.stops[0];
  stop.thematic.sourceRelation = 'area-context';
  stop.thematic.mapTarget = {kind: 'verified-coordinate', lat: 49.074529, lng: 22.726319, accuracy: 'site-center',
    sourceUrl: 'https://park.example/summit.gpx', checkedOn: '2026-11-02', evidence: 'Official summit endpoint.'};
  stop.lat = stop.thematic.mapTarget.lat; stop.lng = stop.thematic.mapTarget.lng;
  stop.navigation.mapUrl = thematicMapUrl(stop.thematic.mapTarget, stop.title);
  expect(new URL(stop.navigation.mapUrl).searchParams.has('placeId')).toBe(false);
  expect(thematicEditorialBookDraftSchema.safeParse(draft).success).toBe(true);
  const falseTarget = structuredClone(draft);
  Object.assign(falseTarget.stops[0].navigation, {pointId: stop.thematic.sourcePointId});
  expect(thematicEditorialBookDraftSchema.safeParse(falseTarget).success).toBe(false);
  stop.navigation.mapUrl += '&placeId=999';
  expect(thematicEditorialBookDraftSchema.safeParse(draft).success).toBe(false);
});

test('rejects one physical coordinate represented by both point and coordinate targets', () => {
  const draft = thematicDraft(), first = draft.stops[0], second = draft.stops[1];
  second.thematic.sourceRelation = 'area-context';
  second.thematic.mapTarget = {kind: 'verified-coordinate', lat: first.lat, lng: first.lng, accuracy: 'site-center',
    sourceUrl: 'https://park.example/target', checkedOn: '2026-11-02', evidence: 'Same target independently mapped.'};
  second.lat = first.lat; second.lng = first.lng;
  second.navigation.mapUrl = thematicMapUrl(second.thematic.mapTarget, second.title);
  expect(thematicEditorialBookDraftSchema.safeParse(draft).success).toBe(false);
  const kit = {schemaVersion: 2, sourceContract: 'thematic-v1', seriesId: 'mountains-pl', theme: 'mountains', authorId: 1,
    selectedOn: '2026-11-02', decision: 'Approved pilot', selectionRule: 'Distinct physical destinations', reserve: [],
    places: [first, second].map(stop => ({id: stop.id, title: stop.title, localName: stop.localName, country: 'PL', thematic: stop.thematic}))};
  expect(thematicSeriesKitSchema.safeParse(kit).success).toBe(false);
  const published = thematicPublished();
  published.stops[1].thematic = second.thematic;
  expect(publishedBookSchema.safeParse(published).success).toBe(false);
});

test('rejects wrong author, altered article identity and mismatched source target coordinates', () => {
  for (const mutate of [
    (draft: any) => { draft.stops[0].thematic.authorId = 2; },
    (draft: any) => { draft.stops[0].thematic.articleUrl = 'https://metravel.by/travels/another'; },
    (draft: any) => { draft.stops[0].lat += .5; },
    (draft: any) => { draft.stops[0].thematic.mapTarget.pointId = 999; },
  ]) {
    const draft = thematicDraft(); mutate(draft);
    expect(thematicEditorialBookDraftSchema.safeParse(draft).success).toBe(false);
  }
});

test('keeps original bytes distinct from a public association and verifies native placement PPI', () => {
  const value = thematicEvidence();
  value.media = {kind: 'owner-original', sourceId: 'private-original-1', sha256: 'b'.repeat(64), bytes: 12000,
    widthPx: 2000, heightPx: 1600, depiction: 'context', caption: 'Surrounding massif; summit is not shown.', permissionEvidence: 'Owner supplied source.',
    publishedAssociation: {uri: 'https://metravel.by/gallery/thumbnail.jpg', sha256: 'c'.repeat(64), bytes: 500,
      widthPx: 400, heightPx: 400, relationship: 'same-trip-context'}};
  expect(thematicEvidenceSchema.safeParse(value).success).toBe(true);
  Object.assign(value.media, {uri: 'https://metravel.by/gallery/thumbnail.jpg'});
  expect(thematicEvidenceSchema.safeParse(value).success).toBe(false);
  const badPpi = thematicEvidence(); badPpi.media.placements![0].effectivePpi = 1200;
  expect(thematicEvidenceSchema.safeParse(badPpi).success).toBe(false);
});

test('retains ranges and complete metrics for historical restricted routes', () => {
  const value = thematicEvidence(), route = value.route!;
  route.sourceType = 'historical-provider'; route.routeDate = '2020-08-08';
  route.availability = {status: 'restricted', checkedOn: '2026-11-02', authorityUrl: 'https://park.example/dam-notice', affectedScope: 'Behind damaged dam barriers', note: 'Historical reference only. Do not cross barriers.'};
  expect(thematicEvidenceSchema.safeParse(value).success).toBe(true);
  route.routeUse = 'current-recommendation';
  expect(thematicEvidenceSchema.safeParse(value).success).toBe(false);
  route.routeUse = 'itinerary-reference';
  route.distanceKm = {min: 6, max: 5};
  expect(thematicEvidenceSchema.safeParse(value).success).toBe(false);
  route.distanceKm = 4.5;
  (route as any).elevationGainM = null;
  expect(thematicEvidenceSchema.safeParse(value).success).toBe(false);
});

test('accepts independent country/mountain/castle photo families but rejects duplicate editions', () => {
  const by = publishedFixture(), pl = publishedFixture(30, {country: 'PL', id: 'poland-memory', slug: 'poland'});
  const mountain = thematicPublished(), castle = thematicPublished('castles-pl');
  const editions = [by, pl, mountain, castle].map((book, index) => ({...book, id: `test-book-${index}`, slug: ['belarus', 'poland', 'mountains', 'castles'][index], coverPersonalization: undefined,
    ...(index > 1 ? {visualStyle: 'photo'} : {})}));
  expect(publicationSchema.safeParse({schemaVersion: 1, releaseId: 'travel-books-v1', books: editions}).success).toBe(true);
  expect(editionFamily(mountain)).not.toBe(editionFamily(castle));
  expect(editionFamily(mountain)).not.toBe(editionFamily(pl));
  expect(editionFamily({...pl, visualStyle: 'photo'})).toBe(editionFamily(pl));
  const duplicate = {...editions[2], id: 'duplicate-photo', slug: 'duplicate-photo'};
  expect(publicationSchema.safeParse({schemaVersion: 1, releaseId: 'travel-books-v1', books: [...editions, duplicate]}).success).toBe(false);
  const badContext = thematicPublished(); badContext.stops[0].thematic.sourceRelation = 'area-context';
  Object.assign(badContext.stops[0], {pointId: badContext.stops[0].thematic.sourcePointId});
  expect(publishedBookSchema.safeParse(badContext).success).toBe(false);
});

test('v2 series readiness requires publication, full route facts and measured photographs', () => {
  const evidence = thematicEvidence(), kit = {schemaVersion: 2, sourceContract: 'thematic-v1', seriesId: 'mountains-pl', theme: 'mountains', authorId: 1,
    selectedOn: '2026-11-02', decision: 'Approved pilot', selectionRule: 'Verified selected destination',
    places: [{id: 'mountain-1', title: 'Mountain', localName: 'Mountain', country: 'PL', thematic: evidence}], reserve: []};
  expect(thematicSeriesKitSchema.safeParse(kit).success).toBe(true);
  const input = {catalog: {schemaVersion: 1, series: [{id: 'mountains-pl', theme: 'mountains', countries: ['PL'], bookIds: ['mountains-book'], status: 'ready', title: 'Mountains', kit: 'mountains-pl-sources.json', targetPlaces: 1}]},
    kits: {'mountains-pl-sources.json': kit}, publishedBookIds: ['mountains-book'], publishedPlaces: []};
  expect(validateSeriesCollection(input).success).toBe(true);
  delete evidence.media.placements;
  expect(validateSeriesCollection(input).success).toBe(false);
  evidence.route = undefined;
  expect(thematicSeriesKitSchema.safeParse(kit).success).toBe(false);
});
