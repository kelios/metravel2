import catalogue from '@/data/travelBooks/catalog.json';
import type {ReadyBookSummary} from './bookMetadata';

// The publication CLI validates the full payload before this pointer is committed.
// Full book data, preview arrays and PDF bytes are loaded only for the selected edition.
export const readyBooks=catalogue.books as ReadyBookSummary[];
export const findReadyBook=(slug:unknown)=>typeof slug==='string'?readyBooks.find(book=>book.slug===slug):undefined;
