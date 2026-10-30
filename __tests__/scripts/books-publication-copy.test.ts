import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const {collectAssets, copyPublication, ensureDirectory, writePublicationStagingMetadata} = require('../../scripts/books/copy-publication.cjs');
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const pdf = Buffer.from('%PDF-1.7 fixture');
const asset = (revision = 'r1') => ({uri: `https://metravel.by/travel-books/book/${revision}/read-body.pdf`, bytes: pdf.length, sha256: digest(pdf)});
const manifest = (revision = 'r1') => ({schemaVersion: 1, releaseId: 'travel-books-v1', books: [{artifacts: [asset(revision)], preview: []}]});

describe('ready-book publication build boundary', () => {
  let root: string;
  let buildDir: string;
  let cacheDir: string;
  beforeEach(async () => {
    await fs.mkdir('.codex-temp', {recursive: true});
    root = await fs.mkdtemp(path.resolve('.codex-temp/books-copy-test-'));
    buildDir = path.join(root, 'dist');
    cacheDir = path.join(root, 'cache');
    await fs.mkdir(path.join(root, 'data/travelBooks/releases'), {recursive: true});
    await fs.mkdir(buildDir);
    await fs.writeFile(path.join(root, 'data/travelBooks/manifest.json'), JSON.stringify(manifest()));
  });
  afterEach(async () => { await fs.rm(root, {recursive: true, force: true}); });

  it('rejects traversal and pre-existing nested symlinks before authoring directories', async () => {
    const outside = path.join(root, 'outside');
    await fs.mkdir(outside);
    await fs.symlink(outside, path.join(buildDir, 'book'));
    await expect(ensureDirectory(buildDir, 'book/new-revision')).rejects.toThrow('symlink');
    await expect(fs.stat(path.join(outside, 'new-revision'))).rejects.toThrow();
    await expect(ensureDirectory(buildDir, '../outside/new')).rejects.toThrow('escapes root');
    await expect(ensureDirectory(buildDir, outside)).rejects.toThrow('escapes root');
  });

  it.each(['manifest.json', 'related.json', 'supplement-acceptance.json'])('refuses an existing %s metadata symlink before writing the staging set', async name => {
    const outside = path.join(root, 'outside.json');
    await fs.writeFile(outside, 'preserve');
    await fs.symlink(outside, path.join(buildDir, name));
    await expect(writePublicationStagingMetadata(buildDir, {manifest:'manifest',related:'related',acceptance:'acceptance'})).rejects.toThrow('metadata already exists');
    expect(await fs.readFile(outside, 'utf8')).toBe('preserve');
    expect(await fs.readdir(buildDir)).toEqual([name]);
  });

  it('writes a complete new staging metadata set without overwriting it on retry', async () => {
    const metadata={manifest:'manifest',related:'related',acceptance:'acceptance'};
    await writePublicationStagingMetadata(buildDir,metadata);
    expect(await fs.readFile(path.join(buildDir,'manifest.json'),'utf8')).toBe(metadata.manifest);
    expect(await fs.readFile(path.join(buildDir,'related.json'),'utf8')).toBe(metadata.related);
    expect(await fs.readFile(path.join(buildDir,'supplement-acceptance.json'),'utf8')).toBe(metadata.acceptance);
    await expect(writePublicationStagingMetadata(buildDir,{...metadata,manifest:'different'})).rejects.toThrow('metadata already exists');
    expect(await fs.readFile(path.join(buildDir,'manifest.json'),'utf8')).toBe(metadata.manifest);
  });

  it('copies verified current and archived editions, with the current public pointer', async () => {
    const historical = JSON.stringify(manifest('old')) + '\n';
    await fs.writeFile(path.join(root, 'data/travelBooks/releases', digest(historical) + '.json'), historical);
    const download = jest.fn(async () => pdf);
    expect(await copyPublication({root, buildDir, cacheDir, download})).toEqual({files: 2, bytes: pdf.length * 2});
    expect(await fs.readFile(path.join(buildDir, 'travel-books/book/old/read-body.pdf'))).toEqual(pdf);
    expect(JSON.parse(await fs.readFile(path.join(buildDir, 'travel-books/manifest.json'), 'utf8'))).toEqual(manifest());
    // Subsequent builds use the verified local cache, including an old revision.
    download.mockClear();
    await copyPublication({root, buildDir, cacheDir, download});
    expect(download).not.toHaveBeenCalled();
  });


  it('copies declared HTML guides and canonical directory JSON with byte integrity',async()=>{
    const html=Buffer.from('<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body>r1</body></html>');
    const directory=Buffer.from(JSON.stringify({schemaVersion:1,providers:[{id:'fixture'}],cities:[{name:'fixture'}]}));
    const book={...manifest().books[0],id:'book',revision:'r1',printGuidePages:['pocket-150x100','album-a5'].map(profileId=>({profileId,uri:`https://metravel.by/travel-books/book/r1/${profileId}/instructions.html`,mime:'text/html',bytes:html.length,sha256:digest(html)})),printDirectory:{uri:'https://metravel.by/travel-books/book/r1/providers.json',mime:'application/json',bytes:directory.length,sha256:digest(directory)}};
    await fs.writeFile(path.join(root,'data/travelBooks/manifest.json'),JSON.stringify({schemaVersion:1,releaseId:'travel-books-v1',books:[book]}));
    const download=jest.fn(async(a:{relative:string})=>a.relative.endsWith('.html')?html:a.relative.endsWith('.json')?directory:pdf);
    const result=await copyPublication({root,buildDir,cacheDir,download});
    expect(result.files).toBe(4);
    expect(await fs.readFile(path.join(buildDir,'travel-books/book/r1/providers.json'))).toEqual(directory);
    expect(await fs.readFile(path.join(buildDir,'travel-books/book/r1/album-a5/instructions.html'))).toEqual(html);
  });

  it('rejects an empty HTML guide set paired with a directory', () => {
    const input={...manifest(),books:[{...manifest().books[0],id:'book',revision:'r1',printGuidePages:[],printDirectory:{...asset(),uri:'https://metravel.by/travel-books/book/r1/providers.json',mime:'application/json'}}]};
    expect(()=>collectAssets([input])).toThrow('Invalid print document resources');
  });

  it('refuses a bad download without activating a manifest', async () => {
    await expect(copyPublication({root, buildDir, cacheDir, download: async () => Buffer.from('wrong')})).rejects.toThrow('checksum');
    await expect(fs.stat(path.join(buildDir, 'travel-books/manifest.json'))).rejects.toMatchObject({code: 'ENOENT'});
  });

  it('refuses a corrupt cache rather than silently replacing an immutable asset', async () => {
    await fs.mkdir(path.join(cacheDir, 'book/r1'), {recursive: true});
    await fs.writeFile(path.join(cacheDir, 'book/r1/read-body.pdf'), 'bad');
    const download = jest.fn();
    await expect(copyPublication({root, buildDir, cacheDir, download})).rejects.toThrow('checksum');
    expect(download).not.toHaveBeenCalled();
  });

  it('refuses a symlink outside the cache', async () => {
    await fs.mkdir(cacheDir);
    await fs.symlink(root, path.join(cacheDir, 'book'));
    await expect(copyPublication({root, buildDir, cacheDir, download: async () => pdf})).rejects.toThrow('escapes root');
  });

  it.each(['https://other.invalid/a.pdf', 'https://metravel.by/travel-books/../a.pdf', 'https://metravel.by/travel-books/%2e%2e/a.pdf'])('rejects unsupported paths %s', uri => {
    const input = manifest();
    input.books[0].artifacts[0].uri = uri;
    expect(() => collectAssets([input])).toThrow();
  });

  it('rejects conflicting hashes for the same immutable URL', () => {
    const changed = manifest();
    changed.books[0].artifacts[0].sha256 = 'f'.repeat(64);
    expect(() => collectAssets([manifest(), changed])).toThrow('changed');
  });

  it('collects only declared, revision-bound PDF templates, full TTF and OFL resources',()=>{
    const descriptor={schemaVersion:1,font:{...asset(),uri:'https://metravel.by/travel-books/book/r1/fonts/MarckScript-Regular.ttf',mime:'font/ttf',license:{...asset(),uri:'https://metravel.by/travel-books/book/r1/fonts/OFL.txt',mime:'text/plain'}},templates:['pocket-150x100','album-a5'].flatMap(profileId=>['read','print-shop','home-rings'].map(mode=>({...asset(),uri:`https://metravel.by/travel-books/book/r1/${profileId}/template-${mode}-cover.pdf`,profileId,mode,mime:'application/pdf'})))};
    const input={schemaVersion:1,releaseId:'travel-books-v1',books:[{...manifest().books[0],id:'book',revision:'r1',coverPersonalization:descriptor}]};
    expect(collectAssets([input])).toHaveLength(9);
    for(const change of [(cover:typeof descriptor)=>{cover.font.uri='https://metravel.by/travel-books/book/other/font.ttf';},(cover:typeof descriptor)=>{cover.font.bytes=3*1024*1024;},(cover:typeof descriptor)=>{cover.font.license.uri=cover.font.license.uri.replace('OFL.txt','run.js');},(cover:typeof descriptor)=>{cover.templates.pop();}]){const invalid=structuredClone(input);change(invalid.books[0].coverPersonalization);expect(()=>collectAssets([invalid])).toThrow();}
  });

  it('refuses an internal cache symlink even when it resolves to valid bytes',async()=>{
    await fs.mkdir(path.join(cacheDir,'book/r1'),{recursive:true});
    const internal=path.join(cacheDir,'known.pdf');await fs.writeFile(internal,pdf);
    await fs.symlink(internal,path.join(cacheDir,'book/r1/read-body.pdf'));
    await expect(copyPublication({root,buildDir,cacheDir,download:async()=>pdf})).rejects.toThrow('symlink');
  });
});
