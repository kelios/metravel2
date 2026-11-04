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

it('adds a compact diary to storage without changing any full edition asset',()=>{
  const updated={...manifest,miniDiaries:[diary]};
  expect(publicationSchema.safeParse(updated).success).toBe(true);
  const assets=collectAssets([updated]);
  expect(assets.filter((asset:{kind:string})=>asset.kind!=='mini-diary')).toEqual(collectAssets([manifest]));
  expect(assets.filter((asset:{kind:string})=>asset.kind==='mini-diary').map((asset:{relative:string})=>asset.relative)).toEqual([
    'a5-diary/2026.1/read.pdf','a5-diary/2026.1/cover.webp','a5-diary/2026.1/preview.webp',
  ]);
});

it('rejects a preview from another revision and an overlapping book slug',()=>{
  const mixed={...diary,preview:{...diary.preview,uri:diary.preview.uri.replace('2026.1','2026.2')}};
  expect(miniDiarySchema.safeParse(mixed).success).toBe(false);
  expect(()=>collectAssets([{...manifest,miniDiaries:[mixed]}])).toThrow('Invalid mini diary resource');
  expect(publicationSchema.safeParse({...manifest,miniDiaries:[{...diary,slug:manifest.books[0].slug}]}).success).toBe(false);
});
