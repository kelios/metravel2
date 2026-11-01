import type {z} from 'zod';
import type {countryQuestBookSchema, questBookEntrySchema} from '../data/travelBooks/schema/questBooks.ts';

export type CountryQuestBook = z.infer<typeof countryQuestBookSchema>;
export type QuestBookEntry = z.infer<typeof questBookEntrySchema>;
