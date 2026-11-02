import type {z} from 'zod';
import type {editorialBookDraftSchema, editorialStop, thematicEditorialBookDraftSchema, thematicEditorialStop, placeBookDraftSchema} from '../data/travelBooks/schema/editorial.ts';
import type {bookArtifactSchema, readyBookSchema} from '../data/travelBooks/schema/manifest.ts';
import type {printProfileSchema} from '../data/travelBooks/schema/profiles.ts';

export type EditorialBookDraft = z.infer<typeof editorialBookDraftSchema>;
export type EditorialStop = z.infer<typeof editorialStop>;
export type ReadyBook = z.infer<typeof readyBookSchema>;
export type BookStop = ReadyBook['stops'][number];
export type BookArtifact = z.infer<typeof bookArtifactSchema>;
export type PrintProfile = z.infer<typeof printProfileSchema>;
export type Preview = ReadyBook['preview'][number];
export type {BookSeries, SeriesKit} from '../data/travelBooks/schema/series.ts';

export type ThematicEditorialBookDraft = z.infer<typeof thematicEditorialBookDraftSchema>;
export type ThematicEditorialStop = z.infer<typeof thematicEditorialStop>;
export type PlaceBookDraft = z.infer<typeof placeBookDraftSchema>;
export type PlaceBookStop = EditorialStop | ThematicEditorialStop;
export type {ThematicEvidence} from '../data/travelBooks/schema/thematic.ts';
