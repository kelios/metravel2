#!/usr/bin/env node
import {mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSeriesBook} from './source-series-book.mjs';
import {loadReadyBookCompiler,loadReadyBookInputs,renderPhysicalEdition} from './render-ready-book.mjs';

export async function buildSeriesBooks({output='.codex-temp/books-f2/production',python=process.env.READY_BOOKS_PYTHON||'.codex-temp/books-production/venv/bin/python',check=false,mediaRegistryPath}={}) {
  output=path.resolve(output);
  if(!output.startsWith(path.resolve('.codex-temp')+path.sep))throw new Error('Thematic production must stay in ignored .codex-temp/');
  await mkdir(output,{recursive:true});
  const compiler=await loadReadyBookCompiler(output);
  let browser;const books=[];
  try {
    if(!check){const {chromium}=await import('playwright');browser=await chromium.launch({headless:true});}
    for(const seriesId of ['mountains-pl','castles-pl']) {
      const source=await loadSeriesBook(seriesId,{compiler,mediaRegistryPath});
      books.push(await renderPhysicalEdition({source,compiler,browser,output,python,check,style:'photo',buildHtml:compiler.buildReadyBookHtml,
        loadInput:(profileId,purpose)=>loadReadyBookInputs('pl',profileId,purpose,{source})}));
    }
  } finally {await browser?.close();}
  if(!check){
    const index={schemaVersion:1,status:'production-intermediate',sourceContract:'thematic-v1',visualStyle:'photo',publishable:false,color:'RGB',providerAcceptance:'unverified',books};
    const temp=path.join(output,'production-index.json.tmp');
    await writeFile(temp,JSON.stringify(index,null,2)+'\n');await rename(temp,path.join(output,'production-index.json'));
  }
  return {books:books.length,profiles:books.reduce((n,b)=>n+b.profiles.length,0),check,output};
}

async function main(args){
  const options={};
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--check')options.check=true;
    else {const key={'--output':'output','--python':'python','--media-registry':'mediaRegistryPath'}[args[i]],value=args[++i];if(!key||!value||value.startsWith('--'))throw new Error('Use [--check] [--output DIR] [--python PATH] [--media-registry FILE]');options[key]=value;}
  }
  console.log(JSON.stringify(await buildSeriesBooks(options)));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
