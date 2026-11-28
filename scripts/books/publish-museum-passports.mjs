#!/usr/bin/env node
// Publish exact locally checked passport bytes through the existing immutable storage gate.
import {createHash} from 'node:crypto';
import {lstat,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {build} from 'esbuild';
import {activatePublication} from './augment-publication.mjs';
import publicationFiles from './copy-publication.cjs';
import publicationRights from './publication-rights.cjs';
import storage from './storage.cjs';

const require=createRequire(import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse(await readFile(file,'utf8'));

async function saveStagedFile(file,payload){
  try{await writeFile(file,payload,{flag:'wx'});}
  catch(error){if(error.code!=='EEXIST')throw error;if(!(await lstat(file)).isFile()||await readFile(file,'utf8')!==payload)throw new Error('Staged publication changed; use a fresh staging directory');}
}

async function main([action,sourcePath='.codex-temp/books-krakow-museums/stage',...rest]){
  if(!['stage','activate'].includes(action)||rest.length)throw new Error('Use publish-museum-passports.mjs stage|activate [staging-directory]');
  const root=await realpath('.'),temp=await realpath('.codex-temp'),source=await realpath(sourcePath);
  if(!source.startsWith(temp+path.sep))throw new Error('Museum passports must be staged in .codex-temp');
  const bundle=await mkdtemp(path.join(temp,'museum-passport-schema-'));
  let schemas;
  try{
    await build({entryPoints:{publication:'services/book/readyBooks/publication.ts',staged:'data/travelBooks/schema/museumPassports.ts'},outdir:bundle,outExtension:{'.js':'.cjs'},bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
    schemas={...require(path.join(bundle,'publication.cjs')),...require(path.join(bundle,'staged.cjs'))};
  }finally{await rm(bundle,{recursive:true,force:true});}
  const {publicationSchema,stagedMuseumPassportsSchema,museumPassportFiles}=schemas;
  const currentBytes=await readFile('data/travelBooks/manifest.json'),current=JSON.parse(currentBytes);
  const {passports}=stagedMuseumPassportsSchema.parse(await json(path.join(source,'passports.json')));
  const report=await json(path.join(source,'validation.json'));
  if(report.schemaVersion!==1||!Array.isArray(report.passports)||report.passports.length!==passports.length)throw new Error('Validation must cover every staged museum passport');
  for(const passport of passports){
    const proofs=report.passports.filter(proof=>proof.id===passport.id&&proof.revision===passport.revision);
    const proof=proofs[0];
    if(proofs.length!==1||proof.digitalPass!==true||['logicalPageCount','bookletPageCount','stickersPageCount'].some(key=>proof[key]!==passport[key])||Object.keys(museumPassportFiles).some(key=>proof.assets?.[key]!==passport[key].sha256))throw new Error('Museum passport validation differs from the exact files: '+passport.slug);
  }
  const ids=new Set(passports.map(passport=>passport.id));
  const manifest={...current,museumPassports:[...(current.museumPassports??[]).filter(passport=>!ids.has(passport.id)),...passports]};
  publicationSchema.parse(manifest);
  const assets=publicationFiles.collectAssets([manifest]),priorAssets=publicationFiles.collectAssets([current]);
  const selected=assets.filter(asset=>asset.kind==='museum-passport'&&ids.has(asset.bookId));
  for(const asset of selected){
    const bytes=await storage.readPublicationFile(source,asset);
    if(bytes.length!==asset.bytes||hash(bytes)!==asset.sha256)throw new Error('Museum passport checksum differs: '+asset.relative);
    publicationFiles.checkContent(asset,bytes);
  }
  await publicationRights.assertFullPublicationRights({root,manifest,assets,source,prior:current,priorAssets});
  const file=path.join(source,'manifest.json'),payload=JSON.stringify(manifest,null,2)+'\n';
  if(action==='stage'){
    await saveStagedFile(file,payload);
    // The operator uploads exactly these editions, not every older catalogue object.
    await saveStagedFile(path.join(source,'upload-manifest.json'),JSON.stringify({schemaVersion:1,releaseId:'travel-books-v1',books:[],museumPassports:passports},null,2)+'\n');
  }else{
    if(!(await lstat(file)).isFile()||await readFile(file,'utf8')!==payload)throw new Error('Publication changed since staging; stage and verify again');
    await storage.verifyAssets(selected,{});
    await activatePublication({result:manifest,outputPath:source,cacheRoot:path.join(temp,'books-publication'),root,expectedManifestSha256:hash(currentBytes)});
  }
  console.log(JSON.stringify({action,file,passports:passports.map(passport=>passport.slug),assets:selected.length}));
}

main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
