import {runNodeCli} from '../../../scripts/cli-test-utils';

it('keeps original bytes separate, strips private metadata and rejects altered or mis-sized sources',()=>{
  const result=runNodeCli(['--input-type=module','-e',`
    import assert from 'node:assert/strict';
    import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
    import path from 'node:path';
    import sharp from 'sharp';
    import {loadSeriesPhoto} from './scripts/books/source-series-book.mjs';
    import {sha256} from './scripts/books/source-ready-book.mjs';
    const directory=await mkdtemp(path.resolve('.codex-temp/thematic-photo-fixture-'));
    try{
      const original=await sharp({create:{width:24,height:36,channels:3,background:'#aabbcc'}}).withMetadata({orientation:6}).jpeg().toBuffer();
      const file=path.join(directory,'source.jpg');await writeFile(file,original);
      const media={kind:'owner-original',sourceId:'test-original',sha256:sha256(original),bytes:original.length,widthPx:36,heightPx:24};
      const registry={sources:{'test-original':{path:file,sha256:media.sha256}}};
      const derivative=await loadSeriesPhoto(media,registry),metadata=await sharp(derivative.bytes).metadata();
      assert.equal(metadata.width,36);assert.equal(metadata.height,24);assert.equal(metadata.exif,undefined);
      assert.equal(sha256(await readFile(file)),media.sha256);
      const published={...media,kind:'published-variant',uri:'https://metravel.by/photo-exact.jpg'};
      const publicRegistry={publicSources:{[media.sha256]:'test-original'},sources:{'test-original':{path:file,sha256:media.sha256,uri:'https://metravel.by/another-photo.jpg'}}};
      await assert.rejects(()=>loadSeriesPhoto(published,publicRegistry),/public URI/);
      await assert.rejects(()=>loadSeriesPhoto({...media,widthPx:72},registry),/dimensions differ/);
      const cropped=await loadSeriesPhoto({...media,crop:{leftPx:0,topPx:0,widthPx:36,heightPx:12,reason:'people below'}},registry);
      assert.deepEqual([cropped.widthPx,cropped.heightPx],[36,12]);
      await assert.rejects(()=>loadSeriesPhoto({...media,crop:{leftPx:10,topPx:0,widthPx:36,heightPx:12,reason:'x'}},registry),/crop leaves/);
      const retouchBytes=await sharp({create:{width:36,height:24,channels:3,background:'#ffffff'}}).png().toBuffer(),retouchFile=path.join(directory,'retouched.png');await writeFile(retouchFile,retouchBytes);
      const retouch={sha256:sha256(retouchBytes),widthPx:36,heightPx:24,removed:'passer-by',decision:'owner'};
      const retouched=await loadSeriesPhoto({...media,retouch},{...registry,retouched:{[retouch.sha256]:{path:retouchFile}}});
      assert.equal((await sharp(retouched.bytes).stats()).channels[0].mean>250,true);
      await assert.rejects(()=>loadSeriesPhoto({...media,retouch},registry),/Missing retouched/);
      await assert.rejects(()=>loadSeriesPhoto({...media,bytes:1},registry),/source bytes differ/);
      await writeFile(file,Buffer.from('tampered'));
      await assert.rejects(()=>loadSeriesPhoto(media,registry),/source bytes differ/);
      console.log(JSON.stringify({native:[metadata.width,metadata.height],stripped:true,originalUnchanged:true}));
    }finally{await rm(directory,{recursive:true,force:true});}
  `]);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({native:[36,24],stripped:true,originalUnchanged:true});
});

it('accepts only complete declared country or thematic production pairs',()=>{
  const result=runNodeCli(['--input-type=module','-e',`
    import assert from 'node:assert/strict';
    import {assertProductionEditionSet,assertProductionEditorialIdentity} from './scripts/books/production-contract.mjs';
    const legacy={schemaVersion:1,books:[{bookId:'belarus-memory',country:'BY'},{bookId:'poland-memory',country:'PL'}]};
    const pilots={schemaVersion:1,sourceContract:'thematic-v1',books:[
      {bookId:'poland-mountains-memory',sourceContract:'thematic-v1',seriesId:'mountains-pl',theme:'mountains',country:'PL',stopCount:40},
      {bookId:'poland-castles-memory',sourceContract:'thematic-v1',seriesId:'castles-pl',theme:'castles',country:'PL',stopCount:30}]};
    assertProductionEditionSet(legacy);assertProductionEditionSet(pilots);
    const incomplete=structuredClone(pilots);incomplete.books[0].stopCount=30;
    assert.throws(()=>assertProductionEditionSet(incomplete),/40-mountain/);
    const mixed=structuredClone(pilots);delete mixed.sourceContract;
    assert.throws(()=>assertProductionEditionSet(mixed),/BY and PL/);
    const duplicate=structuredClone(pilots);duplicate.books[1].seriesId='mountains-pl';
    assert.throws(()=>assertProductionEditionSet(duplicate),/complete approved/);
    const wrongTheme=structuredClone(pilots);wrongTheme.books[0].theme='castles';
    assert.throws(()=>assertProductionEditionSet(wrongTheme),/complete approved/);
    const source={...pilots.books[0],revision:'2026-11-02.series.test'};
    const editorial={id:source.bookId,revision:source.revision,country:'PL',sourceContract:'thematic-v1',seriesId:'mountains-pl',theme:'mountains'};
    assertProductionEditorialIdentity(source,editorial);
    for(const change of [{seriesId:'castles-pl'},{theme:'castles'},{sourceContract:undefined},{kind:'quests'}]) {
      assert.throws(()=>assertProductionEditorialIdentity(source,{...editorial,...change}),/identity differs/);
    }
    assertProductionEditorialIdentity({bookId:'legacy',revision:'v1',country:'BY'},{id:'legacy',revision:'v1',country:'BY'});
    console.log(JSON.stringify({countryPair:true,thematicPair:true,rejectsIncomplete:true,rejectsMixed:true}));
  `]);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({countryPair:true,thematicPair:true,rejectsIncomplete:true,rejectsMixed:true});
});

it('does not launch authoring on an unknown series CLI option',()=>{
  const result=runNodeCli(['scripts/books/build-series-books.mjs','--unknown']);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('Use [--check]');
});

it('rejects thematic source changes after PDF acceptance even when edition identity is unchanged',()=>{
  const result=runNodeCli(['--input-type=module','-e',`
    import assert from 'node:assert/strict';
    import {createHash} from 'node:crypto';
    import {thematicEditorialAcceptance,assertAcceptedThematicEditorial,assertProductionEditorialIdentity} from './scripts/books/production-contract.mjs';
    const source={bookId:'poland-mountains-memory',revision:'2026-11-02.series.test',country:'PL',sourceContract:'thematic-v1',seriesId:'mountains-pl',theme:'mountains'};
    const editorial={id:source.bookId,revision:source.revision,country:source.country,sourceContract:source.sourceContract,seriesId:source.seriesId,theme:source.theme,distanceKm:5};
    const bytes=Buffer.from(JSON.stringify(editorial)+'\\n');
    const descriptor=thematicEditorialAcceptance(source,bytes);
    assert.equal(descriptor.sha256,createHash('sha256').update(bytes).digest('hex'));
    const accepted={editorialSources:[descriptor]};
    assertAcceptedThematicEditorial(source,bytes,accepted);
    const changed={...editorial,distanceKm:50};
    assertProductionEditorialIdentity(source,changed);
    assert.throws(()=>assertAcceptedThematicEditorial(source,Buffer.from(JSON.stringify(changed)+'\\n'),accepted),/editorial bytes differ/);
    assert.throws(()=>assertAcceptedThematicEditorial(source,bytes,{}),/editorial bytes differ/);
    assert.throws(()=>assertAcceptedThematicEditorial(source,bytes,{editorialSources:[descriptor,descriptor]}),/editorial bytes differ/);
    assertAcceptedThematicEditorial({bookId:'legacy',revision:'v1'},Buffer.from('legacy'),{});
    console.log(JSON.stringify({exactBytes:true,rejectsAlteredFacts:true,rejectsMissingOrDuplicateProof:true,legacyUnchanged:true}));
  `]);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({exactBytes:true,rejectsAlteredFacts:true,rejectsMissingOrDuplicateProof:true,legacyUnchanged:true});
});
