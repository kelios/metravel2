import catalogue from '@/data/travelBooks/catalog.json';
import type {ReadyBookSummary} from './bookMetadata';
import type {MiniDiary} from '@/data/travelBooks/schema/miniDiaries';

// The publication CLI validates the full payload before this pointer is committed.
// Full book data, preview arrays and PDF bytes are loaded only for the selected edition.
export const readyBooks=catalogue.books as ReadyBookSummary[];
export const miniDiaries=(catalogue as {miniDiaries?:MiniDiary[]}).miniDiaries??[];
export const findReadyBook=(slug:unknown)=>typeof slug==='string'?readyBooks.find(book=>book.slug===slug):undefined;
export const findMiniDiary=(slug:unknown)=>typeof slug==='string'?miniDiaries.find(diary=>diary.slug===slug):undefined;
