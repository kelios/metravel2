import {runNodeCli} from '../../../scripts/cli-test-utils';
it('accounts for every published BY/PL quest once and fails closed on incomplete/cross-volume ledgers',()=>{
  const result=runNodeCli(['--experimental-strip-types','--no-warnings','--input-type=module','-e',`
    import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
    import {validateQuestBookSelection} from './scripts/books/source-quest-books.mjs';
    const bytes=await readFile('data/travelBooks/quests/catalog.json'),catalog=JSON.parse(bytes),selection=JSON.parse(await readFile('data/travelBooks/quests/selection.json','utf8'));
    const valid=await validateQuestBookSelection(catalog,selection,bytes);
    assert.equal(valid.catalog.quests.length,155);assert.equal(valid.selection.rows.length,155);
    const cases=[s=>s.rows.pop(),s=>s.rows[1]={...s.rows[0]},s=>s.rows[0].country=s.rows[0].country==='BY'?'PL':'BY',s=>s.volumes[0].questIds.pop(),s=>s.volumes[1].questIds.push(s.volumes[0].questIds[0]),s=>s.catalogSha256='a'.repeat(64),s=>s.rows.find(r=>r.status==='reserved').overview='Not a published volume source'];
    for(const mutate of cases){const invalid=structuredClone(selection);mutate(invalid);await assert.rejects(()=>validateQuestBookSelection(catalog,invalid,bytes));}
    console.log(JSON.stringify({quests:155,negativeCases:cases.length}));
  `]);
  expect(result.status).toBe(0);expect(JSON.parse(result.stdout)).toEqual({quests:155,negativeCases:7});
});
