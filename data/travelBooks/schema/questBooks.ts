import {z} from 'zod';
import {checkedDate, httpsUrl, identifier, nonempty} from './editorial.ts';
import {sha256} from './manifest.ts';

const country = z.enum(['BY', 'PL']);
const positiveId = z.number().int().positive();
const parseUrl = (value: string) => {try {return new URL(value);} catch {return null;}};
const ownUrl = httpsUrl.refine(value => {
  const url = parseUrl(value);
  return url?.origin === 'https://metravel.by' && !url.hash;
}, 'Expected an owned MeTravel URL');

export const questBookEntrySchema = z.strictObject({
  id: positiveId, questId: identifier, title: nonempty, city: nonempty,
  questUrl: ownUrl, durationMinutes: z.number().positive(), difficulty: nonempty,
  tags: z.array(nonempty), overview: z.string().trim().min(200).max(750),
  compactOverview: z.string().trim().min(120).max(300).optional(),
  source: z.strictObject({bundleUrl: ownUrl, sha256, verifiedAt: checkedDate}),
  cover: z.strictObject({
    uri: ownUrl, sha256, bytes: positiveId,
    widthPx: positiveId, heightPx: positiveId,
  }),
  points: z.array(z.strictObject({
    id: positiveId, stepId: identifier, title: nonempty, location: nonempty,
    lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
    role: z.enum(['start', 'required', 'optional', 'final']),
  })).min(1),
}).superRefine((quest, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({code: 'custom', path, message});
  const questUrl = parseUrl(quest.questUrl);
  const bundleUrl = parseUrl(quest.source.bundleUrl);
  const coverUrl = parseUrl(quest.cover.uri);
  if (!questUrl || !bundleUrl || !coverUrl) return;
  const segments = questUrl.pathname.split('/').filter(Boolean);
  if (segments.length !== 3 || segments[0] !== 'quests' || segments[2] !== quest.questId || questUrl.search) {
    issue(['questUrl'], 'Quest URL must identify this published quest');
  }
  if (bundleUrl.pathname !== `/api/quests/${quest.id}/` || bundleUrl.search !== '?lang=ru') {
    issue(['source', 'bundleUrl'], 'Source bundle URL must identify the same Russian quest');
  }
  if (!coverUrl.pathname.startsWith(`/quest-cover/quests/${quest.id}/`) || coverUrl.search) {
    issue(['cover', 'uri'], 'Cover must be the original media of this quest');
  }
  if (new Set(quest.tags).size !== quest.tags.length) issue(['tags'], 'Duplicate quest tags');
  if (new Set(quest.points.map(point => point.id)).size !== quest.points.length ||
      new Set(quest.points.map(point => point.stepId)).size !== quest.points.length) {
    issue(['points'], 'Every source point must occur exactly once');
  }
  quest.points.forEach((point, index) => {
    if (point.lat === 0 && point.lng === 0) issue(['points', index], 'A point needs verified coordinates');
  });
});

export const countryQuestBookSchema = z.strictObject({
  schemaVersion: z.literal(1), kind: z.literal('quests'), status: z.literal('editorial-draft'),
  id: identifier, slug: identifier, seriesId: identifier, country,
  volume: z.literal(1), revision: identifier, contentLocale: z.literal('ru'), title: nonempty,
  catalog: z.strictObject({
    verifiedAt: checkedDate, sha256, sourceUrl: ownUrl, countryCount: positiveId,
  }),
  quests: z.array(questBookEntrySchema).min(1),
  endMatterPages:z.array(z.enum(['country-map','answers'])).min(1).max(2).optional(),
}).superRefine((book, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({code: 'custom', path, message});
  if (new Set(book.quests.map(quest => quest.id)).size !== book.quests.length ||
      new Set(book.quests.map(quest => quest.questId)).size !== book.quests.length) {
    issue(['quests'], 'Duplicate quest in the country volume');
  }
  if (book.quests.length > book.catalog.countryCount) issue(['catalog', 'countryCount'], 'Selected volume exceeds the published country catalogue');
  const catalogUrl = parseUrl(book.catalog.sourceUrl);
  if (catalogUrl && (catalogUrl.pathname !== '/api/quests/' || catalogUrl.searchParams.get('lang') !== 'ru')) {
    issue(['catalog', 'sourceUrl'], 'Catalogue must reference the Russian published quest API');
  }
});

export const questBookCatalogSchema = z.strictObject({
  schemaVersion: z.literal(1), verifiedAt: checkedDate, sourceUrl: ownUrl,
  totalPublished: positiveId, pageCount: positiveId,
  countryCounts: z.strictObject({BY: positiveId, PL: positiveId}),
  quests: z.array(z.strictObject({
    id: positiveId, questId: identifier, country, title: nonempty,
    city: nonempty, cityAlias: identifier, questUrl: ownUrl, pointCount: positiveId,
    durationMinutes: z.number().positive(), difficulty: nonempty, tags: z.array(nonempty), coverUri: ownUrl,
  })).min(1),
});

const selectionRow = z.strictObject({
  id: positiveId, questId: identifier, country,
  volume: z.union([z.literal(1), z.literal(2)]), status: z.enum(['included', 'reserved']), reason: nonempty,
  overview: z.string().trim().min(200).max(750).optional(), compactOverview: z.string().trim().min(120).max(300).optional(), sourceSha256: sha256.optional(),
});
export const questBookSelectionSchema = z.strictObject({
  schemaVersion: z.literal(1), catalogSha256: sha256, verifiedAt: checkedDate,
  volumes: z.array(z.strictObject({
    country, volume: z.union([z.literal(1), z.literal(2)]), status: z.enum(['included', 'reserved']),
    questIds: z.array(identifier).min(1),
  })).length(4),
  rows: z.array(selectionRow).min(1),
});
