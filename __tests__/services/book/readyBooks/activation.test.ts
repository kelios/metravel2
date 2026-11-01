import {runNodeCli} from '../../../scripts/cli-test-utils';

it('imports the canonical activation adapter safely, validates all staged bytes first, and preserves four existing editions', () => {
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
    const book=id=>({id,revision:'r1',preservedMetadata:{title:id},artifacts:[{uri:'https://metravel.by/travel-books/'+id+'/r1/read-body.pdf',bytes:pdf.length,sha256:digest(pdf)}],preview:[]});
    const oldBooks=['old-by-watercolor','old-pl-watercolor','old-by-photo','old-pl-photo'].map(book);
    const additions=['new-by-fantasy','new-pl-fantasy'].map(book);
    const prior={schemaVersion:1,releaseId:'travel-books-v1',books:oldBooks};
    const merged={...prior,books:[...oldBooks,...additions]};
    try {
      process.chdir(fixture);
      const outputPath=path.resolve('.codex-temp/staging'),cacheRoot=path.resolve('.codex-temp/cache');
      await mkdir('data/travelBooks/releases',{recursive:true});
      await mkdir(outputPath,{recursive:true});await mkdir(cacheRoot,{recursive:true});
      await writeFile('package.json','{}');
      const before=JSON.stringify(prior),oldRelated='[]';
      const manifestPath=path.resolve('data/travelBooks/manifest.json'),relatedPath=path.resolve('data/travelBooks/related.json'),snapshots=path.resolve('data/travelBooks/releases');
      await writeFile('data/travelBooks/manifest.json',before);await writeFile('data/travelBooks/related.json',oldRelated);
      for(const b of merged.books){
        const relative=b.id+'/r1/read-body.pdf';await mkdir(path.dirname(path.join(outputPath,relative)),{recursive:true});await writeFile(path.join(outputPath,relative),pdf);
        if(oldBooks.includes(b)){await mkdir(path.dirname(path.join(cacheRoot,relative)),{recursive:true});await writeFile(path.join(cacheRoot,relative),pdf);}
      }
      await writeFile(path.join(outputPath,'related.json'),'[{"slug":"new-by-fantasy"}]');
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
      const broken=path.join(outputPath,additions[1].id,'r1/read-body.pdf');await writeFile(broken,'corrupt staging bytes');
      await assert.rejects(()=>activatePublication({result:merged,outputPath,cacheRoot,root:fixture}),/differs from accepted manifest/);
      assert.equal(await readFile(manifestPath,'utf8'),before);
      assert.equal(await readFile(relatedPath,'utf8'),oldRelated);
      assert.deepEqual(await readdir(snapshots),[]);
      assert.deepEqual((await readdir(cacheRoot)).sort(),oldBooks.map(b=>b.id).sort(),'A later invalid asset must not partially populate cache');
      await writeFile(broken,pdf);await activatePublication({result:merged,outputPath,cacheRoot,root:fixture});
      const current=JSON.parse(await readFile(manifestPath,'utf8'));
      assert.deepEqual(current.books.slice(0,4),oldBooks);
      for(const b of oldBooks)assert.deepEqual(await readFile(path.join(cacheRoot,b.id,'r1/read-body.pdf')),pdf);
      const payload=await readFile(manifestPath);
      assert.deepEqual(await readdir(snapshots),[digest(payload)+'.json']);
      assert.deepEqual(await readFile(path.join(snapshots,digest(payload)+'.json')),payload);
      console.log(JSON.stringify({importSafe:true,escapedCacheRejected:true,invalidStagingPreservesPointers:true,noPartialCache:true,existingEditionsPreserved:4,activeEditions:current.books.length,snapshotHash:digest(payload)}));
    } finally {process.chdir(repository);await rm(fixture,{recursive:true,force:true});}
  `]);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout.trim())).toMatchObject({importSafe: true, escapedCacheRejected: true, invalidStagingPreservesPointers: true, noPartialCache: true, existingEditionsPreserved: 4, activeEditions: 6});
});
