import manifest from '@/data/travelBooks/manifest.json';
import {miniDiarySchema} from '@/data/travelBooks/schema/miniDiaries';
import {publicationSchema} from '@/services/book/readyBooks/publication';
import discovery from '@/data/travelBooks/mini-diaries/discovery.json';
import {miniDiaries} from '@/services/book/readyBooks/catalog';
import {miniDiaryTrips,selectMiniDiaries} from '@/services/book/readyBooks/miniDiaries';

const {collectAssets} = require('@/scripts/books/copy-publication.cjs');
const base='https://metravel.by/travel-books/a5-diary/2026.1/';
const file=(name:string,mime:string)=>({uri:base+name,mime,bytes:200,sha256:'a'.repeat(64)});
const diary={
  id:'a5-diary',slug:'mini-diary',revision:'2026.1',title:'Дневник',summary:'Три поездки',
  country:'BY',contentLocale:'ru',pageCount:6,
  stops:[1,2,3].map(id=>({title:`Место ${id}`,mapUrl:`https://metravel.by/map?placeId=${id}`,articleUrl:`https://metravel.by/travels/place-${id}`})),
  pdf:file('read.pdf','application/pdf'),cover:file('cover.webp','image/webp'),preview:file('preview.webp','image/webp'),
};
const publishedDiaries='miniDiaries' in manifest&&Array.isArray(manifest.miniDiaries)?manifest.miniDiaries:[];
const withDiary=(entry:typeof diary)=>({...manifest,miniDiaries:[...publishedDiaries,entry]});

it('adds a compact diary to storage without changing any existing edition asset',()=>{
  const updated=withDiary(diary);
  expect(publicationSchema.safeParse(updated).success).toBe(true);
  const assets=collectAssets([updated]);
  const isNewDiary=(asset:{kind?:string;bookId?:string})=>asset.kind==='mini-diary'&&asset.bookId===diary.id;
  expect(assets.filter((asset:Parameters<typeof isNewDiary>[0])=>!isNewDiary(asset))).toEqual(collectAssets([manifest]));
  expect(assets.filter(isNewDiary).map((asset:{relative:string})=>asset.relative)).toEqual([
    'a5-diary/2026.1/read.pdf','a5-diary/2026.1/cover.webp','a5-diary/2026.1/preview.webp',
  ]);
});

it('rejects a preview from another revision and an overlapping book slug',()=>{
  const mixed={...diary,preview:{...diary.preview,uri:diary.preview.uri.replace('2026.1','2026.2')}};
  expect(miniDiarySchema.safeParse(mixed).success).toBe(false);
  expect(()=>collectAssets([withDiary(mixed)])).toThrow('Invalid mini diary resource');
  expect(publicationSchema.safeParse(withDiary({...diary,slug:manifest.books[0].slug})).success).toBe(false);
});

it('classifies every published diary without importing source prose into the catalogue',()=>{
  expect(discovery.diaries.map(entry=>entry.id).sort()).toEqual(miniDiaries.map(entry=>entry.id).sort());
  expect(new Set(discovery.diaries.map(entry=>entry.id)).size).toBe(discovery.diaries.length);
  expect(discovery.diaries.every(entry=>['mixed','castles','mountains','quests'].includes(entry.theme))).toBe(true);
  expect(selectMiniDiaries(miniDiaries,'all','all')).toEqual(miniDiaries);
  expect(selectMiniDiaries(miniDiaries,'castles','BY').map(entry=>entry.slug)).toEqual(['belarus-follow-the-towers']);
  expect(selectMiniDiaries(miniDiaries,'mixed','all').map(entry=>entry.slug)).toEqual(['belarus-by-the-water']);
  expect(selectMiniDiaries(miniDiaries,'castles','PL')).toEqual([]);
  expect(selectMiniDiaries(miniDiaries,'mountains','all')).toEqual([]);
});

it('connects the trip pages to the exact published PDF and distinguishes the Lubcha quest from articles',()=>{
  const towers=miniDiaries.find(entry=>entry.slug==='belarus-follow-the-towers')!;
  const trips=miniDiaryTrips(towers);
  expect(trips.map(trip=>trip.page)).toEqual([3,4,5]);
  expect(trips.map(trip=>trip.sourceKind)).toEqual(['quest','article','article']);
  for(const trip of trips)expect(trip.pdfUrl).toBe(`${towers.pdf.uri}#page=${trip.page}`);
});
