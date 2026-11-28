import {z} from 'zod';
import {identifier, nonempty} from './primitives';
import {sha256} from './manifest';

export const museumPassportFiles = {
  read: ['read.pdf', 'application/pdf'], booklet: ['booklet-a3.pdf', 'application/pdf'],
  wrapCover: ['cover-a3.pdf', 'application/pdf'], stickers: ['stickers-a4.pdf', 'application/pdf'],
  cover: ['cover.webp', 'image/webp'], preview: ['preview.webp', 'image/webp'],
} as const;
const asset = (mime: 'application/pdf' | 'image/webp') => z.strictObject({
  uri: nonempty, mime: z.literal(mime), bytes: z.number().int().positive().max(mime === 'image/webp' ? 2 * 1024 * 1024 : 100 * 1024 * 1024), sha256,
});

/** A4 reading pages and the already imposed A3 booklet are different files. */
export const museumPassportSchema = z.strictObject({
  id: identifier, slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), revision: identifier,
  title: nonempty, summary: nonempty, country: z.literal('PL'), contentLocale: z.literal('ru'),
  quality: z.strictObject({printReady: z.literal(false), minIllustrationPpi: z.number().positive()}),
  museumCount: z.number().int().positive(), logicalPageCount: z.number().int().min(4).multipleOf(4),
  bookletPageCount: z.number().int().positive(), stickersPageCount: z.number().int().positive(),
  museums: z.array(z.strictObject({number: z.number().int().positive(), title: nonempty, page: z.number().int().positive()})).min(1),
  read: asset('application/pdf'), booklet: asset('application/pdf'), wrapCover: asset('application/pdf'),
  stickers: asset('application/pdf'), cover: asset('image/webp'), preview: asset('image/webp'),
}).superRefine((passport, ctx) => {
  const fail = (message: string) => ctx.addIssue({code: 'custom', message});
  const base = `https://metravel.by/travel-books/${passport.id}/${passport.revision}/`;
  for (const [key, [filename]] of Object.entries(museumPassportFiles)) {
    if (passport[key as keyof typeof museumPassportFiles].uri !== base + filename) fail('Museum passport assets must use its exact revision and purpose');
  }
  if (passport.bookletPageCount * 2 !== passport.logicalPageCount) fail('A3 booklet sides must match padded A4 reading pages');
  if (passport.museumCount !== passport.museums.length || passport.museums.some((museum, index) => museum.number !== index + 1 || museum.page > passport.logicalPageCount)) fail('Museum contents must match the numbered edition');
  if (new Set(passport.museums.map(museum => museum.title)).size !== passport.museums.length) fail('Museum contents cannot contain duplicate places');
});

export const stagedMuseumPassportsSchema = z.strictObject({schemaVersion: z.literal(1), passports: z.array(museumPassportSchema).min(1)});
export type MuseumPassport = z.infer<typeof museumPassportSchema>;
