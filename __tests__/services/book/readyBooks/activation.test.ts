import {runNodeCli} from '../../../scripts/cli-test-utils';

it('validates staged bytes first and preserves exact source associations across six, eight and ten editions', () => {
  const result = runNodeCli(['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import {mkdir,mkdtemp,readFile,writeFile,readdir,rm,symlink} from 'node:fs/promises';
    import {createHash} from 'node:crypto';
    import {pathToFileURL} from 'node:url';
    import path from 'node:path';
    const repository=process.cwd();
    await mkdir('.codex-temp',{recursive:true});
    const fixture=await mkdtemp(path.resolve('.codex-temp/books-activation-test-'));
    const digest=b=>createHash('sha256').update(b).digest('hex');
    const pdf=Buffer.from('%PDF-1.7 isolated activation fixture');
    const book=(id,sourceId,kind='places')=>({id,slug:id,title:id,country:id.includes('-pl-')?'PL':'BY',revision:'r1',...(kind==='quests'?{kind}:{}),preservedMetadata:{title:id},stops:kind==='quests'?[{questId:sourceId}]:[{sourceTravelId:sourceId,pointId:sourceId+100,...(sourceId===1?{questId:91}:{})}],artifacts:[{uri:'https://metravel.by/travel-books/'+id+'/r1/read-body.pdf',bytes:pdf.length,sha256:digest(pdf)}],preview:[]});
    const oldBooks=['old-by-watercolor','old-pl-watercolor','old-by-photo','old-pl-photo','old-by-fantasy','old-pl-fantasy'].map((id,index)=>book(id,index+1));
    const additions=['new-by-quests','new-pl-quests'].map((id,index)=>book(id,index+91,'quests'));
    const graphic=['new-by-graphic','new-pl-graphic'].map((id,index)=>book(id,index+1));
    const prior={schemaVersion:1,releaseId:'travel-books-v1',books:oldBooks};
    const merged={...prior,books:[...oldBooks,...additions]};
    const complete={...prior,books:[...merged.books,...graphic]};
    const oldRelatedEntries=oldBooks.map((b,index)=>({country:b.country,slug:b.slug,title:b.title,sourceTravelIds:[b.stops[0].sourceTravelId],pointIds:[b.stops[0].pointId],...(index===0?{questIds:[91]}:{})}));
    try {
      process.chdir(fixture);
      const outputPath=path.resolve('.codex-temp/staging'),cacheRoot=path.resolve('.codex-temp/cache');
      await mkdir('data/travelBooks/releases',{recursive:true});
      await mkdir(outputPath,{recursive:true});await mkdir(cacheRoot,{recursive:true});
      await writeFile('package.json','{}');
      const rightsEvidence='Test authorship and release permission';
      await writeFile('rights-source.txt',rightsEvidence);
      const writeProof=async b=>writeFile(path.join(outputPath,b.id,b.revision,'rights.json'),JSON.stringify({
        schemaVersion:1,bookId:b.id,revision:b.revision,
        artifacts:[{id:'read-body.pdf',sha256:digest(pdf),materialIds:['manuscript']}],
        materials:[{id:'manuscript',kind:'text',basis:'original',rightsHolder:'Fixture author',source:'rights-source.txt',evidencePath:'rights-source.txt',evidenceSha256:digest(rightsEvidence),permissions:['digital-distribution','print'],royaltyStatus:'none',attribution:{required:false}}],
      }));
      const before=JSON.stringify(prior),oldRelated=JSON.stringify(oldRelatedEntries);
      const manifestPath=path.resolve('data/travelBooks/manifest.json'),relatedPath=path.resolve('data/travelBooks/related.json'),snapshots=path.resolve('data/travelBooks/releases');
      await writeFile('data/travelBooks/manifest.json',before);await writeFile('data/travelBooks/related.json',oldRelated);
      for(const b of complete.books){
        const relative=b.id+'/r1/read-body.pdf';await mkdir(path.dirname(path.join(outputPath,relative)),{recursive:true});await writeFile(path.join(outputPath,relative),pdf);
        if(oldBooks.includes(b)){await mkdir(path.dirname(path.join(cacheRoot,relative)),{recursive:true});await writeFile(path.join(cacheRoot,relative),pdf);}
      }
      await rm(path.join(outputPath,oldBooks[0].id,'r1/read-body.pdf'));
      // A publication stage contains only the incoming pair, never the complete index.
      await writeFile(path.join(outputPath,'related.json'),JSON.stringify(additions.map(b=>({kind:'quests',country:b.country,slug:b.slug,title:b.title,sourceTravelIds:[],pointIds:[],questIds:[b.stops[0].questId]}))));
      const {activatePublication}=await import(pathToFileURL(path.join(repository,'scripts/books/augment-publication.mjs')).href);
      assert.equal(await readFile('data/travelBooks/manifest.json','utf8'),before,'Import must not activate any package');
      assert.deepEqual(await readdir('data/travelBooks/releases'),[]);
      await mkdir('other-cwd/.codex-temp',{recursive:true});process.chdir(path.join(fixture,'other-cwd'));
      const outsideCache=path.join(fixture,'outside-cache'),linkedCache=path.join(fixture,'.codex-temp/linked-cache');
      await mkdir(outsideCache);await symlink(outsideCache,linkedCache,'dir');
      await assert.rejects(()=>activatePublication({result:merged,outputPath,cacheRoot:linkedCache,root:fixture}),/Activation cache must remain in .codex-temp/);
      assert.deepEqual(await readdir(outsideCache),[],'A symlink cache root must not write outside staging');
      assert.equal(await readFile(manifestPath,'utf8'),before);
      assert.equal(await readFile(relatedPath,'utf8'),oldRelated);
      const lock=path.join(fixture,'.codex-temp/books-publication-activation.lock');
      await writeFile(lock,'another activation');
      await assert.rejects(()=>activatePublication({result:merged,outputPath,cacheRoot,root:fixture}),/activation is locked/);
      assert.equal(await readFile(lock,'utf8'),'another activation');
      await rm(lock);
      await assert.rejects(()=>activatePublication({result:merged,outputPath,cacheRoot,root:fixture,expectedManifestSha256:digest('stale stage')}),/Active book manifest changed since staging/);
      assert.equal(await readFile(manifestPath,'utf8'),before);
      await assert.rejects(()=>readFile(lock),{code:'ENOENT'});
      const broken=path.join(outputPath,additions[1].id,'r1/read-body.pdf');await writeFile(broken,'corrupt staging bytes');
      await assert.rejects(()=>activatePublication({result:merged,outputPath,cacheRoot,root:fixture}),/differs from accepted manifest/);
      assert.equal(await readFile(manifestPath,'utf8'),before);
      assert.equal(await readFile(relatedPath,'utf8'),oldRelated);
      assert.deepEqual(await readdir(snapshots),[]);
      assert.deepEqual((await readdir(cacheRoot)).sort(),oldBooks.map(b=>b.id).sort(),'A later invalid asset must not partially populate cache');
      await writeFile(broken,pdf);
      await writeProof(additions[0]);
      await assert.rejects(()=>activatePublication({result:merged,outputPath,cacheRoot,root:fixture}),/Missing rights proof for new-pl-quests/);
      assert.equal(await readFile(manifestPath,'utf8'),before,'Missing rights cannot advance the active manifest');
      assert.deepEqual((await readdir(cacheRoot)).sort(),oldBooks.map(b=>b.id).sort(),'Missing rights cannot partially populate cache');
      await writeProof(additions[1]);
      await activatePublication({result:merged,outputPath,cacheRoot,root:fixture,expectedManifestSha256:digest(before)});
      assert.equal(JSON.parse(await readFile(path.join(cacheRoot,additions[1].id,'r1/rights.json'),'utf8')).bookId,additions[1].id);
      const current=JSON.parse(await readFile(manifestPath,'utf8'));
      assert.deepEqual(current.books.slice(0,6),oldBooks);
      const relatedEight=JSON.parse(await readFile(relatedPath,'utf8'));
      assert.equal(relatedEight.length,8);
      assert.deepEqual(relatedEight.slice(0,6),oldRelatedEntries);
      assert.deepEqual(relatedEight.slice(6).map(b=>({kind:b.kind,slug:b.slug,sourceTravelIds:b.sourceTravelIds,pointIds:b.pointIds,questIds:b.questIds})),additions.map(b=>({kind:'quests',slug:b.slug,sourceTravelIds:[],pointIds:[],questIds:[b.stops[0].questId]})));
      for(const b of oldBooks)assert.deepEqual(await readFile(path.join(cacheRoot,b.id,'r1/read-body.pdf')),pdf);
      const eightPayload=await readFile(manifestPath);
      await writeFile(path.join(outputPath,'related.json'),JSON.stringify(graphic.map(b=>({country:b.country,slug:b.slug,title:b.title,sourceTravelIds:[b.stops[0].sourceTravelId],pointIds:[b.stops[0].pointId]}))));
      for(const b of graphic)await writeProof(b);
      await activatePublication({result:complete,outputPath,cacheRoot,root:fixture});
      const final=JSON.parse(await readFile(manifestPath,'utf8')),relatedTen=JSON.parse(await readFile(relatedPath,'utf8'));
      assert.deepEqual(final.books.slice(0,6),oldBooks);
      assert.equal(relatedTen.length,10);
      assert.deepEqual(relatedTen.slice(0,8),relatedEight,'Graphic staging must retain all prior quest and travel associations');
      assert.deepEqual(relatedTen.slice(8).map(b=>({sourceTravelIds:b.sourceTravelIds,pointIds:b.pointIds})),[{sourceTravelIds:[1],pointIds:[101]},{sourceTravelIds:[2],pointIds:[102]}]);
      const payload=await readFile(manifestPath);
      assert.deepEqual((await readdir(snapshots)).sort(),[digest(eightPayload)+'.json',digest(payload)+'.json'].sort());
      assert.deepEqual(await readFile(path.join(snapshots,digest(payload)+'.json')),payload);
      console.log(JSON.stringify({importSafe:true,acceptedCacheFallback:true,escapedCacheRejected:true,invalidStagingPreservesPointers:true,noPartialCache:true,existingEditionsPreserved:6,activeEditions:final.books.length,relatedEditions:[relatedEight.length,relatedTen.length],snapshotHash:digest(payload)}));
    } finally {process.chdir(repository);await rm(fixture,{recursive:true,force:true});}
  `]);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout.trim())).toMatchObject({importSafe: true, escapedCacheRejected: true, invalidStagingPreservesPointers: true, noPartialCache: true, existingEditionsPreserved: 6, activeEditions: 10, relatedEditions: [8,10]});
});
