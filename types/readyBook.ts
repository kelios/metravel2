import type {z} from 'zod';
import type {editorialBookDraftSchema, editorialStop} from '../data/travelBooks/schema/editorial.ts';
import type {bookArtifactSchema, readyBookSchema} from '../data/travelBooks/schema/manifest.ts';
import type {printProfileSchema} from '../data/travelBooks/schema/profiles.ts';

export type EditorialBookDraft = z.infer<typeof editorialBookDraftSchema>;
export type EditorialStop = z.infer<typeof editorialStop>;
export type ReadyBook = z.infer<typeof readyBookSchema>;
export type BookStop = ReadyBook['stops'][number];
export type BookArtifact = z.infer<typeof bookArtifactSchema>;
export type PrintProfile = z.infer<typeof printProfileSchema>;
export type Preview = ReadyBook['preview'][number];
