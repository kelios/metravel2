#!/usr/bin/env node
// Prepares an immutable media package. Upload/remote verification precede activating
// the generated manifest in data/travelBooks/manifest.json; Git revert is rollback.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,realpath,stat,copyFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import sharp from 'sharp';
import {coverResources, coverPersonalizationDescriptor, readCoverResource} from './cover-resources.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJson=async file=>JSON.parse(await readFile(file,'utf8'));
const identifier=/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export function publicationRevision(source,{editorial,publisherHash,rasterizerVersion,encoderVersions}){
  return source.revision+'.'+hash(JSON.stringify({editorial,publisherHash,rasterizerVersion,encoderVersions,
    layoutVersion:2,coverPersonalization:source.coverPersonalization?coverPersonalizationDescriptor(source,filename=>filename):null,
    profiles:source.profiles.map(profile=>({profile:profile.profile,artifacts:profile.artifacts.map(a=>({purpose:a.purpose,component:a.component,sha256:a.sha256})),controls:profile.controls.map(control=>({sha256:control.sha256,controlFor:control.controlFor,component:control.component}))})),
  })).slice(0,12);
}
export async function preparePublication({input,output,baseUrl}){
  const root=await realpath(input);
  output=path.resolve(output);
  if(!output.startsWith(path.resolve('.codex-temp')+path.sep)) throw new Error('Publication staging must stay in .codex-temp/');
  const base=new URL(baseUrl);
  if(base.href!=='https://metravel.by/travel-books/') throw new Error('The same-origin immutable /travel-books/ media base is required');
  const index=await readJson(path.join(root,'production-index.json'));
  if(index.schemaVersion!==1||index.books?.length!==2) throw new Error('Expected both production books');
  const acceptance=await readJson(path.join(root,'validation/report.json'));
  if(acceptance.schemaVersion!==1||acceptance.digitalIntegrityPass!==true||!Array.isArray(acceptance.reports)) throw new Error('Production digital acceptance is required');
  if(acceptance.coverPersonalizationPass!==true||acceptance.coverPersonalizationReports?.length!==2)throw new Error('Clean cover-template and full-font acceptance is required');
  for(const source of index.books){
    const report=acceptance.coverPersonalizationReports.find(item=>item.bookId===source.bookId&&item.revision===source.revision);
    const resources=coverResources(source);
    if(!report?.pass||report.templates?.length!==6||report.fontSha256!==source.coverPersonalization.font.sha256||report.licenseSha256!==source.coverPersonalization.font.license.sha256||resources.filter(r=>r.kind==='template').some(template=>!report.templates.some(item=>item.sha256===template.sha256&&item.pass===true)))throw new Error('Cover-template acceptance differs from current production');
  }
  for(const book of index.books)for(const profile of book.profiles)for(const artifact of profile.artifacts){
    const report=acceptance.reports.find(item=>item.bookId===book.bookId&&item.revision===book.revision&&item.profileId===profile.profile.id&&item.purpose===artifact.purpose&&item.component===artifact.component);
    if(!report||report.digitalIntegrityPass!==true||report.checks?.some(check=>check.status!=='pass'&&check.name!=='image-resolution')||!Object.values(report.artifactHashes??{}).includes(artifact.sha256)) throw new Error('Artifact lacks digital acceptance: '+artifact.path);
  }
  const qrAcceptance=await readJson(path.join(root,'validation/qr-report.json'));
  if(qrAcceptance.schemaVersion!==1||qrAcceptance.digitalPass!==true||qrAcceptance.reports?.length!==4)throw new Error('Exact reading-PDF QR decoding is required');
  for(const source of index.books)for(const profile of source.profiles){const pdf=profile.artifacts.find(artifact=>artifact.purpose==='read'&&artifact.component==='body');const report=qrAcceptance.reports.find(item=>item.bookId===source.bookId&&item.revision===source.revision&&item.profileId===profile.profile.id);if(!pdf||report?.sha256!==pdf.sha256||report.digitalPass!==true||report.stopCount!==source.stopCount||report.reports?.length!==source.stopCount*2||report.reports.some(item=>item.pass!==true))throw new Error('QR decoding report differs from selected reading PDF');}
  await mkdir(output,{recursive:true});
  const stagingRoot=await realpath('.codex-temp');
  if(!(await realpath(output)).startsWith(stagingRoot+path.sep))throw new Error('Publication staging escapes .codex-temp/');
  const publisherHash=hash(await readFile(fileURLToPath(import.meta.url)));
  const rasterizer=spawnSync('pdftoppm',['-v'],{encoding:'utf8',timeout:10000});
  if(rasterizer.error||rasterizer.status!==0)throw new Error('Preview rasterizer unavailable');
  const validation=path.join(output,'publication-validator.cjs');
  await build({entryPoints:['services/book/readyBooks/publication.ts'],outfile:validation,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
  const {createRequire}=await import('node:module');
  const {publicationSchema,coverPersonalizationSchema,buildReadyBookPagePlan}=createRequire(import.meta.url)(validation);
  const books=[];
  for(const source of index.books){
    const editorial=await readJson(source.editorialPath);
    if(editorial.id!==source.bookId||editorial.revision!==source.revision||editorial.country!==source.country) throw new Error('Editorial snapshot mismatch');
    if(!identifier.test(source.bookId)||!identifier.test(source.revision)||source.profiles.some(p=>!['pocket-150x100','album-a5'].includes(p.profile.id)))throw new Error('Invalid production identity');
    for(const profile of source.profiles)for(const control of profile.controls){
      const planPath=await realpath(control.planPath);
      if(!planPath.startsWith(root+path.sep))throw new Error('Control plan escapes production root');
      const plan=await readJson(planPath);
      if(plan.profileId!==profile.profile.id||!['home-rings','home-sewn'].includes(plan.mode)||!['body','cover'].includes(plan.component)||!profile.artifacts.some(a=>a.purpose===plan.mode&&a.component===plan.component&&path.resolve(a.planPath)===planPath))throw new Error('Control plan must identify its exact assembly package');
      Object.assign(control,{controlFor:plan.mode,component:plan.component});
    }
    const revision=publicationRevision(source,{editorial,publisherHash,rasterizerVersion:rasterizer.stderr||rasterizer.stdout,encoderVersions:sharp.versions});
    const relative=`${source.bookId}/${revision}`;
    const directory=path.join(output,relative);
    // A revision is never overwritten. Re-running requires a clean staging directory.
    try {await stat(directory);throw new Error('Immutable revision already staged: '+relative);} catch(error){if(error.code!=='ENOENT') throw error;}
    await mkdir(directory,{recursive:true});
    const uri=file=>new URL(`${relative}/${file}`,base.href.replace(/\/?$/,'/')).href;
    const coverPersonalization=coverPersonalizationSchema.parse(coverPersonalizationDescriptor(source,uri));
    for(const resource of coverResources(source)){
      const bytes=await readCoverResource(resource,root);
      await mkdir(path.dirname(path.join(directory,resource.filename)),{recursive:true});
      await writeFile(path.join(directory,resource.filename),bytes,{flag:'wx'});
    }
    const artifacts=[],preview=[];
    for(const profile of source.profiles){
      const id=profile.profile.id;
      await mkdir(path.join(directory,id),{recursive:true});
      for(const a of profile.artifacts){
        const file=await realpath(a.path);
        if(!file.startsWith(root+path.sep)) throw new Error('Source escapes production root');
        const bytes=await readFile(file);
        if(hash(bytes)!==a.sha256||bytes.length!==a.bytes||bytes.subarray(0,5).toString()!=='%PDF-') throw new Error('Invalid artifact '+a.path);
        const filename=`${id}/${a.purpose}-${a.component}.pdf`;
        await copyFile(file,path.join(directory,filename));
        artifacts.push({id:`${id}.${a.purpose}.${a.component}`,revision,profileId:id,purpose:a.purpose,component:a.component,uri:uri(filename),mime:'application/pdf',sha256:a.sha256,bytes:a.bytes,pageCount:a.pageCount});
        if(a.purpose==='read'){
          const pngPrefix=path.join(directory,id,`source-${a.component}`);
          const result=spawnSync('pdftoppm',['-scale-to','1400','-png',file,pngPrefix],{encoding:'utf8',timeout:180000});
          if(result.error||result.status!==0) throw new Error('Preview rasterization failed: '+(result.error?.message||result.stderr));
          const names=(await readdir(path.dirname(pngPrefix))).filter(name=>name.startsWith(`source-${a.component}-`)&&name.endsWith('.png')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
          if(names.length!==a.pageCount) throw new Error('Preview page count mismatch');
          const pages=[];
          for(const [position,name] of names.entries()){
            const filename=`${id}/preview-${a.component}-${position+1}.webp`;
            const bytes=await sharp(path.join(directory,id,name)).webp({quality:85}).toBuffer();
            await writeFile(path.join(directory,filename),bytes);
            await rm(path.join(directory,id,name));
            pages.push({number:position+1,uri:uri(filename),sha256:hash(bytes),bytes:bytes.length,alt:`${editorial.title} · ${a.component==='body'?'страница':'обложка'} ${position+1}`});
          }
          preview.push({revision,profileId:id,component:a.component,sourceSha256:a.sha256,pages});
        }
      }
      for(const control of profile.controls){
        const file=await realpath(control.path);
        if(!file.startsWith(root+path.sep)) throw new Error('Control escapes production root');
        const bytes=await readFile(file);
        if(hash(bytes)!==control.sha256) throw new Error('Control checksum mismatch');
        const filename=`${id}/control-${control.controlFor}-${control.component}.pdf`;
        await copyFile(file,path.join(directory,filename));
        artifacts.push({id:`${id}.control.${control.controlFor}.${control.component}`,revision,profileId:id,purpose:'control',component:control.component,controlFor:control.controlFor,uri:uri(filename),mime:'application/pdf',sha256:control.sha256,bytes:bytes.length,pageCount:control.pageCount});
      }
    }
    const destinationPages=buildReadyBookPagePlan(editorial).filter(page=>page.kind==='destination');
    const quality=source.profiles.map(profile=>{const reports=acceptance.reports.filter(report=>report.bookId===source.bookId&&report.profileId===profile.profile.id&&report.purpose==='read');const minIllustrationPpi=Math.min(...reports.map(report=>report.minIllustrationPpi));return {profileId:profile.profile.id,printReady:false,minIllustrationPpi,physicalChecks:[...(minIllustrationPpi<300?['image-resolution']:[]),'provider-acceptance','paper-check']};});
    books.push({id:editorial.id,slug:editorial.slug,title:editorial.title,country:editorial.country,revision,contentLocale:'ru',status:'partial',layoutVersion:2,coverPersonalization,bodyPageCount:source.bodyPageCount,coverPageCount:4,stopCount:editorial.stops.length,quality,
      coverUri:preview.find(p=>p.profileId==='pocket-150x100'&&p.component==='cover').pages[0].uri,
      missing:['stickers','instructions','print-passport','provider-acceptance','paper-check'],
      stops:editorial.stops.map((stop,i)=>({id:stop.id,title:stop.title,page:destinationPages[i].number,sourceUrl:stop.navigation.articleUrl,pointId:stop.navigation.pointId,sourceTravelId:stop.navigation.sourceTravelId,authorId:1,...(stop.navigation.quest?{questId:stop.navigation.quest.id}:{})})),
      profiles:source.profiles.map(p=>p.profile),artifacts,preview});
  }
  const manifest=publicationSchema.parse({schemaVersion:1,releaseId:'travel-books-v1',books});
  const temporary=path.join(output,'manifest.json.tmp');
  await writeFile(temporary,JSON.stringify(manifest,null,2)+'\n');
  await rename(temporary,path.join(output,'manifest.json'));
  await writeFile(path.join(output,'related.json'),JSON.stringify(books.map(({country,slug,title,stops})=>({country,slug,title,sourceTravelIds:[...new Set(stops.map(stop=>stop.sourceTravelId))],pointIds:stops.map(stop=>stop.pointId),...(stops.some(stop=>stop.questId)?{questIds:[...new Set(stops.filter(stop=>stop.questId).map(stop=>stop.questId))]}:{})})),null,2)+'\n');
  return {books:books.length,manifest:path.join(output,'manifest.json'),output};
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
  const options={};
  for(let i=2;i<process.argv.length;i+=2){const key={'--input':'input','--output':'output','--base-url':'baseUrl'}[process.argv[i]];if(!key||!process.argv[i+1]) throw new Error('Use --input DIR --output DIR --base-url HTTPS_URL');options[key]=process.argv[i+1];}
  if(!options.input||!options.output||!options.baseUrl) throw new Error('All three publication arguments are required');
  console.log(JSON.stringify(await preparePublication(options)));
}
