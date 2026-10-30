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
