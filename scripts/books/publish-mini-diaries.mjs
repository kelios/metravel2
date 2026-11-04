#!/usr/bin/env node
// Validate the locally built pilots, then activate only after immutable S3 verification.
import {createHash} from 'node:crypto';
import {lstat,mkdtemp,readFile,realpath,rename,rm,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {build} from 'esbuild';
import {activatePublication} from './augment-publication.mjs';
import publicationFiles from './copy-publication.cjs';
import publicationRights from './publication-rights.cjs';
import storage from './storage.cjs';

const require = createRequire(import.meta.url);
const {collectAssets,checkContent} = publicationFiles;
const defaultSource = '.codex-temp/books-mini-diaries/publication';
const json = async file => JSON.parse(await readFile(file,'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function loadSchemas(temp) {
  const directory=await mkdtemp(path.join(temp,'mini-diary-schema-'));
  try {
    await build({entryPoints:{publication:'services/book/readyBooks/publication.ts',staged:'data/travelBooks/schema/miniDiaries.ts'},
      outdir:directory,outExtension:{'.js':'.cjs'},bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
    return {...require(path.join(directory,'publication.cjs')),...require(path.join(directory,'staged.cjs'))};
  } finally {
    await rm(directory,{recursive:true,force:true});
  }
}

async function saveStagedManifest(source,file,payload) {
  try {
    if (!(await lstat(file)).isFile()) throw new Error('Staged manifest must be a regular file');
    if (await readFile(file,'utf8')===payload) return;
  } catch(error) {
    if (error.code!=='ENOENT') throw error;
  }
  const directory=await mkdtemp(path.join(source,'.manifest-'));
  try {
    const pending=path.join(directory,'manifest.json');
    await writeFile(pending,payload,{flag:'wx'});
    await rename(pending,file);
  } finally {
    await rm(directory,{recursive:true,force:true});
  }
}

async function main([action, sourcePath=defaultSource, ...rest]) {
  if (!['stage','activate'].includes(action) || rest.length) {
    throw new Error('Use publish-mini-diaries.mjs stage|activate [staging-directory]');
  }
  const root = await realpath('.');
  const temp = await realpath('.codex-temp');
  const source = await realpath(sourcePath);
  if (!source.startsWith(temp+path.sep)) throw new Error('Mini diaries must be staged in .codex-temp');
  const {publicationSchema,stagedMiniDiariesSchema} = await loadSchemas(temp);
  const currentBytes = await readFile('data/travelBooks/manifest.json');
  const current = JSON.parse(currentBytes);
  const {diaries} = stagedMiniDiariesSchema.parse(await json(path.join(source,'mini-diaries.json')));
  const report = await json(path.join(source,'validation.json'));
  if (report.schemaVersion !== 1 || !Array.isArray(report.diaries) || report.diaries.length !== diaries.length) {
    throw new Error('Mini diary validation report must cover every staged diary');
  }
  for (const diary of diaries) {
    const proof = report.diaries.find(entry => entry.id===diary.id && entry.revision===diary.revision);
    if (proof?.digitalPass!==true || proof.pageCount!==diary.pageCount || proof.pdfSha256!==diary.pdf.sha256 ||
      proof.coverSha256!==diary.cover.sha256 || proof.previewSha256!==diary.preview.sha256) {
      throw new Error('Mini diary validation differs from its PDF and previews: '+diary.slug);
    }
  }
  const ids = new Set(diaries.map(diary => diary.id));
  const miniDiaries = [...(current.miniDiaries??[]).filter(diary=>!ids.has(diary.id)),...diaries];
  const manifest = {...current,miniDiaries};
  publicationSchema.parse(manifest);
  const assets = collectAssets([manifest]);
  const priorAssets = collectAssets([current]);
  const selectedAssets = assets.filter(asset => asset.kind==='mini-diary' && ids.has(asset.bookId));
  for (const asset of selectedAssets) {
    const bytes = await storage.readPublicationFile(source,asset);
    if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) throw new Error('Mini diary checksum differs: '+asset.relative);
    checkContent(asset,bytes);
  }
  await publicationRights.assertFullPublicationRights({root,manifest,assets,source,prior:current,priorAssets});
  const file = path.join(source,'manifest.json');
  const payload = JSON.stringify(manifest,null,2)+'\n';
  if (action==='stage') {
    await saveStagedManifest(source,file,payload);
  } else {
    if (!(await lstat(file)).isFile() || await readFile(file,'utf8') !== payload) throw new Error('Publication changed since staging; stage and verify the manifest again');
    await storage.verifyAssets(selectedAssets,{});
    await activatePublication({result:manifest,outputPath:source,cacheRoot:path.join(temp,'books-publication'),root,
      expectedManifestSha256:sha256(currentBytes)});
  }
  console.log(JSON.stringify({action,file,diaries:diaries.map(diary=>diary.slug),assets:selectedAssets.length}));
}

main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
