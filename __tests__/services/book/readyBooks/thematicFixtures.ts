import type {ThematicEvidence} from '@/data/travelBooks/schema/thematic';
import {thematicMapUrl} from '@/data/travelBooks/schema/thematic';
import {makeEditorialDraft} from './fixtures';
import {publishedFixture} from './publicationFixtures';

export function thematicEvidence(index = 0): ThematicEvidence {
  return {
    sourcePointId: index + 1, sourceTravelId: index + 100, authorId: 1,
    articleUrl: `https://metravel.by/travels/example-${index}`, publicationStatus: 'published', verifiedOn: '2026-11-02',
    sourceRelation: 'exact-place', sourceEvidence: 'The published article identifies the selected physical object.',
    mapTarget: {kind: 'published-point', pointId: index + 1, lat: 53.4 + index * .01, lng: 26.4,
      sourceUrl: `https://metravel.by/travels/example-${index}`, checkedOn: '2026-11-02', evidence: 'Exact source point.'},
    media: {kind: 'published-variant', uri: `https://metravel.by/gallery/source-${index}.jpg`,
      sha256: 'a'.repeat(64), bytes: 1000, widthPx: 1000, heightPx: 800, depiction: 'target',
      caption: 'Verified photograph of the selected destination.', permissionEvidence: 'Owner commissioned reuse.',
      placements: ['pocket-150x100', 'album-a5'].map(profileId => ({profileId: profileId as 'pocket-150x100' | 'album-a5', widthMm: 50, heightMm: 40, effectivePpi: 508}))},
    route: {start: 'Named trailhead', via: ['Named junction'], finish: 'Named destination', scope: 'One-way ascent',
      distanceKm: {min: 5, max: 6}, elevationGainM: 965, durationMinutes: 195,
      metricNote: 'Published whole-route estimates, not the final approach leg or a recorded author track.',
      sourceUrls: ['https://park.example/trail'], checkedOn: '2026-11-02', routeUse: 'itinerary-reference', sourceType: 'provider-estimate',
      difficulty: 'Exposure and chains; route colour is not difficulty.', seasonality: 'Check snow and current notices.',
      availability: {status: 'unknown', checkedOn: '2026-11-02', authorityUrl: 'https://park.example/notices', affectedScope: 'Whole stated route', note: 'Open access has not been established.'}},
  };
}

export function thematicDraft(stopCount = 30) {
  const legacy = makeEditorialDraft(stopCount);
  return {...legacy, id: 'poland-mountains-memory', slug: 'poland-mountains', country: 'PL' as const,
    sourceContract: 'thematic-v1' as const, seriesId: 'mountains-pl', theme: 'mountains' as const,
    stops: legacy.stops.map((stop, index) => {
      const thematic = thematicEvidence(index), target = thematic.mapTarget;
      return {...stop, lat: target.lat, lng: target.lng, thematic,
        source: {kind: 'travel-address' as const, id: String(thematic.sourcePointId), url: thematic.articleUrl},
        navigation: {authorId: 1 as const, sourceTravelId: thematic.sourceTravelId, articleUrl: thematic.articleUrl,
          verifiedAt: thematic.verifiedOn, mapUrl: thematicMapUrl(target, stop.title)}};
    })};
}

export function thematicPublished(seriesId = 'mountains-pl') {
  const base = publishedFixture(30, {country: 'PL'}), draft = thematicDraft();
  const mountain = seriesId === 'mountains-pl';
  const book = {...base, sourceContract: 'thematic-v1' as const, seriesId, theme: mountain ? 'mountains' as const : 'castles' as const,
    stops: base.stops.map((stop, index) => {
      const {pointId: _pointId, ...common} = stop;
      const thematic = structuredClone(draft.stops[index].thematic);
      if (!mountain) delete thematic.route;
      return {...common, thematic};
    })};
  return book;
}
