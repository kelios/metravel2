import {z} from 'zod';
import {haversineMeters} from '../../../utils/geoDistance.ts';
import {checkedDate, httpsUrl, identifier, nonempty} from './editorial.ts';
import {thematicEvidenceSchema, hasDuplicateThematicTargets} from './thematic.ts';

// Published BY/PL books are not repeated: same pointId or a point closer than this is an overlap.
export const SERIES_OVERLAP_RADIUS_M = 400;

const country = z.enum(['BY', 'PL']);
const theme = z.enum(['castles', 'mountains', 'mixed']);
const positiveId = z.number().int().positive();
const metravelUrl = httpsUrl.refine(value => new URL(value).origin === 'https://metravel.by', 'Expected a MeTravel URL');

const officialSource = z.discriminatedUnion('status', [
  z.strictObject({status: z.literal('verified-200'), url: httpsUrl, organization: nonempty, checkedOn: checkedDate}),
  z.strictObject({status: z.literal('unknown'), url: z.null(), note: nonempty}),
]);

const photo = z.strictObject({
  status: z.enum([
    'author-photo-matched', 'author-photo-matched-below-1000px', 'gallery-caption-match',
    'article-has-photos-no-alt-match', 'point-thumbnail-only',
  ]),
  articleImages: z.number().int().nonnegative(),
  maxArticleLongSidePx: positiveId.nullable(),
  sampleAlt: nonempty.nullable(),
  printResolution: z.enum(['unknown', 'verified']),
});

const season = z.discriminatedUnion('status', [
  z.strictObject({status: z.literal('official'), source: httpsUrl, checkedOn: checkedDate, text: nonempty}),
  z.strictObject({status: z.literal('unknown'), source: httpsUrl.nullable(), text: nonempty}),
]);

// null means "not verified yet"; a ready mountain book needs every metric.
const route = z.strictObject({
  authorComplexity: z.array(nonempty).min(1),
  officialDifficulty: nonempty.nullable(),
  season,
  trail: nonempty.nullable(),
  distanceKm: z.number().positive().nullable(),
  elevationGainM: z.number().nonnegative().nullable(),
  durationMinutes: z.number().positive().nullable(),
});

const place = z.strictObject({
  pointId: positiveId, travelId: positiveId, title: nonempty, sourceTitle: nonempty, category: nonempty,
  country, region: nonempty.nullable(),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  articleUrl: metravelUrl, articleTitle: nonempty,
  officialSource, photo, route: route.optional(),
});

export const seriesKitSchema = z.strictObject({
  schemaVersion: z.literal(1), seriesId: identifier, theme, authorId: z.literal(1),
  selectedOn: checkedDate, decision: nonempty, selectionRule: nonempty,
  places: z.array(place).min(1),
  reserve: z.array(place.extend({reason: nonempty})),
}).superRefine((kit, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({code: 'custom', path, message});
  const all = [...kit.places, ...kit.reserve];
  if (new Set(all.map(item => item.pointId)).size !== all.length) issue(['places'], 'A point occurs more than once in the kit');
  all.forEach((item, index) => {
    const path = index < kit.places.length ? ['places', index] : ['reserve', index - kit.places.length];
    if (kit.theme === 'mountains' && !item.route) issue([...path, 'route'], 'Mountain places need route evidence');
    if (kit.theme === 'castles' && item.route) issue([...path, 'route'], 'Castle places carry no route');
  });
});

export const thematicSeriesPlaceSchema = z.strictObject({
  id: identifier, title: nonempty, localName: nonempty, country, thematic: thematicEvidenceSchema,
});
export const thematicSeriesKitSchema = z.strictObject({
  schemaVersion: z.literal(2), sourceContract: z.literal('thematic-v1'), seriesId: identifier, theme,
  authorId: z.literal(1), selectedOn: checkedDate, decision: nonempty, selectionRule: nonempty,
  places: z.array(thematicSeriesPlaceSchema).min(1),
  reserve: z.array(thematicSeriesPlaceSchema.extend({reason: nonempty})),
}).superRefine((kit, ctx) => {
  const all = [...kit.places, ...kit.reserve];
  if (new Set(all.map(p => p.id)).size !== all.length) ctx.addIssue({code: 'custom', path: ['places'], message: 'A place occurs more than once in the kit'});
  if (hasDuplicateThematicTargets(kit.places.map(p => p.thematic.mapTarget))) ctx.addIssue({code: 'custom', path: ['places'], message: 'A physical target occurs more than once in the kit'});
  all.forEach((place, index) => {
    if ((kit.theme === 'mountains' && !place.thematic.route) || (kit.theme === 'castles' && place.thematic.route)) ctx.addIssue({code: 'custom', path: index < kit.places.length ? ['places', index, 'thematic', 'route'] : ['reserve', index - kit.places.length, 'thematic', 'route'], message: 'Mountain entries require complete routes and castle entries cannot carry them'});
  });
});
export const anySeriesKitSchema = z.union([seriesKitSchema, thematicSeriesKitSchema]);

export const bookSeriesSchema = z.strictObject({
  id: identifier, theme,
  countries: z.array(country).min(1).refine(list => new Set(list).size === list.length, 'Duplicate country'),
  bookIds: z.array(identifier).min(1),
  status: z.enum(['planned', 'ready']), title: nonempty,
  kit: z.string().regex(/^[a-z0-9-]+\.json$/), targetPlaces: positiveId,
});

export const seriesCatalogSchema = z.strictObject({
  schemaVersion: z.literal(1), series: z.array(bookSeriesSchema).min(1),
}).superRefine((catalog, ctx) => {
  const ids = catalog.series.map(series => series.id);
  const bookIds = catalog.series.flatMap(series => series.bookIds);
  if (new Set(ids).size !== ids.length) ctx.addIssue({code: 'custom', path: ['series'], message: 'Duplicate series ID'});
  if (new Set(bookIds).size !== bookIds.length) ctx.addIssue({code: 'custom', path: ['series'], message: 'A book belongs to several series'});
});

export type BookSeries = z.infer<typeof bookSeriesSchema>;
export type SeriesKit = z.infer<typeof anySeriesKitSchema>;
export type PublishedPlace = {pointId: number; lat: number; lng: number; title: string};
export type SeriesIssue = {path: string; message: string};

export function validateSeriesCollection(input: {
  catalog: unknown; kits: Record<string, unknown>; publishedBookIds: string[]; publishedPlaces: PublishedPlace[];
}): {success: boolean; issues: SeriesIssue[]; series: {series: BookSeries; kit: SeriesKit}[]} {
  const issues: SeriesIssue[] = [];
  const zodIssues = (prefix: string, error: z.ZodError) => error.issues.forEach(item =>
    issues.push({path: [prefix, ...item.path].join('.'), message: item.message}));
  const catalog = seriesCatalogSchema.safeParse(input.catalog);
  if (!catalog.success) {
    zodIssues('catalog', catalog.error);
    return {success: false, issues, series: []};
  }
  const parsed: {series: BookSeries; kit: SeriesKit}[] = [];
  for (const series of catalog.data.series) {
    const fail = (path: string, message: string) => issues.push({path: `${series.id}.${path}`, message});
    if (!(series.kit in input.kits)) {
      fail('kit', `Missing kit ${series.kit}`);
      continue;
    }
    const kit = anySeriesKitSchema.safeParse(input.kits[series.kit]);
    if (!kit.success) {
      zodIssues(series.id, kit.error);
      continue;
    }
    const {places} = kit.data;
    if (kit.data.seriesId !== series.id || kit.data.theme !== series.theme) fail('kit', 'Kit belongs to another series or theme');
    if (places.length !== series.targetPlaces) fail('places', `Expected ${series.targetPlaces} places, got ${places.length}`);
    [...places, ...kit.data.reserve].forEach((item, index) => {
      const path = index < places.length ? `places.${index}` : `reserve.${index - places.length}`;
      if (!series.countries.includes(item.country)) fail(`${path}.country`, 'Place is outside the series countries');
    });
    places.forEach((item, index) => {
      const target = 'thematic' in item ? item.thematic.mapTarget : item;
      const pointId = 'thematic' in item ? (item.thematic.mapTarget.kind === 'published-point' ? item.thematic.mapTarget.pointId : undefined) : item.pointId;
      const overlap = input.publishedPlaces.find(published => published.pointId === pointId ||
        haversineMeters(published.lat, published.lng, target.lat, target.lng) < SERIES_OVERLAP_RADIUS_M);
      if (overlap) fail(`places.${index}`, `${item.title} repeats «${overlap.title}» from a published book`);
    });
    if (series.status === 'ready') {
      series.bookIds.filter(id => !input.publishedBookIds.includes(id))
        .forEach(id => fail('bookIds', `Ready series references unpublished book ${id}`));
      places.forEach((item, index) => {
        if ('thematic' in item) {
          if (!item.thematic.media.placements) fail(`places.${index}.thematic.media`, 'Ready series needs verified native photo placement resolution');
        } else {
          if (item.photo.printResolution !== 'verified') fail(`places.${index}.photo`, 'Ready series needs verified print resolution');
          const r = item.route;
          if (r && [r.trail, r.distanceKm, r.elevationGainM, r.durationMinutes].includes(null)) {
            fail(`places.${index}.route`, 'Ready mountain series needs trail, distance, elevation and duration');
          }
        }
      });
    }
    parsed.push({series, kit: kit.data});
  }
  return {success: issues.length === 0, issues, series: parsed};
}
