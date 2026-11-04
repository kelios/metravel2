import manifest from '@/data/travelBooks/manifest.json';
import {miniDiarySchema} from '@/data/travelBooks/schema/miniDiaries';
import {publicationSchema} from '@/services/book/readyBooks/publication';

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
