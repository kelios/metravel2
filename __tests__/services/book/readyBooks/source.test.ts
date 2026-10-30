import {runNodeCli} from '../../../scripts/cli-test-utils';

it('binds selected points to the exact author article, source-photo bytes and approved artwork',()=>{
  const result=runNodeCli(['--input-type=module','-e',`
    import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
    import path from 'node:path';
    import sharp from 'sharp';
    import {loadSelectedBook,sha256} from './scripts/books/source-ready-book.mjs';
    await mkdir('.codex-temp',{recursive:true});
    const dir=await mkdtemp(path.resolve('.codex-temp/books-sources-test-'));
    try{
      await mkdir(path.join(dir,'by'));
      const pixels=await sharp({create:{width:10,height:15,channels:3,background:'#fffefa'}}).png().toBuffer();
      const photoPath=path.join(dir,'photo.png'),fontPath=path.join(dir,'font.ttf'),licensePath=path.join(dir,'OFL.txt'),registryPath=path.join(dir,'registry.json');
      const promptPath=path.join(dir,'prompt.txt'),historicalPath=path.join(dir,'historical.json');
      await writeFile(promptPath,'isolated artwork prompt');await writeFile(historicalPath,JSON.stringify({status:'owner-approved-reference'}));
      const fullFont=await readFile('data/travelBooks/assets/fonts/marckscript/MarckScript-Regular.ttf');const fullLicense=await readFile('data/travelBooks/assets/fonts/marckscript/OFL.txt');await writeFile(photoPath,pixels);await writeFile(fontPath,fullFont);await writeFile(licensePath,fullLicense);
      const rows=Array.from({length:30},(_,i)=>({pointId:i+1,travelId:i+101,lat:53,lng:27,travelUrl:'https://metravel.by/travels/article-'+i}));
      const selection={country:'BY',authorId:1,count:30,rows};
      const records=rows.map((row,i)=>({id:'point-'+row.pointId,pointId:row.pointId,country:'BY',printTitle:'Тестовое место '+i,localName:'Тестовое место '+i,copyRu:'Проверенный рассказ об авторской фотографии выбранного места. Этот текст является изолированным примером входного контракта. Все приведённые сведения используются только в этом проверяемом примере.',coordinates:{lat:53,lng:27},article:{id:row.travelId,url:row.travelUrl,userId:1,publicationStatus:'published',pointIdVerified:true,verifiedOn:'2026-10-30'},photo:{articleImageUri:row.travelUrl+'/image',originalUri:row.travelUrl+'/original',association:{evidence:'same-article exact photo'},rights:{ownerUserId:1,sourceTravelId:row.travelId,permission:'owner-commissioned-photo-diary'}},qr:{map:'https://metravel.by/map?lat=53&lng=27&focusPlace=1&placeId='+row.pointId+'&placeTitle=Test',article:row.travelUrl},quest:{status:'not-associated'},sourceEvidence:{excerpt:'Сведения из проверяемого источника.'}}));
      const source={country:'BY',authorId:1,compositionCount:30,records};
      const registry={schemaVersion:1,fonts:[{role:'handwritten',localPath:fontPath,sha256:sha256(fullFont),licensePath}],assets:rows.map((row,i)=>({country:'BY',stopId:'point-'+row.pointId,localPath:photoPath,sha256:sha256(pixels),sourcePhotoSha256:sha256(pixels),sourcePhotoLocalPath:photoPath,sourceOriginalUri:records[i].photo.originalUri,printAllowed:true,illustrated:true,tool:'built-in image_gen',promptPath,promptSha256:sha256(Buffer.from('isolated artwork prompt')),styleReferencePath:photoPath,styleReferenceSha256:sha256(pixels)})),covers:[{country:'BY',sourceStopId:'point-2',localPath:photoPath,sha256:sha256(pixels)}]};
      const save=async(s,r,a)=>{await writeFile(path.join(dir,'by/selection.json'),JSON.stringify(s));await writeFile(path.join(dir,'by/source-records.json'),JSON.stringify(r));await writeFile(registryPath,JSON.stringify(a));};
      await save(selection,source,registry);
      const valid=await loadSelectedBook('by',{sourcesRoot:dir,registryPath});
      const historicalRegistry=structuredClone(registry);delete historicalRegistry.assets[0].promptPath;delete historicalRegistry.assets[0].promptSha256;Object.assign(historicalRegistry.assets[0],{promptStatus:'historical-exact-prompt-unavailable',historicalProvenancePath:historicalPath});await save(selection,source,historicalRegistry);const historical=await loadSelectedBook('by',{sourcesRoot:dir,registryPath});
      const cases={};
      for(const [name,mutate] of Object.entries({
        author:(s,r,a)=>r.records[0].article.userId=2,
        sourcePhoto:(s,r,a)=>a.assets[0].sourceOriginalUri=r.records[1].photo.originalUri,
        promptBytes:(s,r,a)=>a.assets[0].promptSha256='0'.repeat(64),
        styleBytes:(s,r,a)=>a.assets[0].styleReferenceSha256='0'.repeat(64),
        missingPrompt:(s,r,a)=>{delete a.assets[0].promptPath;delete a.assets[0].promptSha256;},
        coverPoint:(s,r,a)=>a.covers[0].sourceStopId='point-999',
        photoBytes:(s,r,a)=>a.assets[0].sourcePhotoSha256='0'.repeat(64),
        artBytes:(s,r,a)=>a.assets[0].sha256='0'.repeat(64),
        map:(s,r,a)=>r.records[0].qr.map='https://metravel.by/map?lat=53&lng=27&placeId=1',
        missing:(s,r,a)=>r.records.pop(),
        prototype:(s,r,a)=>{s.rows=s.rows.slice(0,12);s.count=12;},
      })){
        const s=structuredClone(selection),r=structuredClone(source),a=structuredClone(registry);mutate(s,r,a);await save(s,r,a);
        try{await loadSelectedBook('by',{sourcesRoot:dir,registryPath});cases[name]='unexpected-pass';}catch(error){cases[name]=error.message;}
      }
      console.log(JSON.stringify({stops:valid.book.stops.length,coverUrl:valid.cover.sourceUrl,coverSource:valid.provenance.cover,generation:valid.provenance.assets[0].generation,historical:historical.provenance.assets[0].generation,native:valid.provenance.assets[0].nativeWidthPx,cases}));
    }finally{await rm(dir,{recursive:true,force:true});}
  `]);
  expect(result.status).toBe(0);
  const data=JSON.parse(result.stdout);expect(data.stops).toBe(30);expect(data.native).toBe(10);expect(data.coverUrl).toBe('https://metravel.by/travels/article-1');expect(data.coverSource.stopId).toBe('point-2');expect(data.coverSource.sourceTravelId).toBe(102);expect(data.cases.coverPoint).toContain('Cover must explicitly reuse');expect(data.generation.exactPrompt).toBe('isolated artwork prompt');expect(data.historical.promptStatus).toBe('historical-exact-prompt-unavailable');expect(data.historical.exactPrompt).toBeUndefined();expect(data.cases.promptBytes).toContain('checksum mismatch');expect(data.cases.styleBytes).toContain('checksum mismatch');expect(data.cases.missingPrompt).toContain('Missing reproducible artwork prompt');
  expect(data.cases.author).toContain('published author-1');expect(data.cases.sourcePhoto).toContain('association is incomplete');expect(data.cases.photoBytes).toContain('checksum mismatch');expect(data.cases.artBytes).toContain('checksum mismatch');expect(data.cases.map).toContain('does not identify');expect(data.cases.missing).toContain('Missing or duplicate verified source');expect(data.cases.prototype).toContain('at least 30');
});
