import {z} from 'zod';
import {identifier, nonempty} from './primitives';
import {sha256} from './manifest';

const asset = (mime: 'application/pdf' | 'image/webp') => z.strictObject({
  uri: nonempty,
  mime: z.literal(mime),
  bytes: z.number().int().positive().max(2 * 1024 * 1024),
  sha256,
});

export const miniDiarySchema = z.strictObject({
  id: identifier,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  revision: identifier,
  title: nonempty,
  summary: nonempty,
  country: z.literal('BY'),
  contentLocale: z.literal('ru'),
  pageCount: z.literal(6),
  stops: z.array(z.strictObject({
    title: nonempty,
    mapUrl: z.string().regex(/^https:\/\/metravel\.by\/map\?[^\s#]+$/),
    articleUrl: z.string().regex(/^https:\/\/metravel\.by\/(?:travels\/[a-z0-9-]+|quests\/[0-9]+\/[a-z0-9-]+)$/),
  })).length(3),
  pdf: asset('application/pdf'),
  cover: asset('image/webp'),
  preview: asset('image/webp'),
}).superRefine((diary, ctx) => {
  const base = `https://metravel.by/travel-books/${diary.id}/${diary.revision}/`;
  if (diary.pdf.uri !== base + 'read.pdf' || diary.cover.uri !== base + 'cover.webp' || diary.preview.uri !== base + 'preview.webp') {
    ctx.addIssue({code:'custom',message:'Mini diary assets must use its exact revision'});
  }
  if (new Set(diary.stops.map(stop => stop.mapUrl)).size !== 3) {
    ctx.addIssue({code:'custom',message:'Each mini diary trip needs its own map target'});
  }
});

export const stagedMiniDiariesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  diaries: z.array(miniDiarySchema).min(1),
});

export type MiniDiary = z.infer<typeof miniDiarySchema>;
