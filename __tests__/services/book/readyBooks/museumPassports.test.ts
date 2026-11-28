import manifest from '@/data/travelBooks/manifest.json';
import {museumPassportSchema} from '@/data/travelBooks/schema/museumPassports';
import {publicationSchema} from '@/services/book/readyBooks/publication';
import {selectMuseumPassports} from '@/services/book/readyBooks/museumPassports';
import {museumPassportFixture} from './museumPassportFixture';

const {collectAssets}=require('@/scripts/books/copy-publication.cjs');
const existingPassports=(manifest as {museumPassports?:unknown[]}).museumPassports??[];

it('adds a separate physical format without changing any existing edition resource',()=>{
  const passport=museumPassportFixture(),updated={...manifest,museumPassports:[...existingPassports,passport]};
  expect(publicationSchema.safeParse(updated).success).toBe(true);
  const assets=collectAssets([updated]);
  expect(assets.filter((asset:{bookId?:string})=>asset.bookId!==passport.id)).toEqual(collectAssets([manifest]));
  expect(assets.filter((asset:{bookId?:string})=>asset.bookId===passport.id).map((asset:{relative:string})=>asset.relative.split('/').pop())).toEqual(['read.pdf','booklet-a3.pdf','cover-a3.pdf','stickers-a4.pdf','cover.webp','preview.webp']);
  // The owner can upload only this edition, without querying every older object.
  const uploadManifest={schemaVersion:1,releaseId:'travel-books-v1',books:[],museumPassports:[passport]};
  expect(collectAssets([uploadManifest])).toEqual(assets.filter((asset:{bookId?:string})=>asset.bookId===passport.id));
});

it('rejects mixed revisions, false imposition, contents mismatch and cross-kind slug collisions',()=>{
  const passport=museumPassportFixture();
  expect(museumPassportSchema.safeParse({...passport,wrapCover:{...passport.wrapCover,uri:passport.wrapCover.uri.replace('test.1','test.2')}}).success).toBe(false);
  expect(()=>collectAssets([{...manifest,museumPassports:[{...passport,stickers:{...passport.stickers,mime:'image/webp'}}]}])).toThrow('Invalid museum passport resource');
  expect(museumPassportSchema.safeParse({...passport,bookletPageCount:3}).success).toBe(false);
  expect(museumPassportSchema.safeParse({...passport,museumCount:12}).success).toBe(false);
  expect(museumPassportSchema.safeParse({...passport,museums:passport.museums.map((museum,index)=>index===0?{...museum,number:2}:museum)}).success).toBe(false);
  expect(museumPassportSchema.safeParse({...passport,museums:passport.museums.map((museum,index)=>index===0?{...museum,page:9}:museum)}).success).toBe(false);
  expect(publicationSchema.safeParse({...manifest,museumPassports:[{...passport,slug:manifest.books[0].slug}]}).success).toBe(false);
  expect(()=>collectAssets([{...manifest,museumPassports:[{...passport,slug:manifest.books[0].slug}]}])).toThrow('identity overlaps');
});

it('combines the museum theme and country filters',()=>{
  const passports=[museumPassportFixture()];
  expect(selectMuseumPassports(passports,'all','all')).toEqual(passports);
  expect(selectMuseumPassports(passports,'museums','PL')).toEqual(passports);
  expect(selectMuseumPassports(passports,'museums','BY')).toEqual([]);
  expect(selectMuseumPassports(passports,'castles','PL')).toEqual([]);
});
