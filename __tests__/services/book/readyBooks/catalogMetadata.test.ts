import {runNodeCli} from '../../../scripts/cli-test-utils';

it('pins deferred contents to every exact immutable metadata record without eager artifact data',()=>{
 const {bookContentsIndex}=require('@/scripts/books/copy-publication.cjs');
 const manifest=require('@/data/travelBooks/manifest.json');
 const contents=require('@/data/travelBooks/contents.json');
 expect(contents).toEqual(bookContentsIndex(manifest));
 expect(contents.books.reduce((count:number,book:{stops:unknown[]})=>count+book.stops.length,0)).toBe(manifest.books.reduce((count:number,book:{stops:unknown[]})=>count+book.stops.length,0));
 expect(contents.books[0]).not.toHaveProperty('artifacts');
 expect(contents.books[0].stops[0]).not.toHaveProperty('image');
 const changed=JSON.parse(JSON.stringify(manifest));
 changed.books[0].stops[0].title='Different contents';
 expect(()=>bookContentsIndex(changed)).toThrow('metadata differs');
});

it('keeps thematic families in thin metadata and indexes only verified exact target points',()=>{
 const result=runNodeCli(['--input-type=module','-e',`
  import assert from 'node:assert/strict';
  import {thinBookCatalogue,relatedBookIndex} from './scripts/books/catalog-metadata.mjs';
  const book={kind:'places',id:'mountain-diary',slug:'mountains',country:'PL',title:'Mountains',revision:'test.1',sourceContract:'thematic-v1',seriesId:'mountains-pl',theme:'mountains',stops:[
   {sourceTravelId:101,thematic:{sourceRelation:'exact-place',sourcePointId:11,mapTarget:{kind:'published-point',pointId:11}}},
   {sourceTravelId:102,thematic:{sourceRelation:'area-context',sourcePointId:22,mapTarget:{kind:'verified-coordinate',lat:49,lng:22}}},
   {sourceTravelId:103,pointId:33,thematic:{sourceRelation:'approach-context',sourcePointId:33,mapTarget:{kind:'published-point',pointId:44}}}
  ]};
  const manifest={books:[book],bookMetadata:[{bookId:book.id,revision:book.revision}]};
  const thin=thinBookCatalogue(manifest).books[0], related=relatedBookIndex(manifest)[0];
  assert.equal(thin.sourceContract,'thematic-v1');assert.equal(thin.seriesId,'mountains-pl');assert.equal(thin.theme,'mountains');
  assert.deepEqual(related.pointIds,[11]);assert.deepEqual(related.sourceTravelIds,[101,102,103]);
  console.log('thematic metadata and exact target index passed');
 `]);
 expect(result.status).toBe(0);expect(result.stdout).toContain('thematic metadata and exact target index passed');
});

it('adds typed lazy metadata without rewriting six accepted records or treating book JSON as providers',()=>{
 const result=runNodeCli(['--input-type=module','-e',`
  import assert from 'node:assert/strict';import {readFile,mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';
  import {stageBookMetadata,thinBookCatalogue} from './scripts/books/catalog-metadata.mjs';
  const {collectAssets,checkContent}=createRequire(import.meta.url)('./scripts/books/copy-publication.cjs');
  const root=await mkdtemp(path.resolve('.codex-temp/quest-metadata-fixture-'));
  try{
   const prior=JSON.parse(await readFile('data/travelBooks/releases/b356fc6cad239e0073732ce3c1bbd672c54d0edd3f2153181ac5e72c8a32df0f.json','utf8')),before=JSON.stringify(prior.books);
   const result=await stageBookMetadata(prior,root),summary=thinBookCatalogue(result);
   assert.equal(JSON.stringify(result.books),before);assert.equal(result.books.length,6);assert.equal(summary.books.length,6);
   assert.equal(summary.books.filter(b=>b.visualStyle==='fantasy').length,2);assert.equal(summary.books.filter(b=>b.visualStyle==='photo').length,2);
   const old=collectAssets([prior]),current=collectAssets([result]),metadata=current.filter(a=>a.kind==='book-metadata');
   assert.equal(current.length,old.length+6);assert.equal(metadata.length,6);
   assert.deepEqual(current.filter(a=>a.kind!=='book-metadata'),old);
   for(const asset of metadata){const bytes=await readFile(path.join(root,asset.relative));checkContent(asset,bytes);assert.deepEqual(JSON.parse(bytes),prior.books.find(b=>b.id===asset.bookId));assert.throws(()=>checkContent({...asset,bookId:'swapped'},bytes));}
   assert.throws(()=>collectAssets([{...result,bookMetadata:result.bookMetadata.map((a,i)=>i===0?{...a,kind:'print-directory'}:a)}]));
   assert.throws(()=>collectAssets([{...result,bookMetadata:result.bookMetadata.slice(1)}]));
   assert.throws(()=>collectAssets([{...result,books:result.books.map((b,i)=>i===0?{...b,title:'Different same-identity book'}:b)}]),/exact raw published record/);
   await stageBookMetadata(prior,root);
   await assert.rejects(()=>stageBookMetadata({...prior,books:prior.books.map((b,i)=>i===0?{...b,title:'Changed raw bytes'}:b)},root),/Immutable book metadata/);
   console.log(JSON.stringify({oldBooksPreserved:6,oldResources:old.length,newTypedMetadata:metadata.length}));
  }finally{await rm(root,{recursive:true,force:true});}
 `]);
 expect(result.status).toBe(0);expect(JSON.parse(result.stdout)).toMatchObject({oldBooksPreserved:6,newTypedMetadata:6});
});
