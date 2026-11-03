import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const {collectAssets, copyPublication, ensureDirectory, writePublicationStagingMetadata} = require('../../scripts/books/copy-publication.cjs');
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const pdf = Buffer.from('%PDF-1.7 fixture');
const webp = Buffer.from('RIFF0000WEBPfixture');
const asset = (revision = 'r1') => ({uri: `https://metravel.by/travel-books/book/${revision}/read-body.pdf`, bytes: pdf.length, sha256: digest(pdf)});
const manifest = (revision = 'r1') => ({schemaVersion: 1, releaseId: 'travel-books-v1', books: [{artifacts: [asset(revision)], preview: []}]});
const previewManifest = (relative = false) => {
  const uri=(relative?'':'https://metravel.by')+'/travel-books/book/r1/preview-cover-1.webp';
  return {schemaVersion:1,releaseId:'travel-books-v1',books:[{id:'book',revision:'r1',coverUri:uri,artifacts:[asset()],preview:[{pages:[{uri,bytes:webp.length,sha256:digest(webp)}]}]}]};
};

describe('ready-book publication build boundary', () => {
  let root: string;
  let buildDir: string;
  beforeEach(async () => {
    await fs.mkdir('.codex-temp', {recursive: true});
    root = await fs.mkdtemp(path.resolve('.codex-temp/books-copy-test-'));
    buildDir = path.join(root, 'dist');
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

  // Book files live in S3 (#2971): the build confirms the files of the current
  // editions in storage and carries only the current public pointer.
  // Snapshots stay checked rollback metadata but hold no files: storage keeps only the current editions.
  it('confirms only the current editions in storage and writes only the pointer', async () => {
    const historical = JSON.stringify(manifest('old')) + '\n';
    await fs.writeFile(path.join(root, 'data/travelBooks/releases', digest(historical) + '.json'), historical);
    const verify = jest.fn(async () => undefined);
    expect(await copyPublication({root, buildDir, verify})).toEqual({files: 1, bytes: pdf.length});
    expect(verify.mock.calls[0][0].map((a: {relative: string}) => a.relative)).toEqual(['book/r1/read-body.pdf']);
    expect(await fs.readdir(path.join(buildDir, 'travel-books'))).toEqual(['manifest.json']);
    expect(JSON.parse(await fs.readFile(path.join(buildDir, 'travel-books/manifest.json'), 'utf8'))).toEqual(manifest());
  });

  it('refuses a stale contents index before asking storage',async()=>{
    const publication=require('@/data/travelBooks/manifest.json');
    const contents=JSON.parse(JSON.stringify(require('@/data/travelBooks/contents.json')));
    contents.books[0].stops[0].page+=1;
    await fs.writeFile(path.join(root,'data/travelBooks/manifest.json'),JSON.stringify(publication));
    await fs.writeFile(path.join(root,'data/travelBooks/contents.json'),JSON.stringify(contents));
    const verify=jest.fn();
    await expect(copyPublication({root,buildDir,verify})).rejects.toThrow('contents index differs');
    expect(verify).not.toHaveBeenCalled();
    expect(await fs.readdir(buildDir)).toEqual([]);
  });

  it('refuses a snapshot whose bytes differ from its name', async () => {
    await fs.writeFile(path.join(root, 'data/travelBooks/releases', 'a'.repeat(64) + '.json'), JSON.stringify(manifest('old')));
    await expect(copyPublication({root, buildDir, verify: jest.fn()})).rejects.toThrow('snapshot checksum mismatch');
  });

  it('builds no pointer when storage lacks a file', async () => {
    const verify = jest.fn(async () => { throw new Error('Book storage lacks 1 of 1 files'); });
    await expect(copyPublication({root, buildDir, verify})).rejects.toThrow('Book storage lacks');
    expect(await fs.readdir(buildDir)).toEqual([]);
  });

  it('stops the build when anything but the pointer reaches the release books', async () => {
    await fs.mkdir(path.join(buildDir, 'travel-books/book/r1'), {recursive: true});
    await fs.writeFile(path.join(buildDir, 'travel-books/book/r1/read-body.pdf'), pdf);
    await expect(copyPublication({root, buildDir, verify: async () => undefined})).rejects.toThrow('only travel-books/manifest.json; book files belong in storage: book');
  });

  it('refuses a symlinked release books directory', async () => {
    const outside = path.join(root, 'outside');
    await fs.mkdir(outside);
    await fs.symlink(outside, path.join(buildDir, 'travel-books'));
    await expect(copyPublication({root, buildDir, verify: async () => undefined})).rejects.toThrow('symlink');
    expect(await fs.readdir(outside)).toEqual([]);
  });

  it('has nothing to confirm before the first publication', async () => {
    await fs.rm(path.join(root, 'data/travelBooks/manifest.json'));
    const verify = jest.fn();
    expect(await copyPublication({root, buildDir, verify})).toEqual({files: 0, bytes: 0});
    expect(verify).not.toHaveBeenCalled();
  });

  it('deduplicates legacy absolute and root-relative previews under one own-origin URL',()=>{
    const assets=collectAssets([previewManifest(true),previewManifest()]);
    expect(assets.map((a:{uri:string;relative:string})=>[a.uri,a.relative])).toEqual([
      ['https://metravel.by/travel-books/book/r1/read-body.pdf','book/r1/read-body.pdf'],
      ['https://metravel.by/travel-books/book/r1/preview-cover-1.webp','book/r1/preview-cover-1.webp'],
    ]);
    const conflicting=previewManifest(true);
    conflicting.books[0].preview[0].pages[0].sha256='f'.repeat(64);
    expect(()=>collectAssets([previewManifest(),conflicting])).toThrow('changed');
  });

  it.each([
    '//metravel.by/travel-books/book/r1/preview.webp',
    'https://foreign.invalid/travel-books/book/r1/preview.webp',
    '/travel-books/other/r1/preview.webp',
    '/travel-books/book/other/preview.webp',
    '/travel-books/book/r1/../preview.webp',
    '/travel-books/book/r1/%2e%2e/preview.webp',
    '/travel-books/book/r1/./preview.webp',
    '/travel-books/book/r1/preview.webp?query=1',
    '/travel-books/book/r1/preview.pdf',
  ])('rejects unsupported root-relative preview or cover path %s',uri=>{
    const input=previewManifest(true);
    input.books[0].preview[0].pages[0].uri=uri;
    expect(()=>collectAssets([input])).toThrow();
    const cover=previewManifest(true);cover.books[0].coverUri=uri;
    expect(()=>collectAssets([cover])).toThrow();
  });

  it('keeps root-relative support exclusive to preview images',()=>{
    const input=previewManifest(true);
    input.books[0].artifacts[0].uri='/travel-books/book/r1/read-body.pdf';
    expect(()=>collectAssets([input])).toThrow('Invalid publication asset URI');
  });


  it('collects declared HTML guides and canonical directory JSON with their identity',()=>{
    const html=Buffer.from('<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body>r1</body></html>');
    const directory=Buffer.from(JSON.stringify({schemaVersion:1,providers:[{id:'fixture'}],cities:[{name:'fixture'}]}));
    const book={...manifest().books[0],id:'book',revision:'r1',printGuidePages:['pocket-150x100','album-a5'].map(profileId=>({profileId,uri:`https://metravel.by/travel-books/book/r1/${profileId}/instructions.html`,mime:'text/html',bytes:html.length,sha256:digest(html)})),printDirectory:{uri:'https://metravel.by/travel-books/book/r1/providers.json',mime:'application/json',bytes:directory.length,sha256:digest(directory)}};
    const assets=collectAssets([{schemaVersion:1,releaseId:'travel-books-v1',books:[book]}]);
    expect(assets).toHaveLength(4);
    expect(assets.find((a:{relative:string})=>a.relative==='book/r1/album-a5/instructions.html')).toMatchObject({kind:'print-guide',bookId:'book',revision:'r1'});
    expect(assets.find((a:{relative:string})=>a.relative==='book/r1/providers.json')).toMatchObject({kind:'print-directory'});
  });

  it('rejects an empty HTML guide set paired with a directory', () => {
    const input={...manifest(),books:[{...manifest().books[0],id:'book',revision:'r1',printGuidePages:[],printDirectory:{...asset(),uri:'https://metravel.by/travel-books/book/r1/providers.json',mime:'application/json'}}]};
    expect(()=>collectAssets([input])).toThrow('Invalid print document resources');
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
    // Per-edition inscriptions (#2946) publish the same resources; unknown descriptor versions stay rejected.
    const edition=structuredClone(input);(edition.books[0].coverPersonalization as {schemaVersion:number}).schemaVersion=2;
    expect(collectAssets([edition])).toHaveLength(9);
    const unknown=structuredClone(input);(unknown.books[0].coverPersonalization as {schemaVersion:number}).schemaVersion=3;
    expect(()=>collectAssets([unknown])).toThrow('Invalid cover personalization resources');
    for(const change of [(cover:typeof descriptor)=>{cover.font.uri='https://metravel.by/travel-books/book/other/font.ttf';},(cover:typeof descriptor)=>{cover.font.bytes=3*1024*1024;},(cover:typeof descriptor)=>{cover.font.license.uri=cover.font.license.uri.replace('OFL.txt','run.js');},(cover:typeof descriptor)=>{cover.templates.pop();}]){const invalid=structuredClone(input);change(invalid.books[0].coverPersonalization);expect(()=>collectAssets([invalid])).toThrow();}
  });
});
