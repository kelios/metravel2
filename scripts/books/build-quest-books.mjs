import {readFile,writeFile,mkdir,realpath,stat,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import QRCode from 'qrcode';
import {loadCountryQuestBookSources} from './source-quest-books.mjs';
import {editionCopySha256, loadCoverPersonalizationSource} from './source-ready-book.mjs';
import {loadReadyBookCompiler,renderPhysicalEdition} from './render-ready-book.mjs';
import {buildQuestBookMaps} from './quest-maps.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Keep the recorded implementation choice explicit; never manufacture an approval or answer key. */
export async function loadQuestBookEnding(file='data/travelBooks/quests/ending.json'){
  let bytes;try{bytes=await readFile(file);}catch(error){if(error.code==='ENOENT')throw new Error('QUEST_BOOK_ENDING_PENDING');throw error;}
  const value=JSON.parse(bytes);
  if(value.schemaVersion!==1||value.status!=='owner-approved'||value.ownerDecision?.command!=='Общая карта страны со всеми квестами'||!/^\d{4}-\d{2}-\d{2}$/.test(value.ownerDecision?.recordedAt)||JSON.stringify(value.pages)!=='["country-map"]')throw new Error('QUEST_BOOK_ENDING_NOT_RECORDED');
  return {...value,sha256:hash(bytes)};
}

/** Country/editorial adapter only; existing compiler creates PDF, covers, imposition and controls. */
export async function buildCountryQuestBooks({output='.codex-temp/books-quests/production',python='.codex-temp/books-production/venv/bin/python',endingPath}={}){
  const ending=await loadQuestBookEnding(endingPath);
  const scratch=await realpath('.codex-temp');
  await mkdir(path.join(scratch,'ops'),{recursive:true});
  const marker=path.join(scratch,'ops/books-f1-authoring.lock');
  await writeFile(marker,JSON.stringify({pid:process.pid,operation:'country quest book authoring',started:new Date().toISOString()})+'\n',{flag:'wx'});
  try{
  const sources=await loadCountryQuestBookSources();
  output=path.resolve(output);
  if(!output.startsWith(scratch+path.sep))throw new Error('Quest production output must remain in ignored storage');
  await mkdir(output,{recursive:true});
  if(!(await realpath(output)).startsWith(scratch+path.sep))throw new Error('Quest output escapes ignored storage');
  try{await stat(path.join(output,'production-index.json'));throw new Error('Quest production already exists; use a fresh output directory');}catch(error){if(error.code!=='ENOENT')throw error;}
  const compiler=await loadReadyBookCompiler(output,'scripts/books/quest-render-entry.ts');
  const adapterHash=hash(await readFile(fileURLToPath(import.meta.url)));
  const compiledHash=hash(await readFile(path.join(output,'ready-book-source.cjs')));
  const fontFiles={regular:'docs/design/travel-memory-books-v1/assets/fonts/NotoSans-Regular.ttf',bold:'docs/design/travel-memory-books-v1/assets/fonts/NotoSans-Bold.ttf',serif:'data/travelBooks/assets/fonts/marckscript/MarckScript-Regular.ttf'};
  const fonts={},fontHashes={};for(const [role,file] of Object.entries(fontFiles)){const bytes=await readFile(file);fonts[role]='data:font/ttf;base64,'+bytes.toString('base64');fontHashes[role]=hash(bytes);}
  const notoLicense=await readFile('docs/design/travel-memory-books-v1/assets/fonts/LICENSE.txt');
  if(!notoLicense.toString('utf8').includes('SIL OPEN FONT LICENSE Version 1.1'))throw new Error('Noto font license unavailable');
  const fontLicenses={noto:hash(notoLicense),marck:hash(await readFile('data/travelBooks/assets/fonts/marckscript/OFL.txt'))};
  const maps=await buildQuestBookMaps({books:sources.books,output:path.join(output,'maps')});
  const books=[];let browser;
  const {chromium}=await import('playwright');browser=await chromium.launch({headless:true});
  try{
    for(const selected of sources.books){
      const covers={},qr={};
      for(const quest of selected.quests){
        const bytes=await sharp(sources.assets[quest.questId].coverPath).jpeg({quality:94}).toBuffer();
        covers[quest.questId]='data:image/jpeg;base64,'+bytes.toString('base64');
        const model=QRCode.create(quest.questUrl,{errorCorrectionLevel:'M'}),qrSizeMm=Math.max(22,Math.ceil((model.modules.size+8)*.28*10)/10);
        if(qrSizeMm>29)throw new Error('Published quest URL is too dense for the physical QR band');
        qr[quest.questId]={qrSizeMm,qrDataUri:'data:image/svg+xml;base64,'+Buffer.from(await QRCode.toString(quest.questUrl,{type:'svg',errorCorrectionLevel:'M',margin:4,color:{dark:'#31443dff',light:'#fffefaff'}})).toString('base64')};
      }
      const mapDescriptors=Object.values(maps.maps).filter(map=>selected.quests.some(quest=>quest.questId===map.questId));
      const coverPersonalization=await loadCoverPersonalizationSource(selected.id),editionCopy=await editionCopySha256(selected.id,coverPersonalization);
      const revision=selected.revision+'.'+hash(JSON.stringify({ending,adapterHash,compiledHash,fontHashes,fontLicenses,editionCopy,encoderVersions:sharp.versions,covers:Object.values(covers).map(hash),maps:mapDescriptors.map(({questId,profileId,sha256})=>({questId,profileId,sha256}))})).slice(0,12);
      const book={...selected,revision,endMatterPages:ending.pages};
      const first=book.quests[0],cover={dataUri:covers[first.questId],widthPx:first.cover.widthPx,heightPx:first.cover.heightPx,artworkBounds:{left:0,top:0,width:1,height:1}};
      const provenance={kind:'quests',sourceRevision:selected.revision,ending,adapterHash,compiledHash,fontHashes,fontLicenses,coverReuseBasis:sources.rights.permissionBasis,covers:sources.rights.assets.filter(asset=>book.quests.some(quest=>quest.questId===asset.questId)),maps:mapDescriptors.map(map=>{const record={...map};delete record.path;return record;})};
      await writeFile(path.join(output,book.id+'-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
      const source={book,cover,coverPersonalization,fonts,provenance};
      const assetsHash=hash(JSON.stringify({covers:book.quests.map(quest=>quest.cover),maps:mapDescriptors.map(map=>map.sha256),fontHashes}));
      books.push(await renderPhysicalEdition({source,compiler,browser,output,python,buildHtml:compiler.buildCountryQuestBookHtml,loadInput:async(profileId,purpose)=>{
        const assets={};for(const quest of book.quests){const map=maps.maps[quest.questId+':'+profileId];const bytes=await readFile(map.path);if(hash(bytes)!==map.sha256||hash(JSON.stringify(quest.points))!==map.pointsSha256)throw new Error('Map source or bytes differ from selected quest');assets[quest.questId]={coverDataUri:covers[quest.questId],mapDataUri:'data:image/png;base64,'+bytes.toString('base64'),mapViewport:map.viewport,...qr[quest.questId]};}
        const profile={id:profileId,widthMm:profileId==='album-a5'?148:150,heightMm:profileId==='album-a5'?210:100,bleedMm:purpose==='read'?0:3,safeMm:5,bindingMm:15,binding:'rings'};
        return {...source,profile,purpose,assets,assetsHash};
      }}));
    }
  }finally{await browser?.close();}
  const index={schemaVersion:1,kind:'quests',status:'production-intermediate',publishable:false,color:'RGB',providerAcceptance:'unverified',books};
  await writeFile(path.join(output,'production-index.json'),JSON.stringify(index,null,2)+'\n');
  return {books:books.length,quests:books.map(book=>book.stopCount),bodyPages:books.map(book=>book.bodyPageCount),output};
  }finally{await rm(marker,{force:true});}
}
async function main(){
  const options={};for(let i=2;i<process.argv.length;i++){const key={'--output':'output','--python':'python','--ending':'endingPath'}[process.argv[i]];if(!key||!process.argv[i+1]||process.argv[i+1].startsWith('--')||key in options)throw new Error('Use [--output DIR] [--python PATH] [--ending DECISION_JSON]');options[key]=process.argv[++i];}
  console.log(JSON.stringify(await buildCountryQuestBooks(options)));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.execArgv.includes('--experimental-strip-types')){const child=spawnSync(process.execPath,['--experimental-strip-types','--no-warnings',fileURLToPath(import.meta.url),...process.argv.slice(2)],{stdio:'inherit'});if(child.error)console.error(child.error.message);process.exit(child.status??1);}
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
