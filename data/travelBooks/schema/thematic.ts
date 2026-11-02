import {z} from 'zod';
import {checkedDate, httpsUrl, identifier, nonempty} from './primitives.ts';

const positiveId = z.number().int().positive();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const ownArticle = httpsUrl.refine(value => {
  const url = new URL(value);
  return url.origin === 'https://metravel.by' && /^\/travels\/[a-z0-9-]+$/.test(url.pathname) && !url.search && !url.hash;
}, 'Expected the exact published MeTravel article');
export const thematicTheme = z.enum(['castles', 'mountains', 'mixed']);

const targetCoordinates = {
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  sourceUrl: httpsUrl, checkedOn: checkedDate, evidence: nonempty,
};
export const thematicMapTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({kind: z.literal('published-point'), pointId: positiveId, ...targetCoordinates}),
  z.strictObject({kind: z.literal('verified-coordinate'), ...targetCoordinates,
    accuracy: z.enum(['approach', 'site-center', 'entrance'])}),
]);

const photoBytes = {sha256, bytes: positiveId, widthPx: positiveId, heightPx: positiveId};
const placement = z.strictObject({profileId: z.enum(['pocket-150x100', 'album-a5']), widthMm: z.number().positive(), heightMm: z.number().positive(), effectivePpi: z.number().positive()});
const mediaCommon = {...photoBytes, depiction: z.enum(['target', 'context']), caption: nonempty, permissionEvidence: nonempty,
  placements: z.array(placement).length(2).optional()};
export const thematicMediaSchema = z.discriminatedUnion('kind', [
  z.strictObject({kind: z.literal('published-variant'), uri: httpsUrl, ...mediaCommon}),
  z.strictObject({kind: z.literal('owner-original'), sourceId: identifier, ...mediaCommon,
    publishedAssociation: z.strictObject({uri: httpsUrl, ...photoBytes,
      relationship: z.enum(['exact-visual-match', 'same-trip-context'])}).optional()}),
]);

const metric = (minimum: number, exclusive = false) => z.union([
  exclusive ? z.number().gt(minimum) : z.number().min(minimum),
  z.strictObject({min: exclusive ? z.number().gt(minimum) : z.number().min(minimum), max: exclusive ? z.number().gt(minimum) : z.number().min(minimum)})
    .refine(value => value.max >= value.min, 'Metric range is reversed'),
]);

const availability = z.strictObject({
  status: z.enum(['unknown', 'no-restriction-found', 'restricted', 'closed']),
  checkedOn: checkedDate, authorityUrl: httpsUrl.nullable(), affectedScope: nonempty, note: nonempty,
}).superRefine((value, ctx) => {
  if (value.status !== 'unknown' && !value.authorityUrl) {
    ctx.addIssue({code: 'custom', path: ['authorityUrl'], message: 'A known access state requires its dated authority source'});
  }
});

export const thematicRouteSchema = z.strictObject({
  start: nonempty, via: z.array(nonempty), finish: nonempty, scope: nonempty,
  distanceKm: metric(0, true), elevationGainM: metric(0), durationMinutes: metric(0, true),
  metricNote: nonempty, sourceUrls: z.array(httpsUrl).min(1), checkedOn: checkedDate,
  routeUse: z.enum(['itinerary-reference', 'current-recommendation']),
  sourceType: z.enum(['author-estimate', 'official', 'provider-estimate', 'gpx-measurement', 'historical-provider', 'mixed']),
  routeDate: checkedDate.optional(), difficulty: nonempty, seasonality: nonempty, availability,
}).superRefine((route, ctx) => {
  if (route.routeUse === 'current-recommendation' && route.availability.status !== 'no-restriction-found') {
    ctx.addIssue({code: 'custom', path: ['routeUse'], message: 'Unknown or restricted access cannot be a current route recommendation'});
  }
  if (route.sourceType === 'historical-provider' && (!route.routeDate || route.routeUse !== 'itinerary-reference')) {
    ctx.addIssue({code: 'custom', path: ['routeDate'], message: 'Historical routes require a recorded date and reference-only use'});
  }
});

export const thematicEvidenceSchema = z.strictObject({
  sourcePointId: positiveId, sourceTravelId: positiveId, authorId: z.literal(1), articleUrl: ownArticle,
  publicationStatus: z.literal('published'), verifiedOn: checkedDate,
  sourceRelation: z.enum(['exact-place', 'approach-context', 'area-context']), sourceEvidence: nonempty,
  mapTarget: thematicMapTargetSchema, media: thematicMediaSchema, route: thematicRouteSchema.optional(),
}).superRefine((value, ctx) => {
  const media = value.media;
  if (media.placements) {
    if (new Set(media.placements.map(p => p.profileId)).size !== 2) ctx.addIssue({code: 'custom', path: ['media', 'placements'], message: 'Both physical photo placements must be measured once'});
    media.placements.forEach((p, index) => {
      const nativePpi = Math.min(media.widthPx * 25.4 / p.widthMm, media.heightPx * 25.4 / p.heightMm);
      if (Math.abs(nativePpi - p.effectivePpi) > 1) ctx.addIssue({code: 'custom', path: ['media', 'placements', index, 'effectivePpi'], message: 'Placed photo resolution differs from native source pixels'});
    });
  }
  if (value.sourceRelation === 'exact-place' && value.mapTarget.kind === 'published-point' && value.sourcePointId !== value.mapTarget.pointId) {
    ctx.addIssue({code: 'custom', path: ['mapTarget', 'pointId'], message: 'An exact source must identify the same published target point'});
  }
  if (value.sourceRelation !== 'exact-place' && value.mapTarget.kind === 'published-point' && value.sourcePointId === value.mapTarget.pointId) {
    ctx.addIssue({code: 'custom', path: ['mapTarget'], message: 'A contextual source point cannot be relabelled as the physical target'});
  }
});
export type ThematicEvidence = z.infer<typeof thematicEvidenceSchema>;

/** A coordinate target and a published point at the same coordinates are still one physical place. */
export function hasDuplicateThematicTargets(targets: ThematicEvidence['mapTarget'][]): boolean {
  const pointIds = new Set<number>(), coordinates = new Set<string>();
  for (const target of targets) {
    const position = `${target.lat}:${target.lng}`;
    if (coordinates.has(position) || (target.kind === 'published-point' && pointIds.has(target.pointId))) return true;
    coordinates.add(position);
    if (target.kind === 'published-point') pointIds.add(target.pointId);
  }
  return false;
}

/** Canonical coordinate markers intentionally omit placeId when no exact API target exists. */
export function thematicMapUrl(target: ThematicEvidence['mapTarget'], title: string): string {
  const url = new URL('https://metravel.by/map');
  url.searchParams.set('lat', String(target.lat));
  url.searchParams.set('lng', String(target.lng));
  url.searchParams.set('placeTitle', title);
  url.searchParams.set('focusPlace', '1');
  if (target.kind === 'published-point') url.searchParams.set('placeId', String(target.pointId));
  return url.href;
}

type ThematicNavigationStop = {title: string; lat: number; lng: number; thematic: ThematicEvidence; source: {kind: string; id: string; url: string};
  navigation: {authorId: 1; sourceTravelId: number; mapUrl: string; articleUrl: string; verifiedAt: string; pointId?: number}};
export function checkThematicNavigation(stop: ThematicNavigationStop, ctx: z.RefinementCtx) {
  const {thematic, navigation} = stop;
  const target = thematic.mapTarget;
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({code: 'custom', path, message});
  if (stop.source.kind !== 'travel-address' || stop.source.id !== String(thematic.sourcePointId) || stop.source.url !== thematic.articleUrl) issue(['source'], 'Thematic source must identify its real article point, independently of the target');
  if (navigation.articleUrl !== thematic.articleUrl || navigation.sourceTravelId !== thematic.sourceTravelId || navigation.verifiedAt !== thematic.verifiedOn) issue(['navigation'], 'Navigation must match the verified thematic article');
  if (stop.lat !== target.lat || stop.lng !== target.lng) issue(['thematic', 'mapTarget'], 'Renderer coordinates must identify the physical target');
  if (navigation.pointId !== undefined && (thematic.sourceRelation !== 'exact-place' || target.kind !== 'published-point' || navigation.pointId !== target.pointId)) issue(['navigation', 'pointId'], 'Only exact published targets may expose a navigation point ID');
  try {
    const actual = new URL(navigation.mapUrl), expected = new URL(thematicMapUrl(target, stop.title));
    if (actual.origin !== expected.origin || actual.pathname !== '/map' || actual.hash || [...actual.searchParams.keys()].length !== [...expected.searchParams.keys()].length || [...expected.searchParams].some(([key, value]) => actual.searchParams.get(key) !== value)) issue(['navigation', 'mapUrl'], 'Map navigation must identify the exact thematic target and title');
  } catch { issue(['navigation', 'mapUrl'], 'Invalid thematic map navigation'); }
}
