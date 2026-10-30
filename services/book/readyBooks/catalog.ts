import manifest from '@/data/travelBooks/manifest.json';
import type {PublishedBook} from './publication';

// The publication CLI validates the full payload before this pointer is committed.
// Only metadata is bundled; PDF bytes and preview images stay in media storage.
export const readyBooks=manifest.books as PublishedBook[];
export const findReadyBook=(slug:unknown)=>typeof slug==='string'?readyBooks.find(book=>book.slug===slug):undefined;
