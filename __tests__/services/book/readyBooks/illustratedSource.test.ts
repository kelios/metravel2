import {runNodeCli} from '../../../scripts/cli-test-utils';

it('loads approved illustrated inputs without old journals and rejects source, artwork, approval and font substitutions', () => {
  const result = runNodeCli(['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import {readFile} from 'node:fs/promises';
    import {createHash} from 'node:crypto';
    import sharp from 'sharp';
    import {loadIllustratedEdition} from './scripts/books/load-illustrated-edition.mjs';
    const sha = bytes => createHash('sha256').update(bytes).digest('hex');
    const font = await readFile('data/travelBooks/assets/fonts/cormorant-garamond/CormorantGaramond-Regular.ttf');
    const license = await readFile('data/travelBooks/assets/fonts/cormorant-garamond/OFL.txt');
    const photo = await sharp({create:{width:10,height:15,channels:3,background:'#fffefa'}}).png().toBuffer();
    const differentPhoto = await sharp({create:{width:10,height:15,channels:3,background:'#c8d7ba'}}).png().toBuffer();
    const art = await sharp({create:{width:20,height:30,channels:3,background:'#ece6da'}}).png().toBuffer();
    const snapshot = Buffer.from('tracked source snapshot');
    const styleReference = Buffer.from('approved style reference');
    function fixture() {
      const files = new Map(), reads = [];
      const put = (path, value) => {const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));files.set(path,bytes);return {path,sha256:sha(bytes),bytes:bytes.length};};
      const sourceFile = put('fixture/photo.png', photo), artFile=put('fixture/art.png',art);
      const styleFile = put('fixture/style.png',styleReference);
      const snapshotFile = put('fixture/snapshot.json',snapshot);
      const fontFile = put('fixture/font.ttf',font), licenseFile=put('fixture/OFL.txt',license);
      const article={id:201,userId:1,url:'https://metravel.by/travels/author-source',publicationStatus:'published',pointIdVerified:true,verifiedOn:'2026-10-30'};
      const source={...sourceFile,originalUri:'https://metravel.by/travel-description-image/exact.webp',articleImageUri:'https://metravel.by/travel-description-image/exact.webp',widthPx:10,heightPx:15,association:{evidence:'Exact original variant of this selected article image'},rights:{basis:'owner-author-photo',ownerUserId:1,sourceTravelId:201,permission:'owner-commissioned-photo-diary'}};
      const stop={id:'point-5247',title:'Мирский замок',text:{compact:'Проверенный рассказ. Łąka, ў, ї, ґ.',album:'Проверенный рассказ. Łąka, ў, ї, ґ.'},navigation:{pointId:5247,sourceTravelId:201,mapUrl:'https://metravel.by/map?placeId=5247',articleUrl:article.url}};
      const sources=new Map([[stop.id,{article:structuredClone(article),photo:structuredClone(source)}]]);
      const sourceProvenance={schemaVersion:1,country:'BY',stopCount:1,assets:[{stopId:stop.id,pointId:5247,articleId:201,articleUrl:article.url,authorId:1,photo:structuredClone(source)}]};
      const approval={schemaVersion:1,visualStyle:'fantasy',approvedStage:'visual-direction-and-series-continuation',ownerCommand:'доделывай',ownerCommandDate:'2026-11-01',styleReference:styleFile,historicalSample:{path:'ignored/deleted-sample-journal.json'}};
      const fontRecord={font:fontFile,license:licenseFile};
      const prompt='Transform this exact author photograph without changing the landmark';
      const evidence={schemaVersion:1,country:'BY',visualStyle:'fantasy',authorId:1,printReady:false,placeCount:1,sourceInputs:[snapshotFile],cover:{sourceStopId:stop.id,artworkSha256:sha(art)},places:[{stopId:stop.id,pointId:5247,article:structuredClone(article),sourcePhoto:structuredClone(source),artwork:{...artFile,widthPx:20,heightPx:30,artworkBounds:{left:0,top:.04,width:1,height:.65},derivedIllustration:true,originalPhoto:false,upscaled:false},generation:{exactPrompt:prompt,promptSha256:sha(Buffer.from(prompt)),styleReference:styleFile,tool:'image_gen.imagegen',modelIdentifier:null,modelDisclosure:'not exposed by tool',evidence:{path:'ignored/deleted-generation-journal.json'}},visualReview:{status:'pass'},navigation:{map:stop.navigation.mapUrl,article:article.url}}]};
      const inputs={schemaVersion:1,visualStyle:'fantasy',printReady:false,recordedOn:'2026-11-01',styleReference:styleFile,countries:[]};
      const refresh=()=>{
        evidence.sourceInputs=[snapshotFile,put('fixture/by/artwork-provenance.json',sourceProvenance)];
        inputs.approval=put('fixture/approval.json',approval);
        evidence.approval=inputs.approval;
        inputs.font=put('fixture/font-record.json',fontRecord);
        inputs.countries=[{country:'BY',placeCount:1,evidence:put('fixture/evidence.json',evidence)}];
        put('fixture/styles/fantasy/inputs.json',inputs);
      };
      const load=()=>loadIllustratedEdition({country:'by',style:'fantasy',stops:[stop],sources,sourcesRoot:'fixture',projectFile:async file=>{reads.push(file);if(!files.has(file))throw new Error('Missing fixture file: '+file);return files.get(file);}});
      refresh();return {files,reads,put,source,sourceProvenance,stop,sources,approval,fontRecord,evidence,inputs,refresh,load};
    }
    const valid=fixture(),before=JSON.stringify({stop:valid.stop,sources:[...valid.sources]});
    const first=await valid.load(),second=await valid.load();
    const encoded=Buffer.from(first.assets['point-5247'].dataUri.split(',')[1],'base64');
    const size=await sharp(encoded).metadata();
    assert.deepEqual(first.revisionSeed,second.revisionSeed);
    assert.equal(first.cover.asset,first.assets['point-5247']);
    assert.equal(JSON.stringify({stop:valid.stop,sources:[...valid.sources]}),before);
    const cases={};
    const failures={
      author:f=>f.sources.get('point-5247').article.userId=2,
      article:f=>f.evidence.places[0].article.id=999,
      originalUri:f=>f.evidence.places[0].sourcePhoto.originalUri='https://metravel.by/travel-description-image/another.webp',
      photoBytes:f=>f.files.set('fixture/photo.png',art),
      sourcePhotoSubstitution:f=>Object.assign(f.evidence.places[0].sourcePhoto,f.put('fixture/different-photo.png',differentPhoto)),
      canonicalPhotoSha:f=>f.sourceProvenance.assets[0].photo.sha256='0'.repeat(64),
      canonicalArticle:f=>f.sourceProvenance.assets[0].articleId=999,
      artworkBytes:f=>f.files.set('fixture/art.png',photo),
      nativeDimensions:f=>f.evidence.places[0].artwork.widthPx=2000,
      upscaled:f=>f.evidence.places[0].artwork.upscaled=true,
      prompt:f=>f.evidence.places[0].generation.exactPrompt+=' altered',
      style:f=>f.evidence.visualStyle='graphic',
      approval:f=>f.approval.approvedStage='pending-owner-visual-decision',
      styleReference:f=>f.approval.styleReference={...f.approval.styleReference,sha256:'0'.repeat(64)},
      missingStop:f=>{f.evidence.places=[];},
      extraStop:f=>f.evidence.places.push({...f.evidence.places[0],stopId:'point-999'}),
      cover:f=>f.evidence.cover.sourceStopId='point-999',
      sourceSnapshot:f=>f.files.set('fixture/snapshot.json',Buffer.from('changed source')),
      rights:f=>f.evidence.places[0].sourcePhoto.rights.sourceTravelId=202,
      modelDisclosure:f=>{delete f.evidence.places[0].generation.modelDisclosure;},
      review:f=>f.evidence.places[0].visualReview.status='pending',
      navigation:f=>f.evidence.places[0].navigation.map='https://metravel.by/map?placeId=999',
    };
    for(const [name,change] of Object.entries(failures)){
      const f=fixture();change(f);f.refresh();
      try{await f.load();cases[name]='unexpected-pass';}catch(error){cases[name]=error.message;}
    }
    const missingFont=fixture();
    missingFont.stop.title+=' 🦄';
    missingFont.refresh();try{await missingFont.load();cases.fontCoverage='unexpected-pass';}catch(error){cases.fontCoverage=error.message;}
    console.log(JSON.stringify({valid:{assets:Object.keys(first.assets),native:[size.width,size.height],encodedSha:first.assetsProvenance[0].encodedSha256,sourceSha:first.assetsProvenance[0].sourcePhotoSha256,noIgnoredJournalReads:valid.reads.every(p=>!p.startsWith('ignored/')),revisionStyle:first.revisionSeed.visualStyle,fontsEmbedded:Object.values(first.fonts).every(x=>x.startsWith('data:font/ttf;base64,'))},cases}));
  `]);
  expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout.trim());
  expect(report.valid).toMatchObject({assets: ['point-5247'], native: [20, 30], noIgnoredJournalReads: true, revisionStyle: 'fantasy', fontsEmbedded: true});
  expect(report.valid.encodedSha).toMatch(/^[a-f0-9]{64}$/);
  expect(report.valid.sourceSha).toMatch(/^[a-f0-9]{64}$/);
  expect(Object.keys(report.cases)).toHaveLength(23);
  for (const [name, value] of Object.entries(report.cases)) {
    expect({name, value}).not.toEqual({name, value: 'unexpected-pass'});
    expect(value).toMatch(/^Illustrated edition:/);
  }
});
