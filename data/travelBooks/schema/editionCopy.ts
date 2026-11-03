import {z} from 'zod';
import {checkedDate, identifier} from './primitives.ts';

/** UI locales a cover inscription is translated into; the printed text stays in the book locale (RU). */
export const COVER_TRANSLATION_LOCALES = ['be', 'uk', 'pl', 'en'] as const;
export type CoverTranslationLocale = typeof COVER_TRANSLATION_LOCALES[number];
export const COVER_MAX_CHARACTERS = 120;
export const MIN_EDITION_COVER_PRESETS = 2;
export const MAX_EDITION_COVER_PRESETS = 5;

/** Clichés the owner rejected for printed book copy (#2946, #2947). */
export const BANNED_BOOK_PHRASES = ['путешествие продолжается', 'целый мир', 'незабываем', 'уникальн', 'волшебн', 'атмосфер', 'в авторской поездке'] as const;
/** Latin tokens a Russian printed line may carry: Roman numerals and the brand/QR labels. */
const ALLOWED_LATIN = /^(?:[IVXLCDM]+|QR|MeTravel|metravel|by)$/;

export const latinWords = (value: string) => (value.match(/\p{Script=Latin}+/gu) ?? []).filter(word => !ALLOWED_LATIN.test(word));
export const bannedPhrases = (value: string) => BANNED_BOOK_PHRASES.filter(phrase => value.toLocaleLowerCase('ru').includes(phrase));

const normalized = (max: number) => z.string().min(1).refine(value => value === value.normalize('NFC').trim() && Array.from(value).length <= max, `Expected trimmed NFC text up to ${max} characters`);
const russianCopy = (max: number) => normalized(max)
  .refine(value => /\p{Script=Cyrillic}/u.test(value) && latinWords(value).length === 0, 'Russian printed copy must not contain Latin words')
  .refine(value => bannedPhrases(value).length === 0, 'Printed copy contains a rejected cliché');
export const coverInscription = normalized(COVER_MAX_CHARACTERS);

export const coverPresetSourceSchema = z.strictObject({
  id: identifier,
  text: z.strictObject({ru: russianCopy(COVER_MAX_CHARACTERS), be: coverInscription, uk: coverInscription, pl: coverInscription, en: coverInscription}),
});
export const editionCoverCopySchema = z.strictObject({
  defaultPresetId: identifier,
  presets: z.array(coverPresetSourceSchema).min(MIN_EDITION_COVER_PRESETS).max(MAX_EDITION_COVER_PRESETS),
}).superRefine((edition, ctx) => {
  if (new Set(edition.presets.map(preset => preset.id)).size !== edition.presets.length) ctx.addIssue({code: 'custom', message: 'Duplicate cover preset id'});
  if (!edition.presets.some(preset => preset.id === edition.defaultPresetId)) ctx.addIssue({code: 'custom', message: 'The default cover preset must belong to the edition'});
});

/** data/travelBooks/cover-copy.json: approved inscriptions per edition (book id). */
export const coverCopySourceSchema = z.strictObject({
  schemaVersion: z.literal(2), maxCharacters: z.literal(COVER_MAX_CHARACTERS), bookLocale: z.literal('ru'), approvedOn: checkedDate,
  editions: z.record(identifier, editionCoverCopySchema),
}).superRefine((copy, ctx) => {
  const ids = Object.values(copy.editions).flatMap(edition => edition.presets.map(preset => preset.id));
  if (new Set(ids).size !== ids.length) ctx.addIssue({code: 'custom', message: 'A cover preset id is reused by another edition'});
  const texts = Object.values(copy.editions).flatMap(edition => edition.presets.map(preset => preset.text.ru));
  if (new Set(texts).size !== texts.length) ctx.addIssue({code: 'custom', message: 'A cover inscription is shared by two editions'});
});

const block = (max: number) => z.strictObject({heading: russianCopy(40), text: russianCopy(max)});
/** Edition frame copy: title page, introduction, page guide, last page and inner/back covers. */
export const editionFrameCopySchema = z.strictObject({
  epigraph: russianCopy(COVER_MAX_CHARACTERS),
  subtitle: russianCopy(100),
  intro: block(320),
  usage: block(260),
  outro: block(140),
  endpaper: block(120),
  backCover: z.strictObject({heading: russianCopy(40), line: normalized(60)}),
});
export type EditionFrameCopy = z.infer<typeof editionFrameCopySchema>;

/** data/travelBooks/frame-copy.json: one voice per edition, never shared word for word. */
export const frameCopySourceSchema = z.strictObject({
  schemaVersion: z.literal(1), locale: z.literal('ru'), approvedOn: checkedDate,
  editions: z.record(identifier, editionFrameCopySchema),
}).superRefine((copy, ctx) => {
  const editions = Object.values(copy.editions);
  const slots: [string, (edition: EditionFrameCopy) => string][] = [
    ['epigraph', edition => edition.epigraph], ['subtitle', edition => edition.subtitle], ['intro', edition => edition.intro.text],
    ['usage', edition => edition.usage.text], ['outro', edition => edition.outro.text], ['endpaper', edition => edition.endpaper.text],
    ['backCover', edition => edition.backCover.heading],
  ];
  for (const [slot, read] of slots) {
    if (new Set(editions.map(read)).size !== editions.length) ctx.addIssue({code: 'custom', path: ['editions'], message: `Two editions share the same ${slot}`});
  }
});
