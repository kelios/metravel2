import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const {ensureDirectory}=createRequire(import.meta.url)('./copy-publication.cjs');
import sharp from 'sharp';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const tileOrigin='https://metravel.by';

/** Image-memory cache can skip request interception; provenance follows every viewport tile. */
export async function questMapTileInputs(viewport,loadTile){
  const inputs=[];
  for(let tx=viewport.startTX;tx<=viewport.endTX;tx++)for(let ty=viewport.startTY;ty<=viewport.endTY;ty++){
    const uri=`${tileOrigin}/proxy/tiles/osm/${viewport.zoom}/${tx}/${ty}.png`;
    inputs.push((await loadTile(uri)).descriptor);
  }
  return inputs.sort((a,b)=>a.uri.localeCompare(b.uri));
}

/** Author real basemaps through the existing canvas snapshot; never invent a walking route. */
export async function buildQuestBookMaps({books,output,onlyQuestIds,fetchTile=fetch}){
  output=path.resolve(output);
  const scratch=await realpath('.codex-temp');
  if(!output.startsWith(scratch+path.sep))throw new Error('Quest maps must stay in ignored authoring storage');
  await mkdir(output,{recursive:true});
  if(!(await realpath(output)).startsWith(scratch+path.sep))throw new Error('Quest map output escapes scratch');
  const bundle=path.join(output,'map-browser.js');
  await build({entryPoints:['scripts/books/quest-map-entry.ts'],outfile:bundle,bundle:true,platform:'browser',format:'iife',alias:{'react-native':'react-native-web'},globalName:'QuestMapAuthor',logLevel:'silent'});
  const rendererHash=hash(await readFile(bundle));
  const authoringAdapterSha256=hash(await readFile(fileURLToPath(import.meta.url)));
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const maps={},tiles=new Map();
  const tile=async url=>{
    const parsed=new URL(url);
    if(parsed.origin!==tileOrigin||!/^\/proxy\/tiles\/osm\/\d+\/\d+\/\d+\.png$/.test(parsed.pathname)||parsed.search)throw new Error('Map author only accepts owned tile proxy resources');
    if(!tiles.has(url))tiles.set(url,(async()=>{
      const target=path.join(output,'tiles',parsed.pathname.slice('/proxy/tiles/osm/'.length));
      let bytes;
      await ensureDirectory(output,path.relative(output,path.dirname(target)));
      try{if(!(await lstat(target)).isFile())throw new Error('Map cache leaf must be a regular file');bytes=await readFile(target);}catch(error){
        if(error.code!=='ENOENT')throw error;
        const response=await fetchTile(url,{redirect:'error',credentials:'omit',signal:AbortSignal.timeout(30000)});
        if(!response.ok)throw new Error('Map tile unavailable: '+url+' HTTP'+response.status);
        bytes=Buffer.from(await response.arrayBuffer());
        if(bytes.length>1024*1024)throw new Error('Map tile exceeds its resource limit');
        const meta=await sharp(bytes).metadata();
        if(meta.format!=='png'||meta.width!==256||meta.height!==256)throw new Error('Invalid native OSM tile');
        await ensureDirectory(output,path.relative(output,path.dirname(target)));await writeFile(target,bytes,{flag:'wx'});
      }
      const meta=await sharp(bytes).metadata();
      if(bytes.length>1024*1024||meta.format!=='png'||meta.width!==256||meta.height!==256)throw new Error('Cached map tile is invalid');
      return {bytes,descriptor:{uri:url,bytes:bytes.length,sha256:hash(bytes)}};
    })());
    return tiles.get(url);
  };
  try{
    const page=await browser.newPage();
    await page.route('**/*',async route=>{
      const url=route.request().url();
      if(url===tileOrigin+'/__quest_book_authoring__')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ru"><meta charset="utf-8"><title>Map authoring</title></html>'});
      try{const {bytes}=await tile(url);await route.fulfill({contentType:'image/png',body:bytes});}
      catch{await route.abort();}
    });
    await page.goto(tileOrigin+'/__quest_book_authoring__');await page.addScriptTag({path:bundle});
    for(const book of books)for(const quest of book.quests){
      if(onlyQuestIds&&!onlyQuestIds.includes(quest.questId))continue;
      for(const profileId of ['pocket-150x100','album-a5']){
        const widthMm=profileId==='album-a5'?128:130,heightMm=profileId==='album-a5'?161:55;
        const width=Math.round(widthMm/25.4*150),height=width*heightMm/widthMm;
        // Integer raster dimensions and the vector overlay must use the same aspect ratio.
        const dimensions={width,height:Math.round(height)};
        const result=await page.evaluate(async({points,dimensions})=>{
          const api=globalThis.QuestMapAuthor;
          const options={...dimensions,maxZoom:17,fitPaddingFactor:1.3,showMarkers:false,showLabels:false,requireCompleteTiles:true};
          const viewport=api.buildCanvasMapViewport(points,[],dimensions.width,dimensions.height,17,1.3);
          const dataUri=await api.generateCanvasMapSnapshot(points,options);
          if(!dataUri)throw new Error('No map raster');
          return {viewport,dataUri};
        },{points:quest.points,dimensions});
        const bytes=Buffer.from(result.dataUri.split(',')[1],'base64');
        const native=await sharp(bytes).metadata(),inputs=await questMapTileInputs(result.viewport,tile);
        if(!inputs.length||native.width!==dimensions.width||native.height!==dimensions.height)throw new Error('Map output differs from exact native raster');
        const relative=`${book.id}/${profileId}/${quest.questId}.png`,target=path.join(output,relative);
        await ensureDirectory(output,path.relative(output,path.dirname(target)));
        try{if(!(await lstat(target)).isFile())throw new Error('Map output leaf must be a regular file');}catch(error){if(error.code!=='ENOENT')throw error;}
        await writeFile(target,bytes);
        maps[`${quest.questId}:${profileId}`]={questId:quest.questId,profileId,path:target,sha256:hash(bytes),bytes:bytes.length,widthPx:native.width,heightPx:native.height,viewport:result.viewport,
          pointsSha256:hash(JSON.stringify(quest.points)),rendererSha256:rendererHash,authoringAdapterSha256,tiles:inputs,tileInputSha256:hash(JSON.stringify(inputs)),attribution:'© OpenStreetMap contributors',routeGeometry:'none'};
      }
    }
  }finally{await browser.close();}
  const report={schemaVersion:1,rendererSha256:rendererHash,authoringAdapterSha256,maps};
  await writeFile(path.join(output,'maps.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
