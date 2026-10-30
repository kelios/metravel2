import {execFileSync} from 'node:child_process';

it('uses bounded content-derived edition keys without discarding parent or resource identity',()=>{
  const output=execFileSync(process.execPath,['--input-type=module','-e',`
    import {supplementedRevision} from './scripts/books/augment-publication.mjs';
    const book={id:'belarus-memory',revision:'2026-10-30.source.parent-chain',profiles:[]};
    const stickers=[{variant:'color',sha256:'1'.repeat(64)},{variant:'no-background',sha256:'2'.repeat(64)}];
    const first=supplementedRevision(book,'generator-one',stickers);
    console.log(JSON.stringify({first,repeated:supplementedRevision(structuredClone(book),'generator-one',stickers),
      variants:[supplementedRevision({...book,id:'poland-memory'},'generator-one',stickers),
      supplementedRevision({...book,revision:'another-parent'},'generator-one',stickers),
      supplementedRevision(book,'generator-two',stickers),
      supplementedRevision(book,'generator-one',[{...stickers[0],sha256:'3'.repeat(64)},stickers[1]])]}));
  `],{encoding:'utf8',cwd:process.cwd(),timeout:30000});
  const result=JSON.parse(output) as {first:string;repeated:string;variants:string[]};
  expect(result.first).toMatch(/^[a-f0-9]{32}$/);
  expect(result.repeated).toBe(result.first);
  expect(result.variants.every(key=>/^[a-f0-9]{32}$/.test(key)&&key!==result.first)).toBe(true);
  expect(new Set(result.variants).size).toBe(result.variants.length);
});

it('normalizes only output preview and cover URIs while preserving immutable resource identity',()=>{
  const output=execFileSync(process.execPath,['--input-type=module','-e',`
    import {normalizePreviewUris} from './scripts/books/augment-publication.mjs';
    const prefix='https://metravel.by/travel-books/book/r1/';
    const book={id:'book',revision:'r1',coverUri:prefix+'cover.webp',
      preview:[{pages:[{uri:prefix+'page.webp',bytes:99,sha256:'1'.repeat(64)},{uri:'/travel-books/book/r1/cover.webp',bytes:100,sha256:'2'.repeat(64)}]}],
      artifacts:[{uri:prefix+'read.pdf'}],printGuidePages:[{uri:prefix+'instructions.html'}],printDirectory:{uri:prefix+'providers.json'},coverPersonalization:{font:{uri:prefix+'font.ttf'},templates:[{uri:prefix+'template.pdf'}]}};
    const before=structuredClone(book);normalizePreviewUris(book);const once=JSON.stringify(book);normalizePreviewUris(book);
    console.log(JSON.stringify({before,after:book,idempotent:once===JSON.stringify(book)}));
  `],{encoding:'utf8',cwd:process.cwd(),timeout:30000});
  const {before,after,idempotent}=JSON.parse(output);
  expect(idempotent).toBe(true);
  expect(after.coverUri).toBe('/travel-books/book/r1/cover.webp');
  expect(after.preview[0].pages.map((page:{uri:string})=>page.uri)).toEqual(['/travel-books/book/r1/page.webp','/travel-books/book/r1/cover.webp']);
  const metadata=(page:{bytes:number;sha256:string})=>({bytes:page.bytes,sha256:page.sha256});
  expect(after.preview[0].pages.map(metadata)).toEqual(before.preview[0].pages.map(metadata));
  for(const field of ['artifacts','printGuidePages','printDirectory','coverPersonalization'])expect(after[field]).toEqual(before[field]);
  expect(after.revision).toBe(before.revision);
});
