#!/usr/bin/env node
import {readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const {ensureDirectory}=require('./copy-publication.cjs');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Only exact sources from the complete published composition establish a related-book link. */
export function relatedBookIndex(manifest){
  return manifest.books.map(({kind,country,slug,title,stops})=>({
    ...(kind==='quests'?{kind}:{}),country,slug,title,
    sourceTravelIds:[...new Set(stops.flatMap(stop=>stop.sourceTravelId?[stop.sourceTravelId]:[]))],
    pointIds:stops.flatMap(stop=>stop.pointId?[stop.pointId]:[]),
    ...(stops.some(stop=>stop.questId)?{questIds:[...new Set(stops.filter(stop=>stop.questId).map(stop=>stop.questId))]}:{}),
  }));
}

export function thinBookCatalogue(manifest){
  if(!Array.isArray(manifest.bookMetadata)||manifest.bookMetadata.length!==manifest.books.length)throw new Error('Every book needs pinned metadata before creating the thin catalogue');
  return {schemaVersion:1,books:manifest.books.map(book=>{
    const matches=manifest.bookMetadata.filter(asset=>asset.bookId===book.id&&asset.revision===book.revision);
    if(matches.length!==1)throw new Error('Missing or duplicate book metadata');
    const {id,slug,title,country,revision,contentLocale,status,coverUri,stopCount,bodyPageCount,profiles,missing,visualStyle}=book;
    return {id,slug,kind:book.kind??'places',...(visualStyle?{visualStyle}:{}),title,country,revision,contentLocale,status,coverUri,stopCount,bodyPageCount,profiles,missing,
      ...(book.kind==='quests'?{seriesId:book.seriesId,volume:book.volume}:{}),metadata:matches[0]};
  })};
}

/** Add immutable metadata resources without altering an existing resource or following symlinks. */
export async function stageBookMetadata(manifest,assetsRoot){
  const root=await realpath(assetsRoot);
  const bookMetadata=[];
  for(const book of manifest.books){
    if(!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(book.id)||!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(book.revision))throw new Error('Invalid book metadata identity');
    const relative=`${book.id}/${book.revision}/book.json`;
    await ensureDirectory(root,path.dirname(relative));
    const target=path.join(root,relative),bytes=Buffer.from(JSON.stringify(book)+'\n');
    if(bytes.length>1024*1024)throw new Error('Book metadata exceeds its resource limit');
    let existing;
    try{existing=await lstat(target);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(existing){
      if(!existing.isFile()||existing.isSymbolicLink()||!(await readFile(target)).equals(bytes))throw new Error('Immutable book metadata already exists with different bytes');
    }else await writeFile(target,bytes,{flag:'wx'});
    bookMetadata.push({kind:'book-metadata',bookId:book.id,revision:book.revision,uri:`https://metravel.by/travel-books/${relative}`,mime:'application/json',bytes:bytes.length,sha256:hash(bytes)});
  }
  return {...manifest,bookMetadata};
}

async function main(){
  try{
    const options={};
    for(let index=2;index<process.argv.length;index+=2){
      const key=process.argv[index],value=process.argv[index+1];
      if(!['--manifest','--assets-root','--catalog','--output-manifest'].includes(key)||!value||value.startsWith('--')||key in options)throw new Error('Use --manifest FILE --assets-root DIR --catalog FILE --output-manifest FILE');
      options[key]=value;
    }
    if(Object.keys(options).length!==4)throw new Error('All four metadata compilation arguments are required');
    const {build}=await import('esbuild');
    const tempRoot=await realpath('.codex-temp');
    const validation=path.join(await ensureDirectory(tempRoot,'books-metadata-validator'),'publication.cjs');
    await build({entryPoints:['services/book/readyBooks/publication.ts'],outfile:validation,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
    const {publicationSchema}=require(validation);
    const source=JSON.parse(await readFile(options['--manifest'],'utf8'));
    publicationSchema.parse(source);
    const manifest=await stageBookMetadata(source,options['--assets-root']);
    publicationSchema.parse(manifest);
    await writeFile(options['--catalog'],JSON.stringify(thinBookCatalogue(manifest),null,2)+'\n');
    await writeFile(options['--output-manifest'],JSON.stringify(manifest,null,2)+'\n');
    console.log(JSON.stringify({books:manifest.books.length,metadataResources:manifest.bookMetadata.length}));
  }catch(error){console.error(error.message);process.exitCode=1;}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
