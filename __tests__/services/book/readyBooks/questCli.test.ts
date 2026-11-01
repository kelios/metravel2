import {runNodeCli} from '../../../scripts/cli-test-utils';
it('imports safely, retains the explicit owner ending and rejects unavailable input before any authoring output',()=>{
 const result=runNodeCli(['--experimental-strip-types','--no-warnings','--input-type=module','-e',`
  import assert from 'node:assert/strict';import {mkdtemp,stat,rm} from 'node:fs/promises';import path from 'node:path';
  import {loadQuestBookEnding,buildCountryQuestBooks} from './scripts/books/build-quest-books.mjs';
  const ending=await loadQuestBookEnding();assert.equal(ending.ownerDecision.command,'Общая карта страны со всеми квестами');assert.deepEqual(ending.pages,['country-map']);
  const fixture=await mkdtemp(path.resolve('.codex-temp/quest-cli-fixture-'));try{
   const output=path.join(fixture,'output');await assert.rejects(()=>buildCountryQuestBooks({endingPath:path.join(fixture,'absent.json'),output}),/QUEST_BOOK_ENDING_PENDING/);await assert.rejects(()=>stat(output));
   console.log(JSON.stringify({importSafe:true,endingRecorded:true,noOutputOnMissingInput:true}));
  }finally{await rm(fixture,{recursive:true,force:true});}
 `]);
 expect(result.status).toBe(0);expect(JSON.parse(result.stdout)).toEqual({importSafe:true,endingRecorded:true,noOutputOnMissingInput:true});
});
it('rejects unknown CLI options without invoking a real render',()=>{
 const result=runNodeCli(['scripts/books/build-quest-books.mjs','--unknown']);expect(result.status).toBe(1);expect(result.stdout).toBe('');expect(result.stderr).toContain('Use [--output');
});
