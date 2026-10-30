#!/usr/bin/env node
// Add D2/D3 to an accepted publication without re-rendering its unchanged book PDFs.
import {readFile,writeFile,mkdir,realpath,stat,rm,lstat,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {loadSelectedBook} from './source-ready-book.mjs';
import {buildStickerArtifacts} from './build-stickers.mjs';
import {renderPrintGuideHtml} from './render-print-guide-html.mjs';
import publicationFiles from './copy-publication.cjs';
const {ensureDirectory,collectAssets,checkContent,writePublicationStagingMetadata,publicationAssetLocation}=publicationFiles;

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const base='https://metravel.by/travel-books/';
const resources=book=>[...(book.printGuidePages??[]),...(book.printDirectory?[book.printDirectory]:[]),...book.artifacts,...book.preview.flatMap(group=>group.pages),...(book.coverPersonalization?[book.coverPersonalization.font,book.coverPersonalization.font.license,...book.coverPersonalization.templates]:[])];
export function supplementedRevision(book,generatorHash,stickers){
  return hash(JSON.stringify({book,generatorHash,stickers:stickers.map(({variant,sha256})=>({variant,sha256}))})).slice(0,32);
}
export function normalizePreviewUris(book){
  for(const page of book.preview.flatMap(group=>group.pages))page.uri='/travel-books/'+publicationAssetLocation(page.uri,book).relative;
  book.coverUri='/travel-books/'+publicationAssetLocation(book.coverUri,book).relative;
}
async function verifiedResource(root,entry,previewBook){
  const {relative}=publicationAssetLocation(entry.uri,previewBook);
  let current=root;for(const part of relative.split('/')){current=path.join(current,part);if((await lstat(current)).isSymbolicLink())throw new Error('Publication resource is a symlink');}
  const file=await realpath(path.join(root,relative));
  if(!file.startsWith(root+path.sep))throw new Error('Source escapes publication cache');
  const bytes=await readFile(file);
  if(bytes.length!==entry.bytes||hash(bytes)!==entry.sha256)throw new Error('Resource differs from accepted manifest: '+relative);
  return bytes;
}
export async function augmentPublication({manifest='data/travelBooks/manifest.json',production='.codex-temp/books-next/production',cache='.codex-temp/books-publication',output='.codex-temp/books-d/publication',python='.codex-temp/books-production/venv/bin/python',activate=false}={}){
  const outputPath=path.resolve(output),scratch=await realpath('.codex-temp');
  if(!outputPath.startsWith(scratch+path.sep))throw new Error('Output must remain in .codex-temp');
  await ensureDirectory(scratch,path.relative(scratch,outputPath));
  if(!(await realpath(outputPath)).startsWith(scratch+path.sep))throw new Error('Output symlink escapes scratch');
  const cacheRoot=await realpath(cache);
  const bundle=path.join(outputPath,'guide-compiler.cjs');
  await rm(bundle,{force:true});
  await build({entryPoints:['scripts/books/print-guide-entry.ts'],outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
  const providersBundle=path.join(outputPath,'providers-validator.cjs');
  await rm(providersBundle,{force:true});
  await build({entryPoints:['data/travelBooks/schema/providers.ts'],outfile:providersBundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
  const schemaBundle=path.join(outputPath,'publication-validator.cjs');
  await rm(schemaBundle,{force:true});
  await build({entryPoints:['services/book/readyBooks/publication.ts'],outfile:schemaBundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
  const require=createRequire(import.meta.url);
  const {buildPrintGuide}=require(bundle),{publicationSchema}=require(schemaBundle);
  const {printDirectorySchema}=require(providersBundle);
  const providerBytes=Buffer.from(JSON.stringify(printDirectorySchema.parse(await json('data/travelBooks/providers.json')),null,2)+'\n');
  const prior=publicationSchema.parse(await json(manifest));
  const index=await json(path.join(production,'production-index.json'));
  const codePaths=['scripts/books/augment-publication.mjs','scripts/books/render-print-guide.py','scripts/books/render-print-guide-html.mjs',bundle,'docs/design/travel-memory-books-v1/assets/fonts/NotoSans-Regular.ttf'];
  const toolVersions=spawnSync(python,['-c','import reportlab,pypdf; print(reportlab.Version,pypdf.__version__)'],{encoding:'utf8',timeout:10000});
  if(toolVersions.status!==0)throw new Error('PDF authoring dependencies unavailable');
  const generatorHash=hash(Buffer.concat([...await Promise.all(codePaths.map(file=>readFile(file))),Buffer.from(toolVersions.stdout),providerBytes]));
  const books=[];
  for(const old of prior.books){
    if(old.printDirectory||old.printGuidePages||old.artifacts.some(a=>['stickers','instructions','print-passport'].includes(a.purpose)))throw new Error('Input already contains supplements; select the accepted base manifest');
    const source=await loadSelectedBook(old.country.toLowerCase());
    const productionBook=index.books.find(b=>b.bookId===old.id);
    if(!productionBook||JSON.stringify(source.book.stops.map(s=>s.id))!==JSON.stringify(old.stops.map(s=>s.id)))throw new Error('Published selection differs from source');
    // Reuse the accepted exact reading PDF as the control for source/index identity.
    for(const profile of productionBook.profiles){
      for(const artifact of profile.artifacts){
        const accepted=old.artifacts.find(a=>a.profileId===profile.profile.id&&a.purpose===artifact.purpose&&a.component===artifact.component);
        if(!accepted||accepted.sha256!==artifact.sha256||accepted.bytes!==artifact.bytes)throw new Error('Production index differs from accepted core files');
      }
    }
    await ensureDirectory(outputPath,path.join('generated',old.id));
    const generated=await buildStickerArtifacts({book:productionBook,source,output:path.join(outputPath,'generated',old.id),python});
    const revision=supplementedRevision(old,generatorHash,generated.artifacts);
    const relative=old.id+'/'+revision;
    const directory=path.join(outputPath,relative);
    try{await stat(directory);throw new Error('Immutable revision already staged');}catch(error){if(error.code!=='ENOENT')throw error;}
    await ensureDirectory(outputPath,old.id);
    await mkdir(directory);
    const book=structuredClone(old);
    book.revision=revision;
    book.printGuidePages=[];
    book.printDirectory={uri:new URL(relative+'/providers.json',base).href,mime:'application/json',bytes:providerBytes.length,sha256:hash(providerBytes)};
    await writeFile(path.join(directory,'providers.json'),providerBytes,{flag:'wx'});
    const rewrite=uri=>uri.replace('/'+old.revision+'/','/'+revision+'/');
    const previewPages=book.preview.flatMap(group=>group.pages);
    for(const entry of [...book.artifacts,...previewPages,...(book.coverPersonalization?[book.coverPersonalization.font,book.coverPersonalization.font.license,...book.coverPersonalization.templates]:[])]){
      const previewEntry=previewPages.includes(entry);
      const bytes=await verifiedResource(cacheRoot,entry,previewEntry?old:undefined);
      const uri=rewrite(entry.uri);
      if(uri===entry.uri)throw new Error('Source resource belongs to another revision');
      entry.uri=uri;
      const target=path.join(outputPath,publicationAssetLocation(uri,previewEntry?book:undefined).relative);
      await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});
    }
    book.coverUri=rewrite(book.coverUri);
    book.artifacts.forEach(a=>a.revision=revision);book.preview.forEach(p=>p.revision=revision);
    const add=async(file,profileId,purpose,component,variant)=>{
      const bytes=await readFile(file),id=[profileId,purpose,component,variant].filter(Boolean).join('.');
      const filename=profileId+'/'+purpose+'-'+component+(variant?'-'+variant:'')+'.pdf';
      await mkdir(path.join(directory,profileId),{recursive:true});
      await writeFile(path.join(directory,filename),bytes,{flag:'wx'});
      const inspected=spawnSync(python,['-c','from pypdf import PdfReader; import sys; r=PdfReader(sys.argv[1]); assert all(abs(float(p.mediabox.width)*25.4/72-210)<.1 and abs(float(p.mediabox.height)*25.4/72-297)<.1 for p in r.pages); print(len(r.pages))',file],{encoding:'utf8',timeout:30000});
      if(inspected.status!==0)throw new Error(inspected.stderr||'Supplement geometry inspection failed');
      const result={id,revision,profileId,purpose,component,outputPageMm:{width:210,height:297},...(variant?{variant}:{}),uri:new URL(relative+'/'+filename,base).href,mime:'application/pdf',sha256:hash(bytes),bytes:bytes.length,pageCount:Number(inspected.stdout.trim())};
      book.artifacts.push(result);return result;
    };
    for(const profile of book.profiles)for(const sticker of generated.artifacts)await add(sticker.path,profile.id,'stickers','stickers',sticker.variant);
    for(const profile of book.profiles){
      const model=buildPrintGuide(book,profile.id),modelPath=path.join(directory,profile.id,'guide.json');
      await writeFile(modelPath,JSON.stringify(model,null,2)+'\n');
      for(const [kind,purpose,component] of [['instructions','instructions','instructions'],['passport','print-passport','passport']]){
        const file=path.join(outputPath,'generated',old.id,profile.id,kind+'.pdf');
        const rendered=spawnSync(python,['scripts/books/render-print-guide.py','--model',modelPath,'--output',file,'--kind',kind],{encoding:'utf8',timeout:30000});
        if(rendered.error||rendered.status!==0)throw new Error(rendered.error?.message||rendered.stderr);
        await add(file,profile.id,purpose,component);
      }
      const html=Buffer.from(renderPrintGuideHtml(model,{slug:book.slug,artifacts:book.artifacts}));
      const descriptor={profileId:profile.id,uri:new URL(relative+'/'+profile.id+'/instructions.html',base).href,mime:'text/html',bytes:html.length,sha256:hash(html)};
      checkContent({...descriptor,relative:relative+'/'+profile.id+'/instructions.html',bookId:book.id,revision},html);
      await writeFile(path.join(directory,profile.id,'instructions.html'),html,{flag:'wx'});
      book.printGuidePages.push(descriptor);
    }
    book.missing=book.missing.filter(key=>!['stickers','instructions','print-passport'].includes(key));
    // Compact only the output metadata, after revision/PDF/HTML models are fixed.
    normalizePreviewUris(book);
    books.push(book);
  }
  const result=publicationSchema.parse({...prior,books});
  const entries=books.flatMap(resources);
  await writePublicationStagingMetadata(outputPath,{
    manifest:JSON.stringify(result,null,2)+'\n',
    related:await readFile('data/travelBooks/related.json'),
    acceptance:JSON.stringify({schemaVersion:1,baseManifestSha256:hash(await readFile(manifest)),generatorHash,coreBytesUnchanged:true,resources:entries.length,supplements:books.flatMap(b=>b.artifacts.filter(a=>['stickers','instructions','print-passport'].includes(a.purpose))),physicalAcceptance:false},null,2)+'\n',
  });
  if(activate)await activatePublication({result,outputPath,cacheRoot});
  return {activated:activate,manifest:path.join(outputPath,'manifest.json'),books:books.map(b=>({id:b.id,revision:b.revision,artifacts:b.artifacts.length}))};
}
/** Cache all verified bytes before replacing the tracked publication pointer. */
async function activatePublication({result,outputPath,cacheRoot}){
  const scratch=await realpath('.codex-temp');
  if(!cacheRoot.startsWith(scratch+path.sep))throw new Error('Activation cache must remain in .codex-temp');
  const entries=collectAssets([result]);
  // First inspect the complete staging set; no pointer/cache writes on bad input.
  for(const entry of entries)checkContent(entry,await verifiedResource(outputPath,entry));
  for(const entry of entries){
    const bytes=await verifiedResource(outputPath,entry);
    await ensureDirectory(cacheRoot,path.dirname(entry.relative));
    const target=path.join(cacheRoot,entry.relative);
    try{
      if(!(await lstat(target)).isFile())throw new Error('Immutable cache leaf is not a regular file');
      const existing=await readFile(target);
      if(existing.length!==entry.bytes||hash(existing)!==entry.sha256)throw new Error('Immutable cache entry differs');
    }catch(error){if(error.code!=='ENOENT')throw error;await writeFile(target,bytes,{flag:'wx'});}
  }
  const payload=Buffer.from(JSON.stringify(result,null,2)+'\n');
  const snapshots=path.resolve('data/travelBooks/releases');
  await ensureDirectory(process.cwd(),'data/travelBooks/releases');
  const snapshot=path.join(snapshots,hash(payload)+'.json');
  try{await writeFile(snapshot,payload,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;if(!(await lstat(snapshot)).isFile())throw new Error('Snapshot leaf is not a regular file');if(!(await readFile(snapshot)).equals(payload))throw new Error('Immutable snapshot differs');}
  for(const [name,bytes] of [['related.json',await readFile(path.join(outputPath,'related.json'))],['manifest.json',payload]]){
    const target=path.resolve('data/travelBooks',name),temporary=target+'.tmp-'+process.pid;
    if(!(await lstat(target)).isFile())throw new Error('Publication pointer must be a regular file');
    await writeFile(temporary,bytes,{flag:'wx'});await rename(temporary,target);
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options={};
  for(let i=2;i<process.argv.length;i++){
    if(process.argv[i]==='--activate'){options.activate=true;continue;}
    const key={'--manifest':'manifest','--production':'production','--cache':'cache','--output':'output','--python':'python'}[process.argv[i]];
    if(!key||!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw new Error('Unknown or incomplete option');
    options[key]=process.argv[++i];
  }
  console.log(JSON.stringify(await augmentPublication(options)));
}
