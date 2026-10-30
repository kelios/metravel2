import { z } from 'zod';

export const identifier = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
export const nonempty = z.string().trim().min(1);
export const httpsUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}, 'Expected an HTTPS URL without credentials');
export const checkedDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Expected a real calendar date');

const reference = z.strictObject({
  url: httpsUrl, checkedAt: checkedDate, claims: z.array(nonempty).min(1),
});
const natureRoute = z.strictObject({
  name: nonempty,
  direction: z.enum(['round-trip', 'one-way', 'loop']),
  distanceKm: z.number().positive(),
  elevationGainM: z.number().nonnegative().nullable(),
  durationMinutes: z.number().positive(),
  difficulty: nonempty, seasonality: nonempty,
  officialAlertsUrl: httpsUrl, metricsSourceUrl: httpsUrl, metricNote: nonempty,
});

export const editorialStop = z.strictObject({
  id: identifier, title: nonempty, localName: nonempty,
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  entrance: nonempty,
  coordinateAccuracy: z.enum(['entrance', 'approach', 'site-center']),
  coordinateSource: httpsUrl,
  source: z.strictObject({
    kind: z.enum(['official', 'place', 'travel-address', 'quest-step']),
    id: nonempty, url: httpsUrl,
  }),
  text: z.strictObject({compact: z.string().trim().min(100).max(550), album: z.string().trim().min(100).max(900)}),
  navigation: z.strictObject({
    authorId: z.literal(1), pointId: z.number().int().positive(), sourceTravelId: z.number().int().positive(),
    mapUrl: httpsUrl, articleUrl: httpsUrl, verifiedAt: checkedDate,
    quest: z.strictObject({url: httpsUrl, id: z.number().int().positive(), evidence: nonempty}).optional(),
  }).optional(),
  fact: nonempty,
  legend: z.strictObject({label: z.literal('Легенда'), text: nonempty, sourceUrl: httpsUrl}).optional(),
  observation: nonempty,
  references: z.array(reference).min(1), imageBrief: nonempty,
  natureRoute: natureRoute.optional(),
});

export const editorialShape = {
  schemaVersion: z.literal(1), id: identifier, slug: identifier, revision: identifier,
  country: z.enum(['BY', 'PL']), contentLocale: z.literal('ru'), title: nonempty,
  stops: z.array(editorialStop).min(1),
  miniTrips: z.array(z.strictObject({
    id: identifier, title: nonempty, stopIds: z.array(identifier).min(1), note: nonempty,
  })).min(1),
  gaps: z.array(nonempty).optional(),
};

type EditorialComposition = {
  stops: {id: string; text: {compact: string; album: string}; natureRoute?: {elevationGainM: number | null}}[];
  miniTrips: {id: string; stopIds: string[]}[];
  gaps?: string[];
};

export function checkEditorialComposition(book: EditorialComposition, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({code: 'custom', path, message});
  const stopIds = new Set<string>();
  book.stops.forEach((stop, index) => {
    if (stopIds.has(stop.id)) issue(['stops', index, 'id'], 'Duplicate stop ID');
    stopIds.add(stop.id);
    if (stop.text.album.length < stop.text.compact.length) issue(['stops', index, 'text', 'album'], 'Album text must not be shorter than compact text');
    if (stop.natureRoute?.elevationGainM === null && !book.gaps?.length) {
      issue(['stops', index, 'natureRoute', 'elevationGainM'], 'Unknown elevation requires an explicit editorial gap');
    }
  });
  const tripIds = new Set<string>();
  const covered = new Set<string>();
  book.miniTrips.forEach((trip, index) => {
    if (tripIds.has(trip.id)) issue(['miniTrips', index, 'id'], 'Duplicate trip ID');
    tripIds.add(trip.id);
    if (new Set(trip.stopIds).size !== trip.stopIds.length) issue(['miniTrips', index, 'stopIds'], 'Duplicate stop in mini-trip');
    for (const id of trip.stopIds) {
      if (!stopIds.has(id)) issue(['miniTrips', index, 'stopIds'], `Unknown stop: ${id}`);
      covered.add(id);
    }
  });
  if ([...stopIds].some(id => !covered.has(id))) issue(['miniTrips'], 'Mini-trips must cover every selected stop');
}

export const editorialBookDraftSchema = z.strictObject({
  ...editorialShape, status: z.literal('editorial-draft'),
}).superRefine(checkEditorialComposition);
