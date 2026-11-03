import {readFile, mkdir, realpath, mkdtemp, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {build} from 'esbuild';
import sharp from 'sharp';
import {PHOTO_FONTS, editionCopySha256, loadCoverPersonalizationSource, projectFile, sha256} from './source-ready-book.mjs';
import {loadReadyBookCompiler} from './render-ready-book.mjs';

const json = async file => JSON.parse(await readFile(file, 'utf8'));
const require = createRequire(import.meta.url);
let schemas;
async function sourceSchemas() {
  schemas ??= (async () => {
    await mkdir('.codex-temp/books-f2', {recursive: true});
    const directory = await mkdtemp(path.resolve('.codex-temp/books-f2/source-schema-'));
    const file = path.join(directory, 'schema.cjs');
    try {
      await build({entryPoints:['data/travelBooks/schema/series.ts'],outfile:file,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
      return require(file);
    } finally {await rm(directory,{recursive:true,force:true});}
  })();
  return schemas;
}

/** Resolve native bytes by a digest through an ignored local registry, never a private archive path in public data. */
export async function loadSeriesPhoto(media, registry) {
  const sourceId = media.kind === 'owner-original' ? media.sourceId : registry.publicSources?.[media.sha256];
  const entry = registry.sources?.[sourceId];
  if (!entry || entry.sha256 !== media.sha256) throw new Error('Missing exact thematic media input: ' + media.sha256);
  if (media.kind === 'published-variant' && entry.uri !== media.uri) throw new Error('Thematic public URI does not identify the verified source bytes');
  const resolved = await realpath(path.resolve(entry.path));
  if (!resolved.startsWith(path.resolve('.codex-temp') + path.sep)) throw new Error('Thematic media must resolve to an ignored source copy');
  const bytes = await readFile(resolved);
  if (sha256(bytes) !== media.sha256 || bytes.length !== media.bytes) throw new Error('Thematic source bytes differ from the verified photo');
  // An owner-approved retouch replaces the pixels of the same frame; it is pinned by SHA in the ignored registry.
  let pixels = bytes;
  if (media.retouch) {
    const retouched = registry.retouched?.[media.retouch.sha256];
    const file = retouched && await realpath(path.resolve(retouched.path));
    if (!file || !file.startsWith(path.resolve('.codex-temp') + path.sep)) throw new Error('Missing retouched thematic media: ' + media.retouch.sha256);
    pixels = await readFile(file);
    if (sha256(pixels) !== media.retouch.sha256) throw new Error('Retouched thematic bytes differ from the record');
  }
  // rotate applies EXIF orientation, then encoding without withMetadata strips private EXIF/GPS.
  const oriented = await sharp(pixels).rotate().toBuffer({resolveWithObject: true});
  if (oriented.info.width !== media.widthPx || oriented.info.height !== media.heightPx) throw new Error('Thematic source dimensions differ from the source record');
  // An approved editorial crop keeps people out of the printed frame (#2968); the record keeps the full source size.
  const crop = media.crop;
  if (crop && (crop.leftPx + crop.widthPx > media.widthPx || crop.topPx + crop.heightPx > media.heightPx)) throw new Error('Thematic crop leaves the source frame');
  const framed = crop ? sharp(oriented.data).extract({left: crop.leftPx, top: crop.topPx, width: crop.widthPx, height: crop.heightPx}) : sharp(oriented.data);
  const derivative = await framed.jpeg({quality:94,mozjpeg:true}).toBuffer();
  const metadata = await sharp(derivative).metadata();
  if (metadata.width !== (crop?.widthPx ?? media.widthPx) || metadata.height !== (crop?.heightPx ?? media.heightPx) || metadata.exif || metadata.xmp || metadata.iptc) throw new Error('Thematic derivative dimensions or privacy differ from the source record');
  return {bytes: derivative, sha256: sha256(derivative), widthPx: metadata.width, heightPx: metadata.height};
}

/** Strict thematic sources adapt to the existing semantic renderer; physical production is shared. */
export async function loadSeriesBook(seriesId, {sourcesRoot='data/travelBooks/series',mediaRegistryPath='.codex-temp/books-f2/media-index.json',compiler}={}) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(seriesId)) throw new Error('Invalid thematic series ID');
  const [catalog,registry,schema] = await Promise.all([json(path.join(sourcesRoot,'catalog.json')),json(mediaRegistryPath),sourceSchemas()]);
  const selected = schema.seriesCatalogSchema.parse(catalog).series.filter(item=>item.id===seriesId);
  if (selected.length !== 1 || selected[0].bookIds.length !== 1) throw new Error('A thematic source needs one declared series and edition');
  const series = selected[0];
  const kit = schema.thematicSeriesKitSchema.parse(await json(path.join(sourcesRoot,series.kit)));
  if (kit.seriesId !== series.id || kit.theme !== series.theme || kit.places.length !== series.targetPlaces || kit.places.some(place=>place.country !== 'PL')) throw new Error('Thematic composition differs from its declared series');
  const copy = await json(path.join(sourcesRoot,seriesId+'-copy.json'));
  if (copy.schemaVersion!==1 || copy.seriesId!==seriesId || copy.records.length!==kit.places.length || new Set(copy.records.map(r=>r.id)).size!==kit.places.length) throw new Error('Thematic prose must cover every exact selected place once');
  let tools=compiler;
  if(!tools){const directory=await mkdtemp(path.resolve('.codex-temp/books-f2/source-render-'));try{tools=await loadReadyBookCompiler(directory);}finally{await rm(directory,{recursive:true,force:true});}}
  const assets={},provenance=[],stops=[];
  for (const place of kit.places) {
    const thematic = structuredClone(place.thematic);
    const record = copy.records.find(row=>row.id===place.id);
    if (!record || record.sourceUrl!==thematic.articleUrl || typeof record.copyRu!=='string' || record.copyRu.trim().length<100 || record.copyRu.length>280) throw new Error('Thematic prose is missing or sourced to another article: '+place.id);
    // Kept with the place for the memory page, which stays blank in print (#2947).
    if (typeof record.prompt!=='string' || !record.prompt.trim()) throw new Error('Thematic place has no memory prompt: '+place.id);
    if (thematic.media.peopleFree !== true) throw new Error('A printed series photograph must be checked free of people: '+place.id);
    const photo = await loadSeriesPhoto(thematic.media,registry);
    const placements = ['pocket-150x100','album-a5'].map(profileId=>{
      const p=tools.thematicPhotoPlacement(photo.widthPx,photo.heightPx,profileId);
      return {profileId,widthMm:p.width,heightMm:p.height,effectivePpi:p.effectivePpi};
    });
    if(placements.some(expected=>{
      const declared=thematic.media.placements?.find(p=>p.profileId===expected.profileId);
      return !declared||Math.abs(declared.widthMm-expected.widthMm)>.03||Math.abs(declared.heightMm-expected.heightMm)>.03||Math.abs(declared.effectivePpi-expected.effectivePpi)>1;
    }))throw new Error('Thematic native placement evidence must be refreshed for the current layout: '+place.id);
    const target=thematic.mapTarget;
    const navigation={authorId:1,sourceTravelId:thematic.sourceTravelId,mapUrl:tools.thematicMapUrl(target,place.title),articleUrl:thematic.articleUrl,verifiedAt:thematic.verifiedOn};
    assets[place.id]={dataUri:'data:image/jpeg;base64,'+photo.bytes.toString('base64'),credit:'MeTravel / автор статьи 1',sourceUrl:thematic.articleUrl,rights:thematic.media.permissionEvidence,illustrated:false,...(thematic.media.retouch?{retouched:true,changes:'Ретушь: '+thematic.media.retouch.removed}:{}),artworkBounds:{left:0,top:0,width:1,height:1},widthPx:photo.widthPx,heightPx:photo.heightPx};
    provenance.push({stopId:place.id,source:thematic.media,derivative:{sha256:photo.sha256,bytes:photo.bytes.length,widthPx:photo.widthPx,heightPx:photo.heightPx,exifRemoved:true,upscaled:false}});
    stops.push({id:place.id,title:place.title,localName:place.localName,lat:target.lat,lng:target.lng,
      entrance:'Привязка физического места; отдельный вход не заявлен.',coordinateAccuracy:'site-center',coordinateSource:target.sourceUrl,
      source:{kind:'travel-address',id:String(thematic.sourcePointId),url:thematic.articleUrl},text:{compact:record.copyRu.trim(),album:record.copyRu.trim()},navigation,
      fact:record.copyRu.trim(),observation:record.prompt.trim(),references:[{url:thematic.articleUrl,checkedAt:thematic.verifiedOn,claims:[record.copyRu.trim()]}],
      imageBrief:thematic.media.caption,thematic});
  }
  const coverId = seriesId==='mountains-pl'?'mountains-pl-38':'castles-pl-03';
  const cover = assets[coverId];
  if (!cover) throw new Error('Thematic cover must reuse a verified selected place');
  const coverPersonalization = await loadCoverPersonalizationSource(series.bookIds[0]);
  const [textBytes,headingBytes,license] = await Promise.all([projectFile(PHOTO_FONTS.text.path,PHOTO_FONTS.text.sha256),projectFile(PHOTO_FONTS.heading.path,PHOTO_FONTS.heading.sha256),projectFile(PHOTO_FONTS.license.path)]);
  if (!license.toString('utf8').includes('SIL OPEN FONT LICENSE Version 1.1')) throw new Error('Thematic photographic books require the full licensed Lora font');
  const font = bytes=>'data:font/ttf;base64,'+bytes.toString('base64');
  const editionCopy = await editionCopySha256(series.bookIds[0], coverPersonalization);
  const revision='2026-11-02.series.'+sha256(JSON.stringify({kit,copy,provenance,coverId,fonts:PHOTO_FONTS,editionCopy})).slice(0,12);
  const book={schemaVersion:1,status:'editorial-draft',sourceContract:'thematic-v1',seriesId:series.id,theme:series.theme,id:series.bookIds[0],slug:series.bookIds[0].replace(/-memory$/,''),revision,country:'PL',contentLocale:'ru',title:series.title,visualStyle:'photo',stops,
    miniTrips:[{id:'selected-places',title:'Самостоятельные поездки',stopIds:stops.map(stop=>stop.id),note:'Выбранные места не образуют один непрерывный маршрут.'}]};
  return {book,assets,cover,coverPersonalization,fonts:{regular:font(textBytes),bold:font(textBytes),serif:font(textBytes),heading:font(headingBytes)},provenance:{sourceContract:'thematic-v1',seriesId,kitSha256:sha256(JSON.stringify(kit)),copySha256:sha256(JSON.stringify(copy)),assets:provenance,coverStopId:coverId,font:{textSha256:PHOTO_FONTS.text.sha256,headingSha256:PHOTO_FONTS.heading.sha256,licenseSha256:sha256(license)}},assetsHash:sha256(JSON.stringify(provenance))};
}
